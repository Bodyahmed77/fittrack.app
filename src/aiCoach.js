// ============================================================
// AI Coach — client (Supabase Edge Function + Firebase Auth)
// ============================================================
// Chat transcripts live ONLY in React state (session).
// Daily limits are enforced by the Supabase Edge Function.
// Client counters are for UI only and are synced from the server.
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

/** UI helper from last known usage (server is authoritative after each send). */
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
  if (typeof data.message === "string" && data.error == null) return data.message;
  if (typeof data.response === "string") return data.response;
  if (typeof data.text === "string") return data.text;
  if (typeof data.content === "string") return data.content;
  return "";
}

/**
 * Call Supabase Edge Function `ai-coach` (which calls Gemini server-side).
 * Auth: Firebase ID token in Authorization (app auth is Firebase, not Supabase Auth).
 * Optional public Supabase anon key in `apikey` header for the Supabase gateway.
 *
 * @returns {{ reply: string, usage?: object }}
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
    idToken = await user.getIdToken();
  } catch (e) {
    const err = new Error("Could not refresh session");
    err.code = "unauthenticated";
    throw err;
  }

  // Cost control: only recent turns
  const recent = (messages || []).slice(-6);
  const lastUser =
    [...recent].reverse().find((m) => m && m.role === "user" && m.content) ||
    null;

  const headers = {
    "Content-Type": "application/json",
    // Firebase ID token — Edge Function must verify this (verify_jwt=false on gateway)
    Authorization: `Bearer ${idToken}`,
    // Backup header some backends use so gateway JWT check can use anon key instead
    "X-Firebase-Token": idToken,
  };

  const anon = resolveAnonKey();
  if (anon) {
    headers.apikey = anon;
  }

  // Body: support both our contract (messages[]) and simple (message string)
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
    const err = new Error("Network error");
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

  // Daily limit (server authoritative)
  if (
    res.status === 429 &&
    (data?.error === "daily_limit" ||
      data?.code === "daily_limit" ||
      /limit/i.test(String(data?.error || data?.message || "")))
  ) {
    const err = new Error(
      data?.message || data?.error || "Daily limit reached",
    );
    err.code = "daily_limit";
    err.usage = usage || {
      date: data?.date || localDate,
      count: data?.used ?? data?.count ?? 0,
      used: data?.used ?? data?.count ?? 0,
      limit: data?.limit,
      remaining: 0,
      hasPro: data?.hasPro,
    };
    throw err;
  }

  if (res.status === 401 || res.status === 403) {
    const err = new Error(
      data?.message ||
        data?.error ||
        "Unauthorized — check Firebase token / Supabase function JWT settings",
    );
    err.code = "unauthenticated";
    throw err;
  }

  if (res.status === 429) {
    const err = new Error(
      data?.message || "AI is busy — try again in a minute",
    );
    err.code = "rate_limit";
    throw err;
  }

  if (res.status >= 500) {
    const err = new Error(
      data?.message || "AI service temporarily unavailable",
    );
    err.code = "backend_error";
    throw err;
  }

  if (res.status >= 400) {
    const err = new Error(
      data?.message || data?.error || "Bad request to AI service",
    );
    err.code = data?.error || "bad_request";
    throw err;
  }

  const reply = extractReply(data);
  if (!reply) {
    const err = new Error("Empty AI response");
    err.code = "empty_response";
    throw err;
  }

  return {
    reply: String(reply),
    usage,
  };
}
