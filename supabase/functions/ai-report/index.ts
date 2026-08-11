import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  const { payload } = await jose.jwtVerify(idToken, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: "unauthenticated" });
  let uid: string;
  try { uid = await verifyFirebaseIdToken(match[1].trim()); } catch { return json(401, { error: "unauthenticated" }); }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const response = typeof body.response === "string" ? body.response.trim().slice(0, 2000) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const lang = body.lang === "ar" ? "ar" : "en";
  if (!response || !reason) return json(400, { error: "bad_request" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "backend_error" });
  const sb = createClient(url, serviceKey);
  const { error } = await sb.from("ai_reports").insert({ uid, response_text: response, reason, lang });
  if (error) return json(500, { error: "backend_error" });
  return json(200, { ok: true });
});
