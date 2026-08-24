from pathlib import Path

PLUGIN = Path("android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java")
if not PLUGIN.exists():
    raise SystemExit(f"Missing generated FiftyFit billing plugin: {PLUGIN}")

text = PLUGIN.read_text(encoding="utf-8")
old = '''                BillingResult launch = client.launchBillingFlow(getActivity(), flow);
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    fail(call, launch, "launchBillingFlow_result", client);
                }'''
new = '''                final BillingClient launchClient = client;
                final BillingFlowParams launchParams = flow;
                getActivity().runOnUiThread(() -> {
                    BillingResult launch = launchClient.launchBillingFlow(getActivity(), launchParams);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        activePurchaseCall = null;
                        activePurchaseClient = null;
                        fail(call, launch, "launchBillingFlow_result", launchClient);
                    }
                });'''
if old not in text:
    raise SystemExit("Expected Billing launch block not found; refusing unsafe patch")
text = text.replace(old, new, 1)

marker = 'public static final String MARKER = "FIFTYFIT_NATIVE_BILLING_V6";'
if 'FIFTYFIT_BILLING_MAIN_THREAD_V1' not in text:
    text = text.replace(marker, marker + '\n    public static final String MAIN_THREAD_MARKER = "FIFTYFIT_BILLING_MAIN_THREAD_V1";', 1)

PLUGIN.write_text(text, encoding="utf-8")
print("Billing launch is now explicitly marshalled onto Android main thread")
