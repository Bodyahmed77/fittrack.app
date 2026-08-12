// ============================================================
// AI Coach — client (Supabase Edge Function + Firebase Auth)
// ============================================================
// Chat transcripts live ONLY in React state (session).
// Daily limits are enforced server-side by the Edge Function.
// GEMINI_API_KEY must NEVER appear in this file or the app bundle.
// ============================================================

import {
  AI_COACH_ENDPOINT,
  FREE_AI_MESSAGES_PER_DAY,
  PRO_AI_MESSAGES_PER_DAY,
  SUPABASE_ANON_KEY,
} from "./config";
import { auth } from "./firebase";

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
function diag(...args) { if (import.meta?.env?.DEV) console.log(...args); }

function normalizeUsage(data, fallbackDate) {
  if (!data || typeof data !== "object") return null;
  const u = data.usage && typeof data.usage === "object" ? data.usage : data;
  if (u.remaining == null && u.limit == null && u.used == null && u.count == null) return null;
  return {
    date: u.date || fallbackDate,
    count: u.count ?? u.used ?? null,
    used: u.used ?? u.count ?? null,
    limit: u.limit ?? null,
    remaining: u.remaining ?? null,
    hasPro: u.hasPro,
  };
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

let __aiCoachInFlight = false;

export async function generateCoachReply({ messages, lang, userContext, localDate, hasAiPro }) {
  if (__aiCoachInFlight) { const e = new Error("Request already in progress"); e.code = "busy"; throw e; }
  __aiCoachInFlight = true;
  try {
    const endpoint = resolveEndpoint();
    if (!endpoint) { const e = new Error("AI endpoint is not configured"); e.code = "no_endpoint"; throw e; }
    const user = auth.currentUser;
    if (!user) { const e = new Error("Sign in required"); e.code = "auth_missing"; throw e; }

    const idToken = await user.getIdToken(true);
    const recent = (messages || []).slice(-6);
    const lastUser = [...recent].reverse().find((m) => m?.role === "user" && m.content);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` };
    const anon = resolveAnonKey();
    if (anon) headers.apikey = anon;

    const body = {
      messages: recent,
      message: lastUser ? String(lastUser.content) : "",
      lang: lang || "en",
      localDate: localDate || "",
      context: userContext || {},
    };

    let res;
    try {
      // One short retry only for transient backend overload. No client retry storm.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
        if (res.status !== 503 || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    } catch (e) {
      const err = new Error(e?.message || "Network error"); err.code = "network"; throw err;
    }

    let data = null;
    try { data = await res.json(); } catch {}
    const usage = normalizeUsage(data, localDate);
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
      err.code = classifyHttpError(res.status, data);
      err.status = res.status;
      if (err.code === "daily_limit") err.usage = usage;
      diag("[AI_COACH_FINAL_ERROR]", err.code, res.status);
      throw err;
    }

    const reply = extractReply(data);
    if (!reply) { const e = new Error("Empty AI response"); e.code = "empty_response"; throw e; }
    return { reply, usage };
  } finally {
    __aiCoachInFlight = false;
  }
}
