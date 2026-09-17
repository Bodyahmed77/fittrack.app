// ============================================================
// Server-side account deletion cleanup
// ============================================================
// Firebase Auth + Firestore deletion remains in App.jsx. This helper
// removes the user's Supabase-side data first, so the app never deletes
// the Firebase account while server-side entitlement/usage data remains.
// ============================================================

import { VERIFY_PURCHASE_ENDPOINT } from "./config";
import { auth } from "./firebase";

const DELETE_ACCOUNT_TIMEOUT_MS = 15000;

function deleteAccountEndpoint() {
  return (VERIFY_PURCHASE_ENDPOINT || "").replace(
    "/functions/v1/verify-purchase",
    "/functions/v1/delete-account",
  );
}

export async function deleteAccountServerData() {
  const endpoint = deleteAccountEndpoint();
  if (!endpoint) throw new Error("delete-account endpoint not configured");

  const user = auth.currentUser;
  if (!user) throw new Error("sign-in required");

  const idToken = await user.getIdToken(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELETE_ACCOUNT_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: "{}",
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok !== true) {
      const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
      err.code = data?.error || "delete_account_failed";
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("delete_account_timeout");
      timeoutError.code = "delete_account_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
