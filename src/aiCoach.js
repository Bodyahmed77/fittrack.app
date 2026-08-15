// ============================================================
// AI Coach — client (Supabase Edge Function + Firebase Auth)
// ============================================================
import { AI_COACH_ENDPOINT, FREE_AI_MESSAGES_PER_DAY, PRO_AI_MESSAGES_PER_DAY, SUPABASE_ANON_KEY } from "./config";
import { auth } from "./firebase";
import { queryProducts as billingQueryProducts } from "./billing";

let __keyboardPatchPromise = null;
async function ensureNativeKeyboardResize() {
  if (__keyboardPatchPromise) return __keyboardPatchPromise;
  __keyboardPatchPromise = (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { Keyboard } = await import("@capacitor/keyboard");
      if (!Keyboard) return;
      if (typeof Keyboard.setResizeMode === "function" && !Keyboard.__fiftyFitResizePatched) {
        const nativeSetResizeMode = Keyboard.setResizeMode.bind(Keyboard);
        Keyboard.setResizeMode = async () => nativeSetResizeMode({ mode: "native" });
        Keyboard.__fiftyFitResizePatched = true;
      }
      if (typeof Keyboard.addListener === "function" && !Keyboard.__fiftyFitListenerPatched) {
        const nativeAddListener = Keyboard.addListener.bind(Keyboard);
        Keyboard.addListener = (eventName, callback) => {
          if (["keyboardWillShow", "keyboardDidShow", "keyboardWillHide", "keyboardDidHide"].includes(eventName)) {
            queueMicrotask(() => { try { callback({ keyboardHeight: 0 }); } catch (_) {} });
            return { remove() {} };
          }
          return nativeAddListener(eventName, callback);
        };
        Keyboard.__fiftyFitListenerPatched = true;
      }
      if (typeof Keyboard.setResizeMode === "function") await Keyboard.setResizeMode({ mode: "native" });
    } catch {}
  })();
  return __keyboardPatchPromise;
}
ensureNativeKeyboardResize();

// Load the Play catalog early so the AI Coach limit dialog never falls back to
// a hard-coded USD/EGP price. Google Play is the only price authority on Android.
let __playCatalogPromise = null;
export function ensurePlayCatalogLoaded() {
  if (__playCatalogPromise) return __playCatalogPromise;
  __playCatalogPromise = Promise.resolve()
    .then(() => billingQueryProducts())
    .catch(() => null);
  return __playCatalogPromise;
}
ensurePlayCatalogLoaded();

export function aiDailyLimit(hasAiPro) {
  return hasAiPro ? PRO_AI_MESSAGES_PER_DAY : FREE_AI_MESSAGES_PER_DAY;
}

export function aiUsageToday(data, todayISO) {
  const hasPro = !!data?.entitlements?.aiCoachPro;
  const limit = aiDailyLimit(hasPro);
  const usage = data?.aiUsage || {};
  const used = usage.date === todayISO && Number.isFinite(Number(usage.count)) ? Number(usage.count) : 0;
  return { used, limit, remaining: Math.max(0, limit - used), date: todayISO, hasPro };
}

function resolveEndpoint() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_AI_ENDPOINT__) return String(window.__FIFTYFIT_AI_ENDPOINT__);
  try { if (import.meta?.env?.VITE_AI_ENDPOINT) return String(import.meta.env.VITE_AI_ENDPOINT); } catch {}
  return AI_COACH_ENDPOINT || "";
}
function resolveAnonKey() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_SUPABASE_ANON_KEY__) return String(window.__FIFTYFIT_SUPABASE_ANON_KEY__);
  try { if (import.meta?.env?.VITE_SUPABASE_ANON_KEY) return String(import.meta.env.VITE_SUPABASE_ANON_KEY); } catch {}
  return SUPABASE_ANON_KEY || "";
}
function normalizeUsage(data, fallbackDate) {
  if (!data || typeof data !== "object") return null;
  const u = data.usage && typeof data.usage === "object" ? data.usage : data;
  if (u.remaining == null && u.limit == null && u.used == null && u.count == null) return null;
  return { date: u.date || fallbackDate, count: u.count ?? u.used ?? null, used: u.used ?? u.count ?? null, limit: u.limit ?? null, remaining: u.remaining ?? null, hasPro: u.hasPro };
}
function extractReply(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.reply === "string") return data.reply;
  if (typeof data.message === "string" && !data.error) return data.message;
  if (typeof data.response === "string") return data.response;
  if (typeof data.text === "string") return data.text;
  if (typeof data.content === "string") return data.content;
  return "";
}
function classifyHttpError(status, data) {
  const code = String(data?.error || data?.code || "");
  if (code) return code === "unauthenticated" ? "backend_unauthorized" : code;
  if (status === 401) return "backend_unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "busy";
  if (status === 503) return "busy";
  if (status === 504) return "gemini_timeout";
  if (status >= 500) return "backend_error";
  if (status >= 400) return "bad_request";
  return "backend_error";
}

async function postAiRequest(endpoint, headers, body) {
  try {
    const core = await import("@capacitor/core");
    if (core?.Capacitor?.isNativePlatform?.() && core?.CapacitorHttp?.request) {
      const nativeResponse = await core.CapacitorHttp.request({ url: endpoint, method: "POST", headers, data: body });
      let data = nativeResponse?.data ?? null;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
      const status = Number(nativeResponse?.status || 0);
      return { status, ok: status >= 200 && status < 300, data };
    }
  } catch (e) {
    if (e?.code === "ERR_NAME_NOT_RESOLVED") throw e;
  }
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  let data = null;
  try { data = await response.json(); } catch {}
  return { status: response.status, ok: response.ok, data };
}

let __aiCoachInFlight = false;
function localISODateNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function generateCoachReply({ messages, lang, userContext, localDate, hasAiPro }) {
  if (__aiCoachInFlight) {
    const e = new Error("Request already in progress");
    e.code = "busy";
    throw e;
  }
  __aiCoachInFlight = true;
  try {
    await ensureNativeKeyboardResize();
    const endpoint = resolveEndpoint();
    if (!endpoint) { const e = new Error("AI endpoint is not configured"); e.code = "no_endpoint"; throw e; }
    const user = auth.currentUser;
    if (!user) { const e = new Error("Sign in required"); e.code = "auth_missing"; throw e; }

    const requestDate = localISODateNow();
    const idToken = await user.getIdToken(true);
    const recent = (messages || []).slice(-6);
    const lastUser = [...recent].reverse().find((m) => m?.role === "user" && m.content);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` };
    const anon = resolveAnonKey();
    if (anon) headers.apikey = anon;
    const body = { messages: recent, message: lastUser ? String(lastUser.content) : "", lang: lang || "en", localDate: requestDate, context: userContext || {} };

    let response = null;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await postAiRequest(endpoint, headers, body);
        if (response.status !== 503 || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    } catch (e) {
      const err = new Error(e?.message || "Network error");
      err.code = "network";
      throw err;
    }

    const data = response?.data || null;
    const usage = normalizeUsage(data, requestDate);
    if (!response?.ok) {
      const err = new Error(data?.message || data?.error || `HTTP ${response?.status || 0}`);
      err.code = classifyHttpError(response?.status || 0, data);
      err.status = response?.status || 0;
      if (err.code === "daily_limit") err.usage = usage;
      throw err;
    }
    const reply = extractReply(data);
    if (!reply) { const e = new Error("Empty AI response"); e.code = "empty_response"; throw e; }
    return { reply, usage };
  } finally {
    __aiCoachInFlight = false;
  }
}
