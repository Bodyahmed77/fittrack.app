from pathlib import Path
import re

PLUGIN = Path("android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java")
if not PLUGIN.exists():
    raise SystemExit(f"Missing generated Fifty Fit billing plugin: {PLUGIN}")

text = PLUGIN.read_text(encoding="utf-8")

# The generated bridge may already contain the main-thread wrapper. Make this
# patch idempotent so a later release cannot fail merely because the desired
# state is already present.
if "getActivity().runOnUiThread" not in text:
    pattern = re.compile(
        r'(?ms)^\s*BillingResult launch = client\.launchBillingFlow\(getActivity\(\), flow\);\s*'
        r'if \(launch\.getResponseCode\(\) != BillingClient\.BillingResponseCode\.OK\) \{\s*'
        r'activePurchaseCall = null;\s*'
        r'activePurchaseClient = null;\s*'
        r'fail\(call, launch, "launchBillingFlow_result", client\);\s*'
        r'\}'
    )
    replacement = '''                final BillingClient launchClient = client;
                final BillingFlowParams launchParams = flow;
                getActivity().runOnUiThread(() -> {
                    BillingResult launch = launchClient.launchBillingFlow(getActivity(), launchParams);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        activePurchaseCall = null;
                        activePurchaseClient = null;
                        fail(call, launch, "launchBillingFlow_result", launchClient);
                    }
                });'''
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit("Expected unwrapped Billing launch block not found; refusing unsafe patch")
    text = updated

# Hard verification: the actual launch call must execute inside runOnUiThread.
if "getActivity().runOnUiThread" not in text:
    raise SystemExit("Billing launch is not marshalled onto Android main thread")

# The current generated bridge uses V7. Keep compatibility with older V6
# generated bridges so this script is safe across the transition.
marker_match = re.search(r'public static final String MARKER = "FIFTYFIT_NATIVE_BILLING_V(?:6|7)";', text)
if 'FIFTYFIT_BILLING_MAIN_THREAD_V1' not in text:
    if not marker_match:
        raise SystemExit("Billing marker declaration not found")
    marker = marker_match.group(0)
    text = text.replace(
        marker,
        marker + '\n    public static final String MAIN_THREAD_MARKER = "FIFTYFIT_BILLING_MAIN_THREAD_V1";',
        1,
    )

PLUGIN.write_text(text, encoding="utf-8")
print("Billing main-thread launch verified/applied")
