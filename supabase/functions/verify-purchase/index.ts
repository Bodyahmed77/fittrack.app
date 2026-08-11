// Supabase Edge Function: verify-purchase
//
// Client reports a Google Play purchase (productId + purchaseToken) after
// the native billing flow completed. This function does NOT trust that
// report — it independently verifies the purchase against the real
// Google Play Developer API (purchases.subscriptionsv2.get) using a
// service account, and only writes an entitlement if Google confirms:
//   - the token is valid for THIS app's package name
//   - the subscription line item's productId matches what the client claims
//   - the subscription is in an entitlement-granting state
//     (ACTIVE or IN_GRACE_PERIOD)
// A fabricated or arbitrary purchaseToken is rejected by Google's API
// (404/400) and NO entitlement is written.
//
// Known limitation (documented, not hidden): the currently pinned
// `capacitor-billing@6.0.2` client plugin does not support passing an
// obfuscated account id into launchBillingFlow, so Google's API cannot by
// itself prove WHICH app user purchased a token — only that the token is
// real, unconsumed by a *different* entitlement grant, and for the right
// product. This function closes that remaining gap at the database layer:
// a purchase token can only ever be claimed by ONE uid, enforced by a
// unique constraint (see migration). First verified claim wins; a second
// user presenting the same real token is rejected. See the audit report
// for the recommended follow-up (plugin upgrade + setObfuscatedAccountId)
// to bind purchases to a uid at Google's side too.

import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const ANDROID_PACKAGE_NAME =
  Deno.env.get("ANDROID_PACKAGE_NAME") || "com.fittrack.app";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Client-reported product key -> the entitlement row(s) it should grant.
// "both_pro" is a single Play product that grants two independent rows.
const PRODUCT_KEY_MAP: Record<
  string,
  ReadonlyArray<"ai_coach_pro" | "training_pro" | "nutrition_pro">
> = {
  ai_coach_pro: ["ai_coach_pro"],
  training_pro: ["training_pro"],
  nutrition_pro: ["nutrition_pro"],
  both_pro: ["training_pro", "nutrition_pro"],
};

// Play subscription states that mean "the user should have access right now".
// ON_HOLD / CANCELED (already lapsed) / EXPIRED / PAUSED / PENDING do NOT
// grant entitlement. A user-cancelled-but-not-yet-expired subscription is
// still ACTIVE until its expiry — Play keeps reporting ACTIVE for that
// window, so no special-casing is needed here.
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
  // Never log purchaseToken, service-account keys, or OAuth access tokens.
  try {
    console.log("[VERIFY_PURCHASE]", event, JSON.stringify(extra));
  } catch {
    console.log("[VERIFY_PURCHASE]", event);
  }
}

async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(
    new URL(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    ),
  );
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}

// ============================================================
// Google Play Developer API access via a service account.
// Deno Edge Functions have no Google Cloud SDK, so this signs the
// service-account JWT assertion by hand (RS256, using `jose`, already a
// project dependency) and exchanges it for a short-lived OAuth access
// token via Google's token endpoint. Nothing here is cached across
// invocations by design — each verification gets a fresh token; the
// alternative (caching across warm isolates) is a minor cost optimization
// not worth the added complexity for this volume.
// ============================================================

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedKey: ServiceAccountKey | null | undefined;

function loadServiceAccountKey(): ServiceAccountKey | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    cachedKey = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccountKey;
    if (!parsed.client_email || !parsed.private_key) {
      cachedKey = null;
      return null;
    }
    cachedKey = parsed;
    return cachedKey;
  } catch {
    cachedKey = null;
    return null;
  }
}

