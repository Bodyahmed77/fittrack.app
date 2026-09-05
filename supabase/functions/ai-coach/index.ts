import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FREE_LIMIT = 3;
const PRO_LIMIT = 50;
const PRIMARY_MODEL = Deno.env.get("GEMINI_MODEL_PRIMARY") || Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = Deno.env.get("GEMINI_MODEL_FALLBACK") || "gemini-3.1-flash-lite";
const PRIMARY_TIMEOUT_MS = 12000;
const FALLBACK_TIMEOUT_MS = 12000;
const ADMIN_LOOKUP_TIMEOUT_MS = 1800;
const MAX_ISOLATE_IN_FLIGHT = Number(Deno.env.get("AI_MAX_CONCURRENT") || "8");
const OVERLOAD_COOLDOWN_MS = Number(Deno.env.get("AI_OVERLOAD_COOLDOWN_MS") || "5000");
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const IN_FLIGHT = { count: 0, failedAt: 0 };
const ADMIN_CACHE = new Map<string, { value: boolean; expiresAt: number }>();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function log(event: string, extra: Record<string, unknown> = {}) {
  try { console.log("[AI_COACH]", event, JSON.stringify(extra)); } catch { console.log("[AI_COACH]", event); }
}
function acquireLocalSlot() {
  if (IN_FLIGHT.failedAt && Date.now() - IN_FLIGHT.failedAt < OVERLOAD_COOLDOWN_MS) return false;
  if (IN_FLIGHT.count >= MAX_ISOLATE_IN_FLIGHT) { IN_FLIGHT.failedAt = Date.now(); return false; }
  IN_FLIGHT.count += 1;
  return true;
}
function releaseLocalSlot() { IN_FLIGHT.count = Math.max(0, IN_FLIGHT.count - 1); }
function utcDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function dateInTimeZone(timeZone: string | null | undefined) {
  const zone = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return utcDate();
  }
}
async function verifyFirebaseIdToken(idToken: string) {
  const jwks = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  const { payload } = await jose.jwtVerify(idToken, jwks, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in Firebase token");
  return String(uid);
}
type RpcClient = { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }> };
function rpc(sb: unknown) { return sb as RpcClient; }
function firestoreBool(v: unknown) {
  return !!(v && typeof v === "object" && "booleanValue" in (v as Record<string, unknown>) && (v as Record<string, unknown>).booleanValue === true);
}
function firestoreString(v: unknown) {
  if (!v || typeof v !== "object") return "";
  if ("stringValue" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).stringValue || "");
  if ("timestampValue" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).timestampValue || "");
  return "";
}
async function lookupAdminAiPro(uid: string, firebaseToken: string) {
  const cached = ADMIN_CACHE.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${firebaseToken}` }, signal: controller.signal });
    if (!response.ok) return false;
    const body = await response.json();
    const fields = body?.fields || {};
    const admin = fields?.adminEntitlements?.mapValue?.fields || {};
    const ai = firestoreBool(admin?.aiCoachPro);
    const expiresAt = firestoreString(admin?.proExpiresAt);
    if (expiresAt) {
      const expiryMs = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? Date.parse(`${expiresAt}T23:59:59.999Z`) : Date.parse(expiresAt);
      if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
        ADMIN_CACHE.set(uid, { value: false, expiresAt: Date.now() + 30000 });
        return false;
      }
    }
    const value = ai;
    ADMIN_CACHE.set(uid, { value, expiresAt: Date.now() + 30000 });
    return value;
  } catch (e) {
    log("admin_lookup_unavailable", { code: (e as Error)?.name || "error" });
    return false;
  } finally { clearTimeout(timer); }
}
async function lookupEntitlement(sb: unknown, uid: string, firebaseToken: string) {
  const { data, error } = await rpc(sb).rpc("get_ai_entitlement", { p_uid: uid });
  if (error) log("entitlement_lookup_failed", { code: error.code, message: String(error.message || "").slice(0, 120) });
  const verifiedPro = !!(data && (data as { has_ai_pro?: boolean }).has_ai_pro);
  if (verifiedPro) return true;
  return await lookupAdminAiPro(uid, firebaseToken);
}
async function callGemini(apiKey: string, model: string, prompt: string, timeoutMs: number, maxOutputTokens: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    log("gemini_request", { model, timeoutMs, maxOutputTokens });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens }, safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ] }),
    });
    const elapsedMs = Date.now() - started;
    const text = await response.text();
    if (!response.ok) {
      let providerCode = "";
      let providerMessage = "";
      try { const parsed = JSON.parse(text); providerCode = String(parsed?.error?.status || parsed?.error?.code || ""); providerMessage = String(parsed?.error?.message || ""); } catch {}
      log("gemini_response", { status: response.status, model, elapsedMs, providerCode });
      const code = response.status === 401 ? "gemini_unauthorized" : response.status === 403 ? "gemini_forbidden" : response.status === 404 ? "gemini_model_not_found" : response.status === 429 ? "gemini_rate_limited" : response.status >= 500 ? "gemini_provider_error" : "gemini_failed";
      return { ok: false as const, code, status: response.status, model, providerMessage };
    }
    const parsed = JSON.parse(text);
    const reply = parsed?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("").trim() || "";
    log("gemini_response", { status: 200, model, elapsedMs, replyLen: reply.length });
    if (!reply) return { ok: false as const, code: "empty_response", status: 200, model, providerMessage: "" };
    return { ok: true as const, reply, model };
  } catch (e) {
    const timedOut = (e as Error)?.name === "AbortError";
    log("gemini_response", { status: timedOut ? 0 : 503, model, elapsedMs: Date.now() - started, error: timedOut ? "timeout" : "network" });
    return { ok: false as const, code: timedOut ? "gemini_timeout" : "gemini_network_error", status: timedOut ? 504 : 503, model, providerMessage: String((e as Error)?.message || "").slice(0, 120) };
  } finally { clearTimeout(timer); }
}
async function generateWithFallback(apiKey: string, prompt: string, hasPro: boolean) {
  const maxOutputTokens = hasPro ? 1400 : 512;
  const first = await callGemini(apiKey, PRIMARY_MODEL, prompt, PRIMARY_TIMEOUT_MS, maxOutputTokens);
  if (first.ok) return first;
  if (first.code === "gemini_unauthorized" || first.code === "gemini_forbidden") return first;
  return await callGemini(apiKey, FALLBACK_MODEL, prompt, FALLBACK_TIMEOUT_MS, maxOutputTokens);
}
function buildCoachPrompt(lang: "ar" | "en", hasPro: boolean, contextBlock: string, historyText: string, userMessage: string) {
  const coachKnowledge = hasPro
    ? [
        "Use evidence-informed strength coaching principles: progressive overload, adequate weekly volume, exercise specificity, recovery, fatigue management, and sustainable adherence.",
        "For hypertrophy, reason about weekly hard-set volume, stable exercise selection, technique, load/reps, and proximity to failure; do not claim that every set must reach failure.",
        "For strength, prioritize skill practice, heavier loading appropriate to the user, sensible volume, and fatigue control.",
        "For fat loss, prioritize a sustainable calorie deficit, adequate protein, resistance training, activity, sleep, and adherence rather than crash dieting.",
        "Use RPE/RIR when helpful and explain trade-offs. Prefer practical progression rules over generic motivation.",
        "Use the user's history, goals, equipment, schedule, exercise performance, and recent consistency when they are present in context.",
      ].join(" ")
    : "Give concise beginner-friendly guidance using safe, evidence-informed general principles.";
  const system = lang === "ar"
    ? `أنت Fifty Fit Coach. ${hasPro ? "أنت مدرب متقدم لمشترك Pro." : "أنت المدرب الأساسي للمستخدم المجاني."} ${coachKnowledge} استخدم بيانات التطبيق فقط عندما تكون موجودة، ولا تخترع أرقاماً أو تاريخاً غير موجود. لا تقدم تشخيصاً طبياً أو بديلاً عن الطبيب. عند وجود إصابة أو أعراض مقلقة، وجّه المستخدم لمختص. كن واضحاً ومباشراً وعملياً. المستخدم العربي قد يستخدم اللهجة المصرية؛ يمكنك الرد بعربية طبيعية مفهومة.`
    : `You are Fifty Fit Coach. ${hasPro ? "You are the advanced coach for a Pro subscriber." : "You are the basic coach for a free user."} ${coachKnowledge} Use app data when available and never invent user metrics or history. Do not provide medical diagnosis; refer concerning symptoms or injuries to an appropriate clinician. Be practical, clear, and specific.`;
  const format = hasPro
    ? (lang === "ar"
      ? "لأسئلة الخطط والتمرين، أعطِ توصية عملية ثم السبب ثم خطوات التنفيذ أو التعديل. اربط الإجابة بأهدافه وبياناته إن وجدت. لا تكرر كلاماً عاماً عندما تستطيع الاستدلال من السياق."
      : "For training/planning questions, give a practical recommendation, the reasoning, then concrete execution or adjustment steps. Tie it to the user's goals and data when available; avoid generic filler.")
    : (lang === "ar" ? "خلّي الرد مختصراً ومفيداً وسهل التطبيق." : "Keep the answer concise and actionable.");
  return `${system}\n\nRESPONSE STYLE:\n${format}\n\nCURRENT FIFTY FIT CONTEXT:\n${contextBlock || "(none)"}\n\nRECENT CONVERSATION:\n${historyText || "(none)"}\n\nUSER QUESTION:\n${userMessage}\n\nCOACH:`;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "backend_error", message: "Supabase service credentials missing" });
  if (!acquireLocalSlot()) return json(503, { error: "provider_overloaded", message: "AI service is busy right now — please try again shortly" });
  const started = Date.now();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return json(401, { error: "unauthenticated", message: "Missing Bearer token" });
    const firebaseToken = match[1].trim();
    let uid = "";
    try { uid = await verifyFirebaseIdToken(firebaseToken); } catch { return json(401, { error: "unauthenticated", message: "Invalid or expired Firebase ID token" }); }
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch {}
    const lang = body.lang === "ar" ? "ar" : "en";
    const messages = Array.isArray(body.messages) ? (body.messages as Array<{ role?: string; content?: string }>).slice(-6) : [];
    const userMessage = typeof body.message === "string" ? body.message : messages.filter((m) => m?.role === "user").pop()?.content || "";
    if (!String(userMessage).trim()) return json(400, { error: "bad_request", message: "Message is required" });
    const localDate = dateInTimeZone(typeof body.timeZone === "string" ? body.timeZone : null);
    const hasPro = await lookupEntitlement(sb, uid, firebaseToken);
    const limit = hasPro ? PRO_LIMIT : FREE_LIMIT;
    const { data: usageData, error: usageError } = await rpc(sb).rpc("reserve_ai_usage", { p_uid: uid, p_date: localDate, p_limit: limit });
    if (usageError) {
      log("usage_reservation_failed", { code: usageError.code, message: String(usageError.message || "").slice(0, 160) });
      return json(503, { error: "usage_unavailable", message: "AI usage is temporarily unavailable" });
    }
    const usage = (usageData || {}) as { allowed?: boolean; used?: number; limit?: number; remaining?: number; date?: string };
    if (usage.allowed === false) return json(429, { error: "daily_limit", message: lang === "ar" ? `وصلت للحد اليومي (${limit} رسالة).` : `You reached your daily limit (${limit} messages).`, usage });
    const context = body.context && typeof body.context === "object" ? JSON.stringify(body.context).slice(0, 6000) : "";
    const historyText = messages.map((m) => `${String(m?.role || "user")}: ${String(m?.content || "")}`).join("\n").slice(-7000);
    const prompt = buildCoachPrompt(lang, hasPro, context, historyText, String(userMessage).slice(0, 4000));
    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!apiKey) {
      await rpc(sb).rpc("refund_ai_usage", { p_uid: uid, p_date: localDate });
      return json(500, { error: "backend_error", message: "AI provider key is not configured" });
    }
    const result = await generateWithFallback(apiKey, prompt, hasPro);
    if (!result.ok) {
      await rpc(sb).rpc("refund_ai_usage", { p_uid: uid, p_date: localDate });
      const status = result.status >= 500 ? 503 : result.status === 429 ? 503 : 500;
      return json(status, { error: result.code, message: result.providerMessage || "AI provider failed" });
    }
    return json(200, { ok: true, reply: result.reply, model: result.model, usage: { ...usage, used: Number(usage.used || 0), limit, remaining: Math.max(0, Number(usage.remaining ?? (limit - Number(usage.used || 0)))) }, localDate, elapsedMs: Date.now() - started });
  } finally {
    releaseLocalSlot();
  }
});
