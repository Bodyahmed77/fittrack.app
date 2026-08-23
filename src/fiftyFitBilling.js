import { registerPlugin } from "@capacitor/core";

// Fifty Fit owns this runtime bridge. The Android implementation is injected
// into the generated Capacitor project by scripts/inject-fiftyfit-billing.py.
// This intentionally does not import capacitor-billing at runtime.
export const BillingPlugin = registerPlugin("FiftyFitBilling");
export default BillingPlugin;

export const FIFTYFIT_NATIVE_BILLING_V6 = true;
