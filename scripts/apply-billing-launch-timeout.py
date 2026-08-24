from pathlib import Path

PLUGIN = Path('android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java')
if not PLUGIN.exists():
    raise SystemExit(f'Missing native BillingPlugin: {PLUGIN}')

text = PLUGIN.read_text(encoding='utf-8')

if 'import android.os.Handler;' not in text:
    text = text.replace('package com.bodyahmed77.fiftyfit.billing;\n\n', 'package com.bodyahmed77.fiftyfit.billing;\n\nimport android.os.Handler;\nimport android.os.Looper;\n\n', 1)

if 'private final Handler billingHandler' not in text:
    text = text.replace('    private BillingClient activePurchaseClient;\n', '    private BillingClient activePurchaseClient;\n    private final Handler billingHandler = new Handler(Looper.getMainLooper());\n    private Runnable purchaseTimeout;\n', 1)

# Cancel any watchdog whenever the purchase callback arrives.
needle = '    private void onPurchasesUpdated(BillingClient client, PluginCall call, BillingResult result, List<Purchase> purchases) {\n'
replacement = needle + '        if (purchaseTimeout != null) { billingHandler.removeCallbacks(purchaseTimeout); purchaseTimeout = null; }\n'
if replacement not in text:
    if needle not in text:
        raise SystemExit('onPurchasesUpdated anchor missing')
    text = text.replace(needle, replacement, 1)

old = '''                BillingResult launch = client.launchBillingFlow(getActivity(), flow);\n                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {\n                    activePurchaseCall = null;\n                    activePurchaseClient = null;\n                    fail(call, launch, "launchBillingFlow_result", client);\n                }'''
new = '''                BillingResult launch = client.launchBillingFlow(getActivity(), flow);\n                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {\n                    activePurchaseCall = null;\n                    activePurchaseClient = null;\n                    fail(call, launch, "launchBillingFlow_result", client);\n                    return;\n                }\n\n                // Google returned OK, which means the billing UI launch request was accepted.\n                // Keep the JS call pending until the purchase update arrives, but never leave\n                // the Paywall spinner stuck forever if Play fails to deliver a callback.\n                final BillingClient watchdogClient = client;\n                final PluginCall watchdogCall = call;\n                purchaseTimeout = () -> {\n                    if (activePurchaseCall == watchdogCall) {\n                        activePurchaseCall = null;\n                        activePurchaseClient = null;\n                        fail(watchdogCall, BillingClient.BillingResponseCode.ERROR,\n                                "Google Play accepted launchBillingFlow (code 0) but no purchase callback was received within 30 seconds",\n                                "purchase_update_timeout", watchdogClient);\n                    }\n                };\n                billingHandler.postDelayed(purchaseTimeout, 30000L);'''
if old not in text:
    raise SystemExit('launchBillingFlow result block not found')
text = text.replace(old, new, 1)

# Clear watchdog when client is explicitly ended.
text = text.replace('    private void endClient(BillingClient client) {\n        try { if (client != null) client.endConnection(); } catch (Exception ignored) {}\n    }', '    private void endClient(BillingClient client) {\n        try { if (purchaseTimeout != null) { billingHandler.removeCallbacks(purchaseTimeout); purchaseTimeout = null; } } catch (Exception ignored) {}\n        try { if (client != null) client.endConnection(); } catch (Exception ignored) {}\n    }', 1)

required = [
    'import android.os.Handler;',
    'private final Handler billingHandler',
    '"purchase_update_timeout"',
    'Google Play accepted launchBillingFlow (code 0) but no purchase callback was received within 30 seconds',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit('Billing launch timeout patch incomplete: ' + ', '.join(missing))

PLUGIN.write_text(text, encoding='utf-8')
print('Billing launch timeout/watchdog patch applied')
