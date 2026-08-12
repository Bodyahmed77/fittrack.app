import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

async function assertAdmin(firebaseToken: string, uid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });
  if (!response.ok) return false;
  const body = await response.json();
  const role = firestoreString(body?.fields?.role);
  return role === "owner" || role === "staff";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return json(401, { error: "missing_authorization" });

    const firebaseToken = match[1];
    const callerUid = await verifyFirebaseIdToken(firebaseToken);
    if (!(await assertAdmin(firebaseToken, callerUid))) {
      return json(403, { error: "admin_required" });
    }

    const body = await req.json().catch(() => ({}));
    const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";
    if (!targetUid) return json(400, { error: "uid_required" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("entitlements")
      .select("product_key,purchase_state,expires_at,updated_at")
      .eq("uid", targetUid);

    if (error) {
      return json(500, { error: "entitlement_lookup_failed" });
    }

    const now = Date.now();
    const active = (data || []).filter((row) => {
      if (row.purchase_state !== "active") return false;
      if (!row.expires_at) return true;
      const expires = Date.parse(String(row.expires_at));
      return Number.isFinite(expires) ? expires > now : false;
    });

    const keys = new Set(active.map((row) => row.product_key));
    return json(200, {
      ok: true,
      uid: targetUid,
      source: "supabase_verified_entitlements",
      trainingPro: keys.has("training_pro"),
      nutritionPro: keys.has("nutrition_pro"),
      aiCoachPro: keys.has("ai_coach_pro"),
      entitlements: active.map((row) => ({
        productKey: row.product_key,
        purchaseState: row.purchase_state,
        expiresAt: row.expires_at || null,
        updatedAt: row.updated_at || null,
      })),
    });
  } catch (error) {
    console.error("admin-entitlements error", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