async function getPlayAccessToken(key: ServiceAccountKey): Promise<string> {
  // Google service-account PEM keys are PKCS#8. jose needs a CryptoKey,
  // not the raw PEM string.
  const pem = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const assertion = await new jose.SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(key.client_email)
    .setAudience(key.token_uri || "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);

  const tokenRes = await fetch(
    key.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );

  if (!tokenRes.ok) {
    // Never log the response body — Google's OAuth error payloads can
    // occasionally echo back parts of the request.
    throw new Error(`oauth_token_exchange_failed_${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData?.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("oauth_token_missing_access_token");
  }
  return accessToken;
}

type PlayVerifyResult =
  | { ok: true; state: string; lineItemProductIds: string[]; expiryTime: string | null }
  | { ok: false; reason: "not_found" | "provider_error" | "config_missing" };

async function verifyWithGooglePlay(
  purchaseToken: string,
): Promise<PlayVerifyResult> {
  const key = loadServiceAccountKey();
  if (!key) {
    return { ok: false, reason: "config_missing" };
  }

  let accessToken: string;
  try {
    accessToken = await getPlayAccessToken(key);
  } catch (e) {
    log("oauth_exchange_failed", {
      detail: String((e as Error)?.message || e).slice(0, 80),
    });
    return { ok: false, reason: "provider_error" };
  }

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(ANDROID_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    log("play_api_network_error", {
      detail: String((e as Error)?.message || e).slice(0, 80),
    });
    return { ok: false, reason: "provider_error" };
  }

  if (res.status === 404 || res.status === 400) {
    // Google does not recognize this token for this package — this is the
    // exact case a fabricated/arbitrary token must land in.
    log("play_token_not_found", { status: res.status });
    return { ok: false, reason: "not_found" };
  }
  if (!res.ok) {
    log("play_api_error", { status: res.status });
    return { ok: false, reason: "provider_error" };
  }

  const data = await res.json().catch(() => null);
  const state = String(data?.subscriptionState || "");
  const lineItems = Array.isArray(data?.lineItems) ? data.lineItems : [];
  const lineItemProductIds = lineItems
    .map((li: { productId?: string }) => String(li?.productId || ""))
    .filter(Boolean);
  const expiryTime =
    typeof lineItems?.[0]?.expiryTime === "string"
      ? lineItems[0].expiryTime
      : null;

  return { ok: true, state, lineItemProductIds, expiryTime };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  // ---- Auth: Firebase ID token from Authorization header.
  const authHeader = req.headers.get("Authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return json(401, { error: "unauthenticated", message: "Missing Bearer token" });
  }
  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(m[1].trim());
  } catch {
    return json(401, { error: "unauthenticated", message: "Invalid or expired Firebase ID token" });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // ---- Validate the shape of the reported purchase (not proof of anything
  // yet — just enough to know what to ask Google about).
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const purchaseToken =
    typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";

  if (!productId || !purchaseToken) {
    return json(400, { error: "bad_request", message: "productId and purchaseToken are required" });
  }
  const grantedKeys = PRODUCT_KEY_MAP[productId];
  if (!grantedKeys) {
    return json(400, { error: "bad_request", message: "Unknown product" });
  }

  // ---- REAL verification against the Google Play Developer API.
  // Nothing below writes an entitlement until this returns ok:true with a
  // matching product and an entitling subscription state.
  const verification = await verifyWithGooglePlay(purchaseToken);

  if (!verification.ok) {
    if (verification.reason === "config_missing") {
      // Explicit, loud failure — this must never silently fall back to
      // trusting the client. See required Supabase secret in the audit doc.
      log("verification_unavailable_missing_config", {});
      return json(503, {
        error: "verification_unavailable",
        message:
          "Purchase verification is not configured on the server. No entitlement was granted.",
      });
    }
    if (verification.reason === "not_found") {
      log("purchase_rejected_not_found", { uid, productId });
      return json(402, {
        error: "purchase_not_found",
        message: "Google Play did not recognize this purchase. No entitlement was granted.",
      });
    }
    log("purchase_verification_provider_error", { uid, productId });
    return json(503, {
      error: "verification_provider_error",
      message: "Could not verify this purchase with Google Play right now. Please try again shortly.",
    });
  }

  // ---- The token is real. Now confirm it is for the product being
  // claimed and that Play still considers it entitling.
  const productMatches = verification.lineItemProductIds.includes(productId);
  if (!productMatches) {
    log("purchase_rejected_product_mismatch", {
      uid,
      claimedProductId: productId,
      actualProductIds: verification.lineItemProductIds,
    });
    return json(402, {
      error: "product_mismatch",
      message: "This purchase does not match the requested product. No entitlement was granted.",
    });
  }

  if (!ENTITLING_STATES.has(verification.state)) {
    log("purchase_rejected_not_entitling", { uid, productId, state: verification.state });
    return json(402, {
      error: "purchase_not_active",
      message: "This subscription is not currently active.",
      subscriptionState: verification.state,
    });
  }

  // ---- Genuinely verified. Write the entitlement(s).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "backend_error", message: "Supabase service credentials missing" });
  }
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // claim_purchase_token enforces one-uid-per-token at the DB layer
    // (unique constraint) — see migration. This is the mitigation for the
    // "same real token replayed by a second account" gap noted above,
    // since this plugin version cannot bind a purchase to a uid at
    // purchase time on Google's side.
    const { data: claim, error: claimErr } = await sb.rpc("claim_purchase_token", {
      p_uid: uid,
      p_purchase_token: purchaseToken,
    });
    if (claimErr) {
      log("token_claim_failed", { uid, code: claimErr.code });
      return json(500, { error: "entitlement_write_failed", message: "Could not activate subscription" });
    }
    const claimed = !!(claim as { claimed?: boolean } | null)?.claimed;
    if (!claimed) {
      // Token already claimed by a DIFFERENT uid — reject, do not grant.
      log("token_already_claimed_by_other_uid", { uid, productId });
      return json(409, {
        error: "purchase_already_claimed",
        message: "This purchase has already been activated on a different account.",
      });
    }

    const expiresAt = verification.expiryTime; // null for non-expiring/lifetime-style; present for subs
    for (const key of grantedKeys) {
      const { error } = await sb.rpc("set_entitlement", {
        p_uid: uid,
        p_product_key: key,
        p_activate: true,
        p_purchase_token: purchaseToken,
        p_expires_at: expiresAt,
      });
      if (error) {
        log("set_entitlement_failed", { key, code: error.code });
        return json(500, { error: "entitlement_write_failed", message: "Could not activate subscription" });
      }
    }

    log("purchase_verified_and_granted", { uid, productId, state: verification.state });
    return json(200, {
      ok: true,
      productId,
      activated: grantedKeys,
      subscriptionState: verification.state,
      expiresAt,
    });
  } catch (e) {
    log("unexpected_error", { detail: String((e as Error)?.message || e).slice(0, 120) });
    return json(500, { error: "backend_error", message: "Internal error" });
  }
});
