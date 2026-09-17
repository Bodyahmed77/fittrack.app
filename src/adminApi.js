import { SUPABASE_ANON_KEY } from "./config";
import { auth } from "./firebase";

const ENDPOINT = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-api";

async function request(action, payload = {}) {
  const user = auth.currentUser;
  if (!user) {
    const error = new Error("Authentication required");
    error.code = "auth_missing";
    throw error;
  }
  const token = await user.getIdToken(false);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || !data?.ok) {
    const error = new Error(String(data?.message || data?.error || `Admin request failed (${response.status})`));
    error.code = String(data?.error || `http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data.data;
}

export const adminApi = {
  overview: () => request("overview"),
  reports: (status = "", limit = 50) => request("reports_list", { status, limit }),
  billing: (limit = 50) => request("billing_recent", { limit }),
  audit: (limit = 50) => request("audit_recent", { limit }),
  updateReport: (reportId, status) => request("report_update", { reportId, status }),
  updateUserAccount: (targetUid, name, phone) => request("user_account_update", { targetUid, name, phone }),
  updateUserPro: (targetUid, enabled) => request("user_pro_update", {
    targetUid,
    trainingPro: !!enabled,
    nutritionPro: !!enabled,
    aiCoachPro: !!enabled,
  }),
  updateUserEntitlements: (targetUid, changes = {}) => request("user_pro_update", {
    targetUid,
    trainingPro: changes.trainingPro,
    nutritionPro: changes.nutritionPro,
    aiCoachPro: changes.aiCoachPro,
    proExpiresAt: changes.proExpiresAt,
  }),
  sendNotification: (targetUid, title, message) => request("send_notification", { targetUid, title, message }),
};

export default adminApi;
