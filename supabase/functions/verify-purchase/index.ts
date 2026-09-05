import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const ANDROID_PACKAGE_NAME = Deno.env.get("ANDROID_PACKAGE_NAME") || "com.bodyahmed77.fiftyfit";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fiftyfit-purchase-request",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRODUCT_KEY_MAP: Record<string, ReadonlyArray<"ai_coach_pro" | "training_pro" | "nutrition_pro">> = {
  ai_coach_pro_monthly: ["ai_coach_pro"],
  ai_coach_pro_quarterly: ["ai_coach_pro"],
  ai_coach_pro_6months: ["ai_coach_pro"],
  ai_coach_pro_yearly: ["ai_coach_pro"],
  training_pro_monthly: ["training_pro"],
  training_pro_quarterly: ["training_pro"],
  training_pro_6months: ["training_pro"],
  training_pro_yearly: ["training_pro"],
  nutrition_pro_monthly: ["nutrition_pro"],
  nutrition_pro_quarterly: ["nutrition_pro"],
  nutrition_pro_6months: ["nutrition_pro"],
  nutrition_pro_yearly: ["nutrition_pro"],
  both_pro_monthly: ["training_pro", "nutrition_pro"],
  both_pro_quarterly: ["training_pro", "nutrition_pro"],
  both_pro_6months: ["training_pro", "nutrition_pro"],
  both_pro_yearly: ["training_pro", "nutrition_pro"],
};

const ENTITLING_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(event: string, extra: Record<string, unknown> = {}) {
  try {
    console.log("[VERIFY_PURCHASE]", event, JSON.stringify(extra));
  } catch {
    console.log("[VERIFY_PURCHASE]", event);
  }
}

function requestId(req: Request) {
  return req.headers.get("X-FiftyFit-Purchase-Request") || `ff-${crypto.randomUUID()}`;
}

function hasPaidEntitlement(state: string, expiryTime: string | null): boolean {
  if (ENTITLING_STATES.has(state)) return true;
  if (state !== "SUBSCRIPTION_STATE_CANCELED" || !expiryTime) return false;
  const expiryMs = Date.parse(expiryTime);
  return Number.isFinite(expiryMs) && expiryMs > Date.now();
}

async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}

type ServiceAccountKey = { client_email: string; private_key: string; token_uri?: string };
let cachedKey: ServiceAccountKey | null | undefined;

function loadServiceAccountKey(): ServiceAccountKey | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) return (cachedKey = null);
  try {
    const parsed = JSON.parse(raw) as ServiceAccountKey;
    if (!parsed.client_email || !parsed.private_key) return (cachedKey = null);
    return (cachedKey = parsed);
  } catch {
    return (cachedKey = null);
  }
}

