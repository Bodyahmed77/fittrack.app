from pathlib import Path

PLUGIN = Path("node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java")

if not PLUGIN.exists():
    raise SystemExit(f"Missing native BillingPlugin: {PLUGIN}")

text = PLUGIN.read_text(encoding="utf-8")

# The third-party plugin historically uses PluginCall.reject() for BillingResult
# failures. That makes the Capacitor JS error shape version-dependent and was the
# reason the app could only see NATIVE_RESPONSE_CODE_NOT_RETURNED. For Billing
# flow failures, return a normal structured JS object instead. This preserves the
# numeric Google responseCode independently of Capacitor's exception mapping.
helper = '''\n    private void resolveBillingFailure(final PluginCall call, final BillingResult result, final String stage) {\n        JSObject failure = new JSObject();\n        int code = result == null ? BillingClient.BillingResponseCode.ERROR : result.getResponseCode();\n        String debug = result == null ? "No BillingResult returned" : result.getDebugMessage();\n        failure.put("success", false);\n        failure.put("responseCode", code);\n        failure.put("billingResponseCode", code);\n        failure.put("code", code);\n        failure.put("operationCode", stage);\n        failure.put("debugMessage", debug == null ? "" : debug);\n        failure.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "][stage=" + stage + "] " + (debug == null ? "" : debug));\n        try {\n            failure.put("subResponseCode", result == null ? -1 : result.getOnPurchasesUpdatedSubResponseCode());\n        } catch (Exception ignored) {\n        }\n        call.resolve(failure);\n    }\n\n    private void resolveBillingFailure(final PluginCall call, final int code, final String message, final String stage) {\n        JSObject failure = new JSObject();\n        failure.put("success", false);\n        failure.put("responseCode", code);\n        failure.put("billingResponseCode", code);\n        failure.put("code", code);\n        failure.put("operationCode", stage);\n        failure.put("debugMessage", message == null ? "" : message);\n        failure.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "][stage=" + stage + "] " + (message == null ? "" : message));\n        call.resolve(failure);\n    }\n'''

if "private void resolveBillingFailure" not in text:
    anchor = "    private void startBillingClientConnection(BillingClient billingClient, BillingClientStateListener listener) {\n"
    if anchor not in text:
        raise SystemExit("Billing helper insertion anchor missing")
    text = text.replace(anchor, helper + "\n" + anchor, 1)

# Async purchase callback failures must be data, not Capacitor exceptions.
text = text.replace(
    'call.reject("Purchase canceled");',
    'resolveBillingFailure(call, billingResult, "purchase_user_canceled");',
)
text = text.replace(
    'call.reject("Error during purchase: " + billingResult.getDebugMessage());',
    'resolveBillingFailure(call, billingResult, "purchase_update_failed");',
)
text = text.replace(
    'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "][OnPurchasesUpdatedSubResponseCode=" + billingResult.getOnPurchasesUpdatedSubResponseCode() + "] Purchase canceled", String.valueOf(billingResult.getResponseCode()));',
    'resolveBillingFailure(call, billingResult, "purchase_user_canceled");',
)
text = text.replace(
    'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "][OnPurchasesUpdatedSubResponseCode=" + billingResult.getOnPurchasesUpdatedSubResponseCode() + "] Error during purchase: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
    'resolveBillingFailure(call, billingResult, "purchase_update_failed");',
)

# The old diagnostics patch may have converted the synchronous launch failure to
# a JSObject named launchFailure. Replace that entire block with the same helper.
old_launch_failure = '''JSObject launchFailure = new JSObject();\n                                launchFailure.put("success", false);\n                                launchFailure.put("responseCode", billingResult2.getResponseCode());\n                                launchFailure.put("billingResponseCode", billingResult2.getResponseCode());\n                                launchFailure.put("code", billingResult2.getResponseCode());\n                                launchFailure.put("debugMessage", billingResult2.getDebugMessage());\n                                launchFailure.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult2.getResponseCode() + "] Error launching billing flow: " + billingResult2.getDebugMessage());\n                                call.resolve(launchFailure);\n                                return;'''
text = text.replace(old_launch_failure, 'resolveBillingFailure(call, billingResult2, "launchBillingFlow_result");\n                                    return;', 1)

# Also handle unpatched source variants defensively.
text = text.replace(
    'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult2.getResponseCode() + "] Error launching billing flow: " + billingResult2.getDebugMessage(), String.valueOf(billingResult2.getResponseCode()));',
    'resolveBillingFailure(call, billingResult2, "launchBillingFlow_result");',
)
text = text.replace(
    'call.reject("Error launching billing flow: " + billingResult2.getDebugMessage(), String.valueOf(billingResult2.getResponseCode()));',
    'resolveBillingFailure(call, billingResult2, "launchBillingFlow_result");',
)
text = text.replace(
    'call.reject("Error launching billing flow: " + billingResult2.getDebugMessage());',
    'resolveBillingFailure(call, billingResult2, "launchBillingFlow_result");',
)

# Connection/query failures inside the launch method also return structured data.
launch_marker = 'public void launchBillingFlow(final PluginCall call) {'
idx = text.find(launch_marker)
if idx < 0:
    raise SystemExit("launchBillingFlow method not found")
launch = text[idx:]
launch = launch.replace(
    'call.reject("Billing service not connected");',
    'resolveBillingFailure(call, billingResult, "billing_connection_failed");',
    1,
)
launch = launch.replace(
    'call.reject("Billing service disconnected");',
    'resolveBillingFailure(call, BillingClient.BillingResponseCode.SERVICE_DISCONNECTED, "Billing service disconnected", "billing_service_disconnected");',
    1,
)
launch = launch.replace(
    'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "] Error retrieving product details: " + suffix, String.valueOf(code));',
    'resolveBillingFailure(call, code, "Error retrieving product details: " + suffix, "product_query_failed");',
)
launch = launch.replace(
    'call.reject("Error retrieving product details: " + suffix);',
    'resolveBillingFailure(call, billingResult1, "product_query_failed");',
)
text = text[:idx] + launch

required = [
    "private void resolveBillingFailure(final PluginCall call, final BillingResult result, final String stage)",
    'failure.put("responseCode", code);',
    'failure.put("operationCode", stage);',
    'resolveBillingFailure(call, billingResult2, "launchBillingFlow_result");',
    'resolveBillingFailure(call, billingResult, "purchase_update_failed");',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit("Structured Billing bridge patch incomplete: " + ", ".join(missing))

PLUGIN.write_text(text, encoding="utf-8")
print("Structured BillingResult bridge patch applied")
