// ============================================================
// Register a completed Google Play purchase in the server-side
// entitlement store (public.entitlements in Postgres).
//
// The ai-coach Edge Function decides quotas from this table ONLY.
// This module reports a purchase AFTER the native billing flow
// completed AND the purchase was acknowledged to Google Play, so
// the entitlement write is backed by a real acknowledged purchase.
// ============================================================

import { VERIFY_PURCHASE_ENDPOINT } from "./config";
import { auth } from "./firebase";

function extractToken(purchaseResult) {
  if (!purchaseResult || typeof purchaseResult !== "object") return null;
  // purchaseToken may sit at several levels depending on the plugin shape.
  const direct =
    purchaseResult.purchaseToken ||
    purchaseResult.purchase?.purchaseToken ||
    purchaseResult.product?.purchaseToken;
  if (typeof direct === "string" && direct) return direct;
  const nested = purchaseResult.result;
  if (nested && typeof nested === "object") return extractToken(nested);
  return null;
}

async function postVerifiedPurchase(endpoint, idToken, productId, purchaseToken) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      productId,
      purchaseToken,
    }),
  });
}

export async function registerServerEntitlement(
  productId,
  reportedProductId,
  purchaseResult,
) {
  const endpoint = VERIFY_PURCHASE_ENDPOINT;
  if (!endpoint) {
    throw new Error("verify-purchase endpoint not configured");
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error("sign-in required");
  }

  const purchaseToken = extractToken(purchaseResult);
  if (!purchaseToken) {
    throw new Error("no purchase token in billing result");
  }

  const claimedProductId = reportedProductId || productId;
  let idToken = await user.getIdToken(false);
  let res = await postVerifiedPurchase(endpoint, idToken, claimedProductId, purchaseToken);

  // Firebase ID tokens are short-lived. If the backend rejects an otherwise
  // valid session with 401, refresh exactly once and retry rather than turning
  // a valid Play purchase into a misleading entitlement/backend failure.
  if (res.status === 401) {
    idToken = await user.getIdToken(true);
    res = await postVerifiedPurchase(endpoint, idToken, claimedProductId, purchaseToken);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backendResponse = data;
    throw err;
  }
  return data;
}