async function getPlayAccessToken(key: ServiceAccountKey): Promise<string> {
  const pem = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new jose.SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(key.client_email)
    .setAudience(key.token_uri || "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);
  const tokenRes = await fetch(key.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokenRes.ok) throw new Error(`oauth_token_exchange_failed_${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  if (!tokenData?.access_token || typeof tokenData.access_token !== "string") throw new Error("oauth_token_missing_access_token");
  return tokenData.access_token;
}

async function verifyWithGooglePlay(purchaseToken: string, rid: string) {
  const key = loadServiceAccountKey();
  if (!key) {
    log("verification_config_missing", { rid });
    return { ok: false as const, reason: "config_missing" as const };
  }

  let accessToken: string;
  try {
    accessToken = await getPlayAccessToken(key);
  } catch (e) {
    log("oauth_exchange_failed", { rid, detail: String((e as Error)?.message || e).slice(0, 120) });
    return { ok: false as const, reason: "provider_error" as const };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 404 || res.status === 400) {
      log("play_token_not_found", { rid, status: res.status });
      return { ok: false as const, reason: "not_found" as const };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log("play_api_error", { rid, status: res.status, detail: detail.slice(0, 180) });
      return { ok: false as const, reason: "provider_error" as const };
    }
    const data = await res.json().catch(() => null);
    const state = String(data?.subscriptionState || "");
    const acknowledgementState = String(data?.acknowledgementState || "ACKNOWLEDGEMENT_STATE_UNSPECIFIED");
    const lineItems = Array.isArray(data?.lineItems) ? data.lineItems : [];
    const lineItemProductIds = lineItems.map((li: { productId?: string }) => String(li?.productId || "")).filter(Boolean);
    const expiryTime = typeof lineItems?.[0]?.expiryTime === "string" ? lineItems[0].expiryTime : null;
    log("google_play_verified", { rid, state, acknowledgementState, productIds: lineItemProductIds, hasExpiry: !!expiryTime });
    return { ok: true as const, state, lineItemProductIds, expiryTime, acknowledgementState, accessToken };
  } catch (e) {
    log("play_api_network_error", { rid, detail: String((e as Error)?.message || e).slice(0, 120) });
    return { ok: false as const, reason: "provider_error" as const };
  }
}

async function acknowledgeSubscription(accessToken: string, productId: string, purchaseToken: string, rid: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok || res.status === 409) return { acknowledged: true };
    const detail = await res.text().catch(() => "");
    log("play_acknowledge_failed", { rid, status: res.status, productId, detail: detail.slice(0, 180) });
    return { acknowledged: false, code: `ack_${res.status}` };
  } catch (e) {
    log("play_acknowledge_network_error", { rid, productId, detail: String((e as Error)?.message || e).slice(0, 120) });
    return { acknowledged: false, code: "ack_network_error" };
  }
}

Deno.serve(async (req) => {
  const rid = requestId(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed", requestId: rid });

  const authHeader = req.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    log("missing_authorization", { rid });
    return json(401, { error: "unauthenticated", message: "Missing Bearer token", requestId: rid });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(match[1].trim());
  } catch (e) {
    log("firebase_auth_failed", { rid, detail: String((e as Error)?.message || e).slice(0, 120) });
    return json(401, { error: "unauthenticated", message: "Invalid or expired Firebase ID token", requestId: rid });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";
  log("request_received", { rid, uid, productId, hasPurchaseToken: !!purchaseToken });

  if (!productId || !purchaseToken) return json(400, { error: "bad_request", message: "productId and purchaseToken are required", requestId: rid });
  const grantedKeys = PRODUCT_KEY_MAP[productId];
  if (!grantedKeys) {
    log("unknown_product", { rid, uid, productId });
    return json(400, { error: "bad_request", message: "Unknown product", requestId: rid, productId });
  }

  const verification = await verifyWithGooglePlay(purchaseToken, rid);
  if (!verification.ok) {
    if (verification.reason === "config_missing") return json(503, { error: "verification_unavailable", message: "Purchase verification is not configured on the server. No entitlement was granted.", requestId: rid });
    if (verification.reason === "not_found") return json(402, { error: "purchase_not_found", message: "Google Play did not recognize this purchase. No entitlement was granted.", requestId: rid });
    return json(503, { error: "verification_provider_error", message: "Could not verify this purchase with Google Play right now. Please try again shortly.", requestId: rid });
  }

  if (!verification.lineItemProductIds.includes(productId)) {
    log("purchase_rejected_product_mismatch", { rid, uid, claimedProductId: productId, actualProductIds: verification.lineItemProductIds });
    return json(402, { error: "product_mismatch", message: "This purchase does not match the requested product. No entitlement was granted.", requestId: rid });
  }

  if (!hasPaidEntitlement(verification.state, verification.expiryTime)) {
    log("purchase_rejected_not_entitling", { rid, uid, productId, state: verification.state, expiryTime: verification.expiryTime });
    return json(402, { error: "purchase_not_active", message: "This subscription is not currently active.", subscriptionState: verification.state, expiresAt: verification.expiryTime, requestId: rid });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    log("supabase_service_config_missing", { rid, uid, productId });
    return json(500, { error: "backend_error", message: "Supabase service credentials missing", requestId: rid });
  }

  const sb = createClient(supabaseUrl, serviceKey);
  try {
    const { data: grant, error: grantErr } = await sb.rpc("claim_and_grant_entitlements", {
      p_uid: uid,
      p_purchase_token: purchaseToken,
      p_product_keys: [...grantedKeys],
      p_expires_at: verification.expiryTime,
    });
    if (grantErr) {
      log("claim_and_grant_failed", { rid, uid, productId, code: grantErr.code, message: grantErr.message?.slice(0, 180) });
      return json(500, { error: "entitlement_write_failed", message: "Could not activate subscription", requestId: rid });
    }

    const grantRow = (grant || {}) as { ok?: boolean; activated?: string[] };
    if (!grantRow.ok) {
      log("token_already_claimed_by_other_uid", { rid, uid, productId });
      return json(409, { error: "purchase_already_claimed", message: "This purchase has already been activated on a different account.", requestId: rid });
    }

    let acknowledged = verification.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    let acknowledgementError: string | null = null;
    if (!acknowledged) {
      const ack = await acknowledgeSubscription(verification.accessToken, productId, purchaseToken, rid);
      acknowledged = ack.acknowledged;
      acknowledgementError = ack.acknowledged ? null : ack.code || "ack_failed";
    }

    const activated = Array.isArray(grantRow.activated) ? grantRow.activated : [...grantedKeys];
    log("purchase_verified_granted", {
      rid,
      uid,
      productId,
      state: verification.state,
      activated,
      acknowledged,
      acknowledgementError,
      expiresAt: verification.expiryTime,
    });

    // Entitlement is already verified and stored. A temporary acknowledgement
    // failure must never make a successful customer appear unpaid in-app.
    // A later restore/re-sync retries acknowledgement against the same token.
    return json(200, {
      ok: true,
      productId,
      activated,
      subscriptionState: verification.state,
      expiresAt: verification.expiryTime,
      acknowledged,
      acknowledgementPending: !acknowledged,
      acknowledgementError: acknowledged ? null : acknowledgementError,
      requestId: rid,
    });
  } catch (e) {
    log("unexpected_error", { rid, uid, productId, detail: String((e as Error)?.message || e).slice(0, 160) });
    return json(500, { error: "backend_error", message: "Internal error", requestId: rid });
  }
});
