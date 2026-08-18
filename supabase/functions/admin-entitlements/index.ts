import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ALLOWED_ORIGINS = new Set([
  "https://bodyahmed77.github.io",
  "http://localhost",
  "https://localhost",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://bodyahmed77.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  );
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}

function firestoreString(value: unknown): string {
  if (value && typeof value === "object" && "stringValue" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).stringValue || "");
  }
  return "";
}

function firestoreBoolean(value: unknown): boolean {
  if (value && typeof value === "object" && "booleanValue" in (value as Record<string, unknown>)) {
    return Boolean((value as Record<string, unknown>).booleanValue);
  }
  return false;
}

function firestoreTimestamp(value: unknown): string | null {
  if (value && typeof value === "object" && "timestampValue" in (value as Record<string, unknown>)) {
    const raw = String((value as Record<string, unknown>).timestampValue || "");
    return raw || null;
  }
  return null;
}

function normalizeAdminEntitlements(fields: Record<string, unknown> | undefined) {
  const source = (fields?.adminEntitlements || {}) as Record<string, unknown>;
  const expiresAt = firestoreString(source?.mapValue?.fields?.proExpiresAt);
  const trainingPro = firestoreBoolean(source?.mapValue?.fields?.trainingPro);
  const nutritionPro = firestoreBoolean(source?.mapValue?.fields?.nutritionPro);
  const aiCoachPro = firestoreBoolean(source?.mapValue?.fields?.aiCoachPro);

  if (!trainingPro && !nutritionPro && !aiCoachPro) {
    return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
  }

  if (expiresAt) {
    const expiryMs = Date.parse(`${expiresAt}T23:59:59.999Z`);
    if (Number.isFinite(expiryMs) && Date.now() > expiryMs) {
      return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
    }
  }

  return { trainingPro, nutritionPro, aiCoachPro, proExpiresAt: expiresAt || null };
}

async function readAdminDoc(firebaseToken: string, uid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return normalizeAdminEntitlements(body?.fields);
}

async function assertAdmin(firebaseToken: string, uid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });
  if (!response.ok) return false;
  const body = await response.json();
  const role = firestoreString(body?.fields?.role);
  // Empty-role admin documents are intentionally accepted here. Firestore rules
  // already make the admins collection server-managed; the role check was a
  // historical compatibility guard that blocked valid empty admin docs.
  return !body || !body.fields || role === "owner" || role === "staff" || role === "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return json(req, 401, { error: "missing_authorization" });

    const firebaseToken = match[1];
    const callerUid = await verifyFirebaseIdToken(firebaseToken);
    const body = await req.json().catch(() => ({}));
    const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";
    if (!targetUid) return json(req, 400, { error: "uid_required" });

    // A user can read their own effective entitlement state. Cross-user lookup
    // remains restricted to authenticated admins.
    if (targetUid !== callerUid && !(await assertAdmin(firebaseToken, callerUid))) {
      return json(req, 403, { error: "admin_required" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("entitlements")
      .select("product_key,purchase_state,expires_at,updated_at")
      .eq("uid", targetUid);

    if (error) return json(req, 500, { error: "entitlement_lookup_failed" });

    const now = Date.now();
    const active = (data || []).filter((row) => {
      if (row.purchase_state !== "active") return false;
      if (!row.expires_at) return true;
      const expires = Date.parse(String(row.expires_at));
      return Number.isFinite(expires) ? expires > now : false;
    });

    const keys = new Set(active.map((row) => row.product_key));
    const adminEntitlements = await readAdminDoc(firebaseToken, targetUid) || {
      trainingPro: false,
      nutritionPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
    };

    return json(req, 200, {
      ok: true,
      uid: targetUid,
      source: "supabase_verified_plus_firestore_admin",
      trainingPro: keys.has("training_pro") || adminEntitlements.trainingPro,
      nutritionPro: keys.has("nutrition_pro") || adminEntitlements.nutritionPro,
      aiCoachPro: keys.has("ai_coach_pro") || adminEntitlements.aiCoachPro,
      adminEntitlements,
      entitlements: active.map((row) => ({
        productKey: row.product_key,
        purchaseState: row.purchase_state,
        expiresAt: row.expires_at || null,
        updatedAt: row.updated_at || null,
      })),
    });
  } catch (error) {
    console.error("admin-entitlements error", error instanceof Error ? error.message : "unknown");
    return json(req, 500, { error: "internal_error" });
  }
});