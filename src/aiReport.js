import { AI_REPORT_ENDPOINT, SUPABASE_ANON_KEY } from "./config";
import { auth } from "./firebase";

const REPORT_TIMEOUT_MS = 10000;
const RETRY_DELAYS_MS = [700];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postReport(endpoint, headers, body) {
  try {
    const core = await import("@capacitor/core");
    if (core?.Capacitor?.isNativePlatform?.() && core?.CapacitorHttp?.request) {
      const response = await core.CapacitorHttp.request({
        url: endpoint,
        method: "POST",
        headers,
        data: body,
        connectTimeout: REPORT_TIMEOUT_MS,
        readTimeout: REPORT_TIMEOUT_MS,
      });
      let data = response?.data ?? null;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (_) {}
      }
      const status = Number(response?.status || 0);
      return { status, ok: status >= 200 && status < 300, data };
    }
  } catch (error) {
    // Native networking failures are surfaced to the retry loop below.
    if (error?.code) throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    return { status: response.status, ok: response.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function reportAiContent({ response, reason, lang, model }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");
  const endpoint = String(AI_REPORT_ENDPOINT || "").trim();
  if (!endpoint) throw new Error("AI report endpoint is not configured");

  const token = await user.getIdToken(true);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;

  const body = {
    response: String(response || "").trim().slice(0, 2000),
    reason: String(reason || "").trim().slice(0, 500),
    lang: lang === "ar" ? "ar" : "en",
    model: String(model || "").trim().slice(0, 120) || null,
  };
  if (!body.response || !body.reason) throw new Error("Report details are required");

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const result = await postReport(endpoint, headers, body);
      if (result.ok) return result.data || { ok: true };
      const code = result?.data?.error || `HTTP ${result.status}`;
      const error = new Error(String(result?.data?.message || code));
      error.code = String(code);
      error.status = result.status;
      lastError = error;
      if (![429, 502, 503, 504].includes(result.status) || attempt >= RETRY_DELAYS_MS.length) throw error;
    } catch (error) {
      lastError = error;
      const retryable = error?.name === "AbortError" || [429, 502, 503, 504].includes(Number(error?.status));
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  throw lastError || new Error("AI report failed");
}
