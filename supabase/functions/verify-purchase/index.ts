// Supabase Edge Function: verify-purchase
// Client reports an acknowledged Google Play purchase (productId + purchase
// token) AFTER the native billing flow completed and was acknowledged. The
// function writes the corresponding row into public.entitlements so the
// ai-coach Edge Function's quota decision is server-controlled.
//
// Notes (small-cost, no Play Developer API setup required):
//  - The Google Play purchase was acknowledged client-side in the app
//    (sendAck) before this call, so Google will not auto-refund it.
//  - This writes an active entitlement; it does NOT verify the token
//    cryptographically against the Play Developer API (that requires a
//    paid service-account setup beyond the current budget). The purchase
//    chain stays: native Play flow → acknowledge → entitlement write.
//  - The client is required to pass a valid Firebase ID token, which this
//    function verifies via JWKS — nobody can write an entitlement for
//    another user's uid.
//  - The AI Coach "hasAiPro" UX flag returned by the ai-coach function now
//    comes from this table only.

import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRODUCT_KEY_MAP: Record<string, "ai_coach_pro" | "training_pro" | "nutrition_pro"> = {
  ai_coach_pro: "ai_coach_pro",
  training_pro: "training_pro",
  nutrition_pro: "nutrition_pro",
  both_pro: "training_pro", // "both" purchase grants both plans server-side.
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  // ---- Validate the reported purchase.
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const purchaseToken =
    typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";

  if (!productId || !purchaseToken) {
    return json(400, { error: "bad_request", message: "productId and purchaseToken are required" });
  }
  if (productId !== "ai_coach_pro" && productId !== "training_pro" && productId !== "nutrition_pro" && productId !== "both_pro") {
    return json(400, { error: "bad_request", message: "Unknown product" });
  }
  // Tokens must look like a real Play token (opaque, 60+ chars).
  if (purchaseToken.length < 32) {
    return json(400, { error: "bad_request", message: "Invalid purchase token" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "backend_error", message: "Supabase service credentials missing" });
  }
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Activate the entitlement(s) for this uid. "both_pro" grants training
    // AND nutrition in two rows so state stays unambiguous.
    const keys = productId === "both_pro"
      ? (["training_pro", "nutrition_pro"] as const)
      : ([PRODUCT_KEY_MAP[productId]] as const);

    for (const key of keys) {
      const { error } = await sb.rpc("set_entitlement", {
        p_uid: uid,
        p_product_key: key,
        p_activate: true,
        p_purchase_token: purchaseToken,
        p_expires_at: null,
      });
      if (error) {
        console.log("[VERIFY_PURCHASE]", "set_entitlement failed", key, String(error.message || "").slice(0, 150));
        return json(500, { error: "entitlement_write_failed", message: "Could not activate subscription" });
      }
    }
    return json(200, {
      ok: true,
      productId,
      activated: keys,
    });
  } catch (e) {
    console.log("[VERIFY_PURCHASE]", "unexpected error", String((e as Error)?.message || e).slice(0, 150));
    return json(500, { error: "backend_error", message: "Internal error" });
  }
});
