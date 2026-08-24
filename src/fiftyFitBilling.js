import { registerPlugin } from "@capacitor/core";

// Fifty Fit owns this runtime bridge. The Android implementation is injected
// into the generated Capacitor project by scripts/inject-fiftyfit-billing-v2.py.
// This intentionally does not import capacitor-billing at runtime.
const NativeBillingPlugin = registerPlugin("FiftyFitBilling");

const BILLING_LAUNCH_TIMEOUT_MS = 30000;

export const BillingPlugin = new Proxy(NativeBillingPlugin, {
  get(target, property, receiver) {
    if (property === "launchBillingFlow") {
      return (options) =>
        Promise.race([
          NativeBillingPlugin.launchBillingFlow(options),
          new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error(
                "Google Play accepted the billing launch request but no native purchase callback arrived within 30 seconds",
              );
              error.code = "NATIVE_PURCHASE_FLOW_TIMEOUT";
              error.responseCode = null;
              error.nativeCode = null;
              error.nativeMessage =
                "No onPurchasesUpdated callback received within 30 seconds";
              error.operationCode = "purchase_update_timeout";
              reject(error);
            }, BILLING_LAUNCH_TIMEOUT_MS);
          }),
        ]);
    }
    return Reflect.get(target, property, receiver);
  },
});

BillingPlugin.FIFTYFIT_NATIVE_BILLING_V6 = true;
export default BillingPlugin;
export const FIFTYFIT_NATIVE_BILLING_V6 = true;
