const PRIMARY_MODEL = Deno.env.get("GEMINI_MODEL_PRIMARY") || Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = Deno.env.get("GEMINI_MODEL_FALLBACK") || "gemini-3.1-flash-lite";
const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fiftyfit-health-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function probeGemini(model: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) return { configured: false, model, status: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      },
    );
    return { configured: true, model, status: response.status, ok: response.ok };
  } catch (error) {
    return {
      configured: true,
      model,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.name : "error",
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { ok: false, error: "method_not_allowed" });

  // Public callers receive only a liveness response. Configuration details
  // and provider probing are operator-only to avoid leaking infrastructure
  // details or creating a public Gemini quota probe.
  const probeSecret = Deno.env.get("FIFTYFIT_HEALTH_PROBE_SECRET") || "";
  const suppliedSecret = req.headers.get("X-FiftyFit-Health-Secret") || "";
  if (!probeSecret || suppliedSecret !== probeSecret) return json(200, { ok: true });

  const primary = await probeGemini(PRIMARY_MODEL);
  const fallback = primary.ok ? null : await probeGemini(FALLBACK_MODEL);
  return json(200, {
    ok: true,
    projectIdConfigured: !!PROJECT_ID,
    supabaseUrlConfigured: !!SUPABASE_URL,
    serviceRoleConfigured: !!SUPABASE_SERVICE_ROLE_KEY,
    geminiKeyConfigured: !!Deno.env.get("GEMINI_API_KEY"),
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    primary,
    fallback,
  });
});
