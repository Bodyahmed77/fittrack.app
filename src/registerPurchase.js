// ============================================================
// Register a completed Google Play purchase in the server-side
// entitlement store (public.entitlements in Postgres).
//
// The backend independently verifies the purchase with Google Play,
// grants the entitlement atomically, and acknowledges the subscription
// server-side. The Android client does not acknowledge purchases itself.
// ============================================================

import { onAuthStateChanged } from "firebase/auth";
import { VERIFY_PURCHASE_ENDPOINT } from "./config";
import { auth } from "./firebase";

const VERIFY_TIMEOUT_MS = 20000;
const SERVER_RETRY_DELAYS_MS = [800, 1800, 3500];
const AUTH_WAIT_MS = 12000;

// ------------------------------------------------------------------
// Cross-call-site dedup guard.
//
// registerServerEntitlement() is called from three independent places
// (direct purchase, manual "Restore Purchases", and the auto-restore
// effect that runs on every Firebase auth-state change, including
// token refreshes that happen mid-purchase). Without this guard, the
// same purchaseToken can be POSTed to verify-purchase multiple times
// concurrently from different call sites, multiplying retries and
// spamming the backend/Google (and confusingly, Google Play's
// "thank you for subscribing" email) for a single purchase.
//
// Two protections:
//   1. In-flight map: if a call for this exact token is already
//      running, piggyback on that same promise instead of starting a
//      new request chain.
//   2. Recently-succeeded set: if this token was verified successfully
//      in the last few minutes, short-circuit immediately without
//      hitting the network at all.
// ------------------------------------------------------------------
const RECENT_SUCCESS_TTL_MS = 5 * 60 * 1000;
const inFlightByToken = new Map();
const recentSuccessByToken = new Map();

function pruneRecentSuccess() {
  const now = Date.now();
  for (const [token, expiresAt] of recentSuccessByToken) {
    if (expiresAt <= now) recentSuccessByToken.delete(token);
  }
}

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

