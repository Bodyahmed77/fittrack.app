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
  const used =
    usage.date === todayISO && Number.isFinite(Number(usage.count))
      ? Number(usage.count)
      : 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    date: todayISO,
    hasPro,
  };
}

function resolveEndpoint() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_AI_ENDPOINT__) {
    return String(window.__FIFTYFIT_AI_ENDPOINT__);
  }
  try {
    if (import.meta?.env?.VITE_AI_ENDPOINT) {
      return String(import.meta.env.VITE_AI_ENDPOINT);
    }
  } catch (e) {}
  return AI_COACH_ENDPOINT || "";
}

function resolveAnonKey() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_SUPABASE_ANON_KEY__) {
    return String(window.__FIFTYFIT_SUPABASE_ANON_KEY__);
  }
  try {
    if (import.meta?.env?.VITE_SUPABASE_ANON_KEY) {
      return String(import.meta.env.VITE_SUPABASE_ANON_KEY);
    }
  } catch (e) {}
  return SUPABASE_ANON_KEY || "";
}

function normalizeUsage(data, fallbackDate) {
  if (!data || typeof data !== "object") return null;
  if (data.usage && typeof data.usage === "object") {
    const u = data.usage;
    return {
      date: u.date || data.date || fallbackDate,
      count: u.count ?? u.used ?? null,
      used: u.used ?? u.count ?? null,
      limit: u.limit ?? data.limit ?? null,
      remaining:
        u.remaining != null
          ? u.remaining
          : data.remaining != null
            ? data.remaining
            : null,
      hasPro: u.hasPro ?? data.hasPro,
    };
  }
  if (
    data.remaining != null ||
    data.limit != null ||
    data.used != null ||
    data.count != null
  ) {
    return {
      date: data.date || fallbackDate,
      count: data.count ?? data.used ?? null,
      used: data.used ?? data.count ?? null,
      limit: data.limit ?? null,
      remaining: data.remaining != null ? data.remaining : null,
      hasPro: data.hasPro,
    };
  }
  return null;
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
  const msg = String(data?.message || data?.error || "");
  const errName = String(data?.error || data?.code || "");
  if (status === 401 || errName === "unauthenticated") return "unauthenticated";
  if (status === 403 || errName === "forbidden") return "forbidden";
  if (status === 429) {
    if (
      errName === "daily_limit" ||
      errName === "usage_limit" ||
      data?.code === "daily_limit" ||
      /daily.?limit|limit reached|رسائل|usage_limit/i.test(msg + errName)
    ) {
      return "daily_limit";
    }
    if (
      errName === "quota" ||
      errName === "gemini_error" ||
      /quota|resource.?exhausted/i.test(msg)
    ) {
      return "quota";
    }
    return "rate_limit";
  }
  if (errName === "gemini_error") return "backend_error";
  if (status >= 500) return "backend_error";
  if (status >= 400) return "bad_request";
  return "backend_error";
}

/**
 * Call Supabase Edge Function ai-coach.
 * Uses Firebase ID token only in Authorization (CORS-safe).
 * Do NOT send custom headers not listed in Access-Control-Allow-Headers —
 * browsers will abort the request and surface it as a network failure.
 */
export async function generateCoachReply({
  messages,
  lang,
  userContext,
  localDate,
  hasAiPro,
}) {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    const err = new Error("AI endpoint is not configured");
    err.code = "no_endpoint";
    throw err;
  }

  const user = auth.currentUser;
  if (!user) {
    const err = new Error("Sign in required");
    err.code = "unauthenticated";
    throw err;
  }

  let idToken;
  try {
    idToken = await user.getIdToken(/* forceRefresh */ false);
  } catch (e) {
    const err = new Error("Could not refresh session");
    err.code = "unauthenticated";
    throw err;
  }

  const recent = (messages || []).slice(-6);
  const lastUser =
    [...recent].reverse().find((m) => m && m.role === "user" && m.content) ||
    null;

  // ONLY headers allowed by Supabase CORS:
  // authorization, x-client-info, apikey, content-type
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
  const anon = resolveAnonKey();
  if (anon) headers.apikey = anon;

  const body = {
    messages: recent,
    message: lastUser ? String(lastUser.content) : "",
    lang: lang || "en",
    localDate: localDate || "",
    timeZone:
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
        : "",
    context: userContext || {},
    hasAiPro: !!hasAiPro,
    uid: user.uid,
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    // True network/CORS failure only — fetch threw before any HTTP response.
    const err = new Error(e?.message || "Network error");
    err.code = "network";
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  const usage = normalizeUsage(data, localDate);
  const code = classifyHttpError(res.status, data);

  if (!res.ok) {
    const err = new Error(
      data?.message || data?.error || `HTTP ${res.status}`,
    );
    err.code = code;
    err.status = res.status;
    if (code === "daily_limit") {
      err.usage = usage || {
        date: data?.date || localDate,
        count: data?.used ?? data?.count ?? 0,
        used: data?.used ?? data?.count ?? 0,
        limit: data?.limit,
        remaining: 0,
        hasPro: data?.hasPro,
      };
    }
    throw err;
  }

  const reply = extractReply(data);
  if (!reply) {
    const err = new Error("Empty AI response");
    err.code = "empty_response";
    throw err;
  }

  return { reply: String(reply), usage };
}
