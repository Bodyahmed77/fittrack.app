import { registerPlugin } from "@capacitor/core";

// Fifty Fit owns this runtime bridge. The Android implementation is injected
// into the generated Capacitor project by scripts/inject-fiftyfit-billing-v2.py.
// This intentionally does not import capacitor-billing at runtime.
const NativeBillingPlugin = registerPlugin("FiftyFitBilling");

const BILLING_OPERATION_TIMEOUT_MS = 15000;
const BILLING_LAUNCH_TIMEOUT_MS = 30000;

function timeoutError(code, operation, message) {
  const error = new Error(message);
  error.code = code;
  error.responseCode = null;
  error.nativeCode = null;
  error.nativeMessage = message;
  error.operationCode = operation;
  return error;
}

function withTimeout(promise, ms, code, operation, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(timeoutError(code, operation, message)),
      ms,
    );
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function launchWithRecovery(options) {
  try {
    return await withTimeout(
      NativeBillingPlugin.launchBillingFlow(options),
      BILLING_LAUNCH_TIMEOUT_MS,
      "NATIVE_PURCHASE_FLOW_TIMEOUT",
      "purchase_update_timeout",
      "Google Play billing launch did not produce a native purchase callback within 30 seconds",
    );
  } catch (error) {
    // A purchase can succeed even when the foreground callback is missed
    // (for example, a Play/network transition). Re-query active subscriptions
    // before declaring the purchase lost. This follows Google's guidance to
    // use queryPurchasesAsync as a recovery path for missed purchase updates.
    if (typeof NativeBillingPlugin.queryPurchases === "function") {
      try {
        const recovered = await withTimeout(
          NativeBillingPlugin.queryPurchases({ type: "SUBS" }),
          BILLING_OPERATION_TIMEOUT_MS,
          "NATIVE_PURCHASE_RECOVERY_TIMEOUT",
          "purchase_recovery_timeout",
          "Google Play purchase recovery query timed out",
        );
        const purchases = Array.isArray(recovered)
          ? recovered
          : recovered?.purchases || [];
        const productId = options?.product || options?.productId;
        const match = purchases.find((purchase) => {
          const ids = purchase?.products || purchase?.productIds;
          if (Array.isArray(ids) && productId) return ids.includes(productId);
          return productId && (
            purchase?.productId === productId ||
            purchase?.product === productId ||
            purchase?.sku === productId
          );
        });
        if (match?.purchaseToken || match?.token) {
          return {
            ...match,
            success: true,
            responseCode: 0,
            billingResponseCode: 0,
            source: "FiftyFitBillingRecovery",
          };
        }
      } catch (_) {
        // Preserve the original launch/callback error below.
      }
    }
    throw error;
  }
}

export const BillingPlugin = new Proxy(NativeBillingPlugin, {
  get(target, property, receiver) {
    if (property === "launchBillingFlow") {
      return (options) => launchWithRecovery(options);
    }

    // Native calls must never leave the Paywall spinner running forever.
    if (property === "startConnection") {
      return (options) =>
        withTimeout(
          NativeBillingPlugin.startConnection(options),
          BILLING_OPERATION_TIMEOUT_MS,
          "NATIVE_BILLING_CONNECTION_TIMEOUT",
          "billing_connection_timeout",
          "Google Play Billing connection timed out",
        );
    }

    if (property === "queryProductDetails") {
      return (options) =>
        withTimeout(
          NativeBillingPlugin.queryProductDetails(options),
          BILLING_OPERATION_TIMEOUT_MS,
          "NATIVE_PRODUCT_QUERY_TIMEOUT",
          "product_query_timeout",
          "Google Play product query timed out",
        );
    }

    if (property === "queryPurchases") {
      return (options) =>
        withTimeout(
          NativeBillingPlugin.queryPurchases(options),
          BILLING_OPERATION_TIMEOUT_MS,
          "NATIVE_PURCHASE_QUERY_TIMEOUT",
          "purchase_query_timeout",
          "Google Play purchase query timed out",
        );
    }

    return Reflect.get(target, property, receiver);
  },
});

// V6 is kept for compatibility with existing source checks; V7 is the
// current native/release verification marker.
BillingPlugin.FIFTYFIT_NATIVE_BILLING_V6 = true;
BillingPlugin.FIFTYFIT_NATIVE_BILLING_V7 = true;
export default BillingPlugin;
export const FIFTYFIT_NATIVE_BILLING_V6 = true;
export const FIFTYFIT_NATIVE_BILLING_V7 = true;
