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

function diag(...args) {
  try {
    // eslint-disable-next-line no-console
    console.log(...args);
  } catch (_) {
    /* ignore */
  }
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

/**
 * Classify HTTP errors with distinct codes so the UI does not map every
 * auth-related failure to a single "session expired" string.
 */
function classifyHttpError(status, data) {
  const errField = String(data?.error || data?.code || "");
  const msg = String(data?.message || data?.error || "");

  const known = new Set([
    "daily_limit",
    "busy",
    "gemini_rate_limited",
    "gemini_failed",
    "gemini_timeout",
    "gemini_not_configured",
    "empty_response",
    "usage_read_failed",
    "bad_request",
    "unauthenticated",
  ]);
  if (known.has(errField)) {
    if (errField === "unauthenticated") return "backend_unauthorized";
    return errField;
  }

  if (status === 401) return "backend_unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) {
    if (
      errField === "daily_limit" ||
      data?.code === "daily_limit" ||
      /daily.?limit|limit reached|رسائل/i.test(msg)
    ) {
      return "daily_limit";
    }
    if (/quota|resource.?exhausted|rate.?limit/i.test(msg) || errField === "quota") {
      return "gemini_rate_limited";
    }
    return "busy";
  }
  if (status === 503) return "busy";
  if (status === 504) return "gemini_timeout";
  if (status >= 500) {
    if (errField === "gemini_failed") return "gemini_failed";
    return "backend_error";
  }
  if (status >= 400) return "bad_request";
  return "backend_error";
}

/**
 * Call Supabase Edge Function ai-coach.
 * Uses Firebase ID token only in Authorization (CORS-safe).
 */
// Module-level lock: blocks concurrent generateCoachReply even if UI misses a busy flag.
let __aiCoachInFlight = false;

export async function generateCoachReply({
  messages,
  lang,
  userContext,
  localDate,
  hasAiPro,
}) {
  if (__aiCoachInFlight) {
    const err = new Error("Request already in progress");
    err.code = "busy";
    diag("[AI_COACH_FINAL_ERROR] code=busy reason=in_flight");
    throw err;
  }
  __aiCoachInFlight = true;
  try {
    const endpoint = resolveEndpoint();
    if (!endpoint) {
      const err = new Error("AI endpoint is not configured");
      err.code = "no_endpoint";
      diag("[AI_COACH_FINAL_ERROR] code=no_endpoint");
      throw err;
    }

    const user = auth.currentUser;
    if (!user) {
      diag("[AI_COACH_AUTH] currentUser=NULL");
      const err = new Error("Sign in required");
      err.code = "auth_missing";
      diag("[AI_COACH_FINAL_ERROR] code=auth_missing");
      throw err;
    }

    let idToken;
    try {
      idToken = await user.getIdToken(/* forceRefresh */ true);
      diag(
        "[AI_COACH_AUTH] token_obtained uid=" +
          String(user.uid) +
          " tokenLength=" +
          String(idToken ? idToken.length : 0),
      );
    } catch (e) {
      diag(
        "[AI_COACH_AUTH] getIdToken_FAILED " +
          String(e?.code || "") +
          " " +
          String(e?.message || e).slice(0, 120),
      );
      const err = new Error("Could not refresh session");
      err.code = "token_refresh_failed";
      diag("[AI_COACH_FINAL_ERROR] code=token_refresh_failed");
      throw err;
    }

    const recent = (messages || []).slice(-6);
    const lastUser =
      [...recent].reverse().find((m) => m && m.role === "user" && m.content) ||
      null;

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

    diag("[AI_COACH_HTTP] request_start");
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      diag(
        "[AI_COACH_HTTP] network_error=" +
          String(e?.message || e).slice(0, 160),
      );
      const err = new Error(e?.message || "Network error");
      err.code = "network";
      diag("[AI_COACH_FINAL_ERROR] code=network");
      throw err;
    }

    diag("[AI_COACH_HTTP] status=" + String(res.status));

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
      diag("[AI_COACH_FINAL_ERROR] code=" + code);
      throw err;
    }

    const reply = extractReply(data);
    if (!reply) {
      const err = new Error("Empty AI response");
      err.code = "empty_response";
      diag("[AI_COACH_FINAL_ERROR] code=empty_response");
      throw err;
    }

    diag("[AI_COACH_FINAL_ERROR] code=ok");
    return { reply: String(reply), usage };
  } finally {
    __aiCoachInFlight = false;
  }
}
