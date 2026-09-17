import { SUPABASE_ANON_KEY } from "./config";
import { auth } from "./firebase";

const ENDPOINT = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-api";
const REQUEST_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function post(action, payload, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok || !data?.ok) {
      const error = new Error(
        String(data?.message || data?.error || `Admin request failed (${response.status})`),
      );
      error.code = String(data?.error || `http_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

async function request(action, payload = {}) {
  const user = auth.currentUser;
  if (!user) {
    const error = new Error("Authentication required");
    error.code = "auth_missing";
    throw error;
  }

  let token = await user.getIdToken(false);
  try {
    return await post(action, payload, token);
  } catch (error) {
    if (Number(error?.status) !== 401) throw error;
    await sleep(150);
    token = await user.getIdToken(true);
    return await post(action, payload, token);
  }
}

export const adminApi = {
  overview: () => request("overview"),
  searchUsers: (email) => request("users_search", { email }),
  reports: (status = "", limit = 50) => request("reports_list", { status, limit }),
  billing: (limit = 50) => request("billing_recent", { limit }),
  audit: (limit = 50) => request("audit_recent", { limit }),
  updateReport: (reportId, status) => request("report_update", { reportId, status }),
  updateUserAccount: (targetUid, name, phone) =>
    request("user_account_update", { targetUid, name, phone }),
  updateUserPro: (targetUid, enabled) =>
    request("user_pro_update", {
      targetUid,
      trainingPro: !!enabled,
      nutritionPro: !!enabled,
      aiCoachPro: !!enabled,
    }),
  updateUserEntitlements: (targetUid, changes = {}) =>
    request("user_pro_update", {
      targetUid,
      trainingPro: changes.trainingPro,
      nutritionPro: changes.nutritionPro,
      aiCoachPro: changes.aiCoachPro,
      proExpiresAt: changes.proExpiresAt,
    }),
  sendNotification: (targetUid, title, message) =>
    request("send_notification", { targetUid, title, message }),
};

export default adminApi;
