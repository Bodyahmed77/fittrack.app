// ============================================================
// Register a completed Google Play purchase in the server-side
// entitlement store (public.entitlements in Postgres).
//
// The AI Coach Edge Function decides quotas from this table ONLY.
// This module reports a purchase AFTER the native billing flow
// completed. It server-verifies the token against Google Play first,
// then acknowledges the purchase. That ordering prevents an
// acknowledged-but-unverified purchase from becoming the recovery path.
// ============================================================

import { VERIFY_PURCHASE_ENDPOINT } from "./config";
import { auth } from "./firebase";

async function getBillingPlugin() {
  try {
    const mod = await import(/* @vite-ignore */ "capacitor-billing");
    return mod?.BillingPlugin || mod?.default || null;
  } catch (e) {
    console.warn("[Billing] native plugin unavailable for acknowledgement", e);
    return null;
  }
}

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

async function acknowledgePurchaseToken(purchaseToken) {
  const billing = await getBillingPlugin();
  if (!billing) {
    return { acknowledged: false, code: "ack_plugin_unavailable" };
  }

  const ack = async () => {
    if (typeof billing.sendAck === "function") {
      await billing.sendAck({ purchaseToken });
      return;
    }
    if (typeof billing.acknowledgePurchase === "function") {
      await billing.acknowledgePurchase({ purchaseToken });
      return;
    }
    const err = new Error("Google Play acknowledgement is unavailable");
    err.code = "ack_unavailable";
    throw err;
  };

  try {
    await ack();
    return { acknowledged: true, code: null };
  } catch (firstError) {
    // A transient Play/service disconnect should not leave a verified purchase
    // permanently unacknowledged. Retry once; the server entitlement is already
    // authoritative and remains valid while Play completes the acknowledgement.
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await ack();
      return { acknowledged: true, code: null };
    } catch (secondError) {
      return {
        acknowledged: false,
        code: String(secondError?.code || firstError?.code || "ack_failed"),
        message: String(secondError?.message || firstError?.message || "Acknowledgement failed"),
      };
    }
  }
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

  const ack = await acknowledgePurchaseToken(purchaseToken);
  if (!ack.acknowledged) {
    // Do not roll back a server-verified entitlement because Play acknowledgement
    // had a transient client-side failure. The next restore/login flow will retry.
    console.warn("[Billing] server entitlement granted but acknowledgement is pending", {
      productId: serverProductId,
      code: ack.code,
      message: ack.message || null,
    });
  }

  return {
    ...data,
    acknowledged: ack.acknowledged,
    acknowledgementError: ack.acknowledged ? null : ack.code,
  };
}
