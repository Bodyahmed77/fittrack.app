from pathlib import Path

PLUGIN = Path('android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java')
if not PLUGIN.exists():
    raise SystemExit(f'Missing native BillingPlugin: {PLUGIN}')

text = PLUGIN.read_text(encoding='utf-8')

old = '''                BillingResult launch = client.launchBillingFlow(getActivity(), flow);\n                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {\n                    activePurchaseCall = null;\n                    activePurchaseClient = null;\n                    fail(call, launch, "launchBillingFlow_result", client);\n                }'''

new = '''                getActivity().runOnUiThread(() -> {\n                    BillingResult launch = client.launchBillingFlow(getActivity(), flow);\n                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {\n                        activePurchaseCall = null;\n                        activePurchaseClient = null;\n                        fail(call, launch, "launchBillingFlow_result", client);\n                    }\n                });'''

if old not in text:
    # Allow reruns when the UI-thread hardening is already present.
    if 'getActivity().runOnUiThread(() -> {' not in text:
        raise SystemExit('Billing launch call block not found for UI-thread hardening')
else:
    text = text.replace(old, new, 1)

required = [
    'getActivity().runOnUiThread(() -> {',
    'BillingResult launch = client.launchBillingFlow(getActivity(), flow);',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit('Billing UI-thread patch incomplete: ' + ', '.join(missing))

PLUGIN.write_text(text, encoding='utf-8')
print('Billing launch UI-thread hardening applied')
