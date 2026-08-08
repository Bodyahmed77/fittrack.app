// ============================================================
// AI Coach — client
// ============================================================
// Chat transcripts live ONLY in React state (session).
// Daily limits are enforced by the backend (Cloud Function).
// Client counters are for UI only and are synced from the server.
// The Gemini API key NEVER lives in this file or the app bundle.
// ============================================================

import {
  FREE_AI_MESSAGES_PER_DAY,
  PRO_AI_MESSAGES_PER_DAY,
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
  return "";
}

/**
 * Call our backend (which calls Gemini). Requires a signed-in Firebase user.
 * @returns {{ reply: string, usage?: object }}
 */
export async function generateCoachReply({
  messages,
  lang,
  userContext,
  localDate,
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

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        messages: recent,
        lang,
        localDate,
        context: userContext || {},
      }),
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

  if (res.status === 429 && data?.error === "daily_limit") {
    const err = new Error(data.message || "Daily limit reached");
    err.code = "daily_limit";
    err.usage = {
      date: data.date,
      count: data.used,
      used: data.used,
      limit: data.limit,
      remaining: 0,
      hasPro: data.hasPro,
    };
    throw err;
  }

  if (res.status === 401) {
    const err = new Error(data?.message || "Sign in required");
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

  if (!res.ok) {
    const err = new Error(
      data?.message || "AI service temporarily unavailable",
    );
    err.code = data?.error || "backend_error";
    throw err;
  }

  if (!data?.reply) {
    const err = new Error("Empty AI response");
    err.code = "empty_response";
    throw err;
  }

  return {
    reply: String(data.reply),
    usage: data.usage || null,
  };
}
