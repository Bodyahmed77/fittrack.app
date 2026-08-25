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
const SERVER_RETRY_DELAYS_MS = [800, 1800];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function writeServerDiagnostics(patch) {
  if (typeof window === "undefined") return;
  try {
    window.__fiftyFitBillingDiagnostics = {
      ...(window.__fiftyFitBillingDiagnostics || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  } catch (_) {}
}

function extractToken(purchaseResult) {
  if (!purchaseResult || typeof purchaseResult !== "object") return null;
  const direct =
    purchaseResult.purchaseToken ||
    purchaseResult.token ||
    purchaseResult.purchase?.purchaseToken ||
    purchaseResult.product?.purchaseToken;
  if (isNonEmptyString(direct)) return direct.trim();
  const nested = purchaseResult.result;
  if (nested && typeof nested === "object") return extractToken(nested);
  return null;
}

function extractProductId(purchaseResult) {
  if (!purchaseResult || typeof purchaseResult !== "object") return null;
  const direct =
    purchaseResult.productId ||
    purchaseResult.product ||
    purchaseResult.sku ||
    (Array.isArray(purchaseResult.products) ? purchaseResult.products[0] : null) ||
    (Array.isArray(purchaseResult.productIds) ? purchaseResult.productIds[0] : null);
  if (isNonEmptyString(direct)) return direct.trim();
  const nested = purchaseResult.result;
  if (nested && typeof nested === "object") return extractProductId(nested);
  return null;
}

function isRetryableServerStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPurchase(endpoint, idToken, productId, purchaseToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  const requestId = globalThis.crypto?.randomUUID?.() || `ff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeServerDiagnostics({
    stage: "server_verification_request_started",
    productId,
    requestId,
    purchaseTokenPresent: !!purchaseToken,
  });
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "X-FiftyFit-Purchase-Request": requestId,
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
      timeout.requestId = requestId;
      writeServerDiagnostics({
        stage: "server_verification_timeout",
        productId,
        requestId,
        code: timeout.code,
        message: timeout.message,
      });
      throw timeout;
    }
    error.requestId = requestId;
    writeServerDiagnostics({
      stage: "server_verification_network_error",
      productId,
      requestId,
      code: error?.code || "network_error",
      nativeCode: error?.nativeCode || null,
      message: error?.message || String(error),
    });
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
    writeServerDiagnostics({
      stage: "server_verification_failed",
      code: "verify_endpoint_missing",
      message: "verify-purchase endpoint not configured",
    });
    throw Object.assign(new Error("verify-purchase endpoint not configured"), {
      code: "verify_endpoint_missing",
    });
  }

  const user = auth.currentUser;
  if (!user) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      code: "sign_in_required",
      message: "Firebase auth.currentUser is missing during purchase registration",
    });
    throw Object.assign(new Error("sign-in required"), {
      code: "sign_in_required",
    });
  }

  const purchaseToken = extractToken(purchaseResult);
  if (!purchaseToken) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      code: "purchase_token_missing",
      message: "No purchase token was available after Google Play reported success",
    });
    throw Object.assign(new Error("no purchase token in billing result"), {
      code: "purchase_token_missing",
    });
  }

  // Never allow an object such as BILLING_PRODUCTS.training to become the
  // productId sent to the backend. Prefer the actual product returned by
  // Google Play, then the explicitly reported id, then the caller fallback.
  const serverProductId =
    extractProductId(purchaseResult) ||
    (isNonEmptyString(reportedProductId) ? reportedProductId.trim() : null) ||
    (isNonEmptyString(productId) ? productId.trim() : null);

  if (!serverProductId) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      code: "purchase_product_id_missing",
      message: "No Google Play product id was available",
    });
    throw Object.assign(new Error("no Google Play product id in billing result"), {
      code: "purchase_product_id_missing",
    });
  }

  let idToken = await user.getIdToken(false);

  const sendWithRecovery = async () => {
    let response = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);

    if (response.status === 401) {
      idToken = await user.getIdToken(true);
      writeServerDiagnostics({
        stage: "server_verification_auth_refresh",
        productId: serverProductId,
        httpStatus: 401,
      });
      response = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);
    }

    for (
      let attempt = 0;
      attempt < SERVER_RETRY_DELAYS_MS.length && isRetryableServerStatus(response.status);
      attempt += 1
    ) {
      await sleep(SERVER_RETRY_DELAYS_MS[attempt]);
      response = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);
      if (response.status === 401) {
        idToken = await user.getIdToken(true);
        writeServerDiagnostics({
          stage: "server_verification_auth_refresh",
          productId: serverProductId,
          httpStatus: 401,
          retryAttempt: attempt + 1,
        });
        response = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);
      }
    }

    return response;
  };

  const res = await sendWithRecovery();
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backend = data;
    err.productId = serverProductId;
    err.requestId = data?.requestId || null;
    writeServerDiagnostics({
      stage: "server_verification_failed",
      productId: serverProductId,
      code: err.code,
      httpStatus: err.httpStatus,
      requestId: err.requestId,
      message: err.message,
      backendError: data?.error || null,
      backendMessage: data?.message || null,
    });
    throw err;
  }

  writeServerDiagnostics({
    stage: "server_verification_succeeded",
    productId: data?.productId || serverProductId,
    verified: data?.ok === true,
    backendStatus: data?.status || null,
    backendState: data?.purchaseState || data?.subscriptionState || null,
    requestId: data?.requestId || null,
  });

  return {
    ...data,
    verified: data?.ok === true,
    productId: data?.productId || serverProductId,
  };
}
