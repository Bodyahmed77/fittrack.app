// ============================================================
// Register a completed Google Play purchase in the server-side
// entitlement store (public.entitlements in Postgres).
//
// The backend independently verifies the purchase with Google Play,
// grants the entitlement atomically, and acknowledges the subscription
// server-side. The Android client does not acknowledge purchases itself.
// ============================================================

import { VERIFY_PURCHASE_ENDPOINT } from "./config";
import { auth } from "./firebase";

const VERIFY_TIMEOUT_MS = 20000;

function extractToken(purchaseResult) {
  if (!purchaseResult || typeof purchaseResult !== "object") return null;
  const direct =
    purchaseResult.purchaseToken ||
    purchaseResult.token ||
    purchaseResult.purchase?.purchaseToken ||
    purchaseResult.product?.purchaseToken;
  if (typeof direct === "string" && direct) return direct;
  const nested = purchaseResult.result;
  if (nested && typeof nested === "object") return extractToken(nested);
  return null;
}

async function postPurchase(endpoint, idToken, productId, purchaseToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ productId, purchaseToken }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeout = new Error(
        "Google Play purchase verification timed out after 20 seconds",
      );
      timeout.code = "PURCHASE_VERIFICATION_TIMEOUT";
      timeout.operationCode = "server_verification_timeout";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function registerServerEntitlement(
  productId,
  reportedProductId,
  purchaseResult,
) {
  const endpoint = VERIFY_PURCHASE_ENDPOINT;
  if (!endpoint) {
    throw Object.assign(new Error("verify-purchase endpoint not configured"), {
      code: "verify_endpoint_missing",
    });
  }

  const user = auth.currentUser;
  if (!user) {
    throw Object.assign(new Error("sign-in required"), {
      code: "sign_in_required",
    });
  }

  const purchaseToken = extractToken(purchaseResult);
  if (!purchaseToken) {
    throw Object.assign(new Error("no purchase token in billing result"), {
      code: "purchase_token_missing",
    });
  }

  const serverProductId = reportedProductId || productId;
  let idToken = await user.getIdToken(false);
  let res = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);

  // Firebase ID tokens are short-lived. A long-running checkout flow can
  // cross an expiration boundary, so retry exactly once with a refreshed
  // token when the backend explicitly reports authentication failure.
  if (res.status === 401) {
    idToken = await user.getIdToken(true);
    res = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backend = data;
    throw err;
  }
  return data;
}