async function waitForFirebaseUser(timeoutMs = AUTH_WAIT_MS) {
  if (auth.currentUser) return auth.currentUser;

  writeServerDiagnostics({
    stage: "server_verification_waiting_for_auth",
    serverVerification: "waiting_for_auth",
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      writeServerDiagnostics({
        stage: "server_verification_auth_timeout",
        serverVerification: "failed",
      });
      finish(
        reject,
        Object.assign(
          new Error("Firebase authentication was not ready when the purchase completed"),
          { code: "sign_in_required", operationCode: "server_auth_not_ready" },
        ),
      );
    }, timeoutMs);

    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        // Keep waiting on the initial null callback; Capacitor/Firebase may
        // still be restoring the persisted session. Resolve only when a user
        // is actually available or the bounded timeout is reached.
        if (!user) return;
        writeServerDiagnostics({
          stage: "server_verification_auth_ready",
          serverVerification: "auth_ready",
        });
        finish(resolve, user);
      });
    } catch (error) {
      finish(reject, error);
    }
  });
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
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPurchase(endpoint, idToken, productId, purchaseToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  const requestId =
    globalThis.crypto?.randomUUID?.() ||
    `ff-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  writeServerDiagnostics({
    stage: "server_verification_request_started",
    serverVerification: "request_started",
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
      },
      body: JSON.stringify({ productId, purchaseToken, requestId }),
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
        serverVerification: "failed",
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
      serverVerification: "failed",
      productId,
      requestId,
      code: error?.code || "network_error",
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
  const dedupToken = extractToken(purchaseResult);

  if (dedupToken) {
    pruneRecentSuccess();

    if (recentSuccessByToken.has(dedupToken)) {
      writeServerDiagnostics({
        stage: "server_verification_skipped_recent_success",
        serverVerification: "verified_and_registered",
        productId,
      });
      return { ok: true, verified: true, productId, deduped: true };
    }

    const existing = inFlightByToken.get(dedupToken);
    if (existing) {
      writeServerDiagnostics({
        stage: "server_verification_joined_in_flight",
        serverVerification: "started",
        productId,
      });
      return existing;
    }

    const runPromise = registerServerEntitlementUncached(
      productId,
      reportedProductId,
      purchaseResult,
    )
      .then((data) => {
        recentSuccessByToken.set(dedupToken, Date.now() + RECENT_SUCCESS_TTL_MS);
        return data;
      })
      .finally(() => {
        inFlightByToken.delete(dedupToken);
      });

    inFlightByToken.set(dedupToken, runPromise);
    return runPromise;
  }

  return registerServerEntitlementUncached(productId, reportedProductId, purchaseResult);
}

async function registerServerEntitlementUncached(
  productId,
  reportedProductId,
  purchaseResult,
) {
  const endpoint = VERIFY_PURCHASE_ENDPOINT;
  if (!endpoint) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      code: "verify_endpoint_missing",
      message: "verify-purchase endpoint not configured",
    });
    throw Object.assign(new Error("verify-purchase endpoint not configured"), {
      code: "verify_endpoint_missing",
      operationCode: "server_endpoint_missing",
    });
  }

  const purchaseToken = extractToken(purchaseResult);
  if (!purchaseToken) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      code: "purchase_token_missing",
      message: "No purchase token was available after Google Play reported success",
    });
    throw Object.assign(new Error("no purchase token in billing result"), {
      code: "purchase_token_missing",
      operationCode: "server_purchase_token_missing",
    });
  }

  const serverProductId =
    extractProductId(purchaseResult) ||
    (isNonEmptyString(reportedProductId) ? reportedProductId.trim() : null) ||
    (isNonEmptyString(productId) ? productId.trim() : null);

  if (!serverProductId) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      code: "purchase_product_id_missing",
      message: "No Google Play product id was available",
    });
    throw Object.assign(new Error("no Google Play product id in billing result"), {
      code: "purchase_product_id_missing",
      operationCode: "server_product_id_missing",
    });
  }

  let user = auth.currentUser;
  if (!user) user = await waitForFirebaseUser();
  if (!user) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      code: "sign_in_required",
      message: "Firebase authentication is not available",
    });
    throw Object.assign(new Error("sign-in required"), {
      code: "sign_in_required",
      operationCode: "server_auth_not_ready",
    });
  }

  writeServerDiagnostics({
    stage: "server_verification_started",
    serverVerification: "started",
    productId: serverProductId,
    purchaseTokenPresent: true,
    authReady: true,
  });

  let idToken = await user.getIdToken(false);

  const sendWithRecovery = async () => {
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt <= SERVER_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        response = await postPurchase(endpoint, idToken, serverProductId, purchaseToken);
        lastError = null;
      } catch (error) {
        lastError = error;
      }

      if (!lastError) {
        if (response.status === 401) {
          idToken = await user.getIdToken(true);
          writeServerDiagnostics({
            stage: "server_verification_auth_refresh",
            serverVerification: "refreshing_auth",
            productId: serverProductId,
            httpStatus: 401,
            attempt: attempt + 1,
          });
          if (attempt < SERVER_RETRY_DELAYS_MS.length) continue;
        }
        if (!isRetryableServerStatus(response.status) || attempt >= SERVER_RETRY_DELAYS_MS.length) break;
      } else if (attempt >= SERVER_RETRY_DELAYS_MS.length) {
        break;
      }

      await sleep(SERVER_RETRY_DELAYS_MS[attempt]);
    }

    if (lastError) throw lastError;
    return response;
  };

  let res;
  try {
    res = await sendWithRecovery();
  } catch (error) {
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      productId: serverProductId,
      code: error?.code || "network_error",
      operationCode: error?.operationCode || "server_request_failed",
      message: error?.message || String(error),
      requestId: error?.requestId || null,
    });
    throw error;
  }

  const data = await res.json().catch(() => null);
  writeServerDiagnostics({
    stage: res.ok ? "server_verification_response_ok" : "server_verification_response_error",
    serverVerification: res.ok ? "response_ok" : "response_error",
    productId: serverProductId,
    httpStatus: res.status,
    backendCode: data?.error || null,
    backendRequestId: data?.requestId || null,
  });

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backend = data;
    err.productId = serverProductId;
    err.requestId = data?.requestId || null;
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      productId: serverProductId,
      code: err.code,
      httpStatus: res.status,
      requestId: err.requestId,
      message: err.message,
    });
    throw err;
  }

  writeServerDiagnostics({
    stage: "server_verification_succeeded",
    serverVerification: "verified_and_registered",
    productId: data?.productId || serverProductId,
    verified: data?.ok === true,
    backendRequestId: data?.requestId || null,
  });

  return {
    ...data,
    verified: data?.ok === true,
    productId: data?.productId || serverProductId,
  };
}
