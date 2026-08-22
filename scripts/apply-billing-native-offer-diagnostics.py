from pathlib import Path
import json

PLUGIN = Path("node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java")
PACKAGE_JSON = Path("node_modules/capacitor-billing/package.json")

if not PACKAGE_JSON.exists() or not PLUGIN.exists():
    raise SystemExit("capacitor-billing 8.x native source is missing")

version = json.loads(PACKAGE_JSON.read_text(encoding="utf-8")).get("version", "")
if version != "8.1.0":
    raise SystemExit(f"Expected capacitor-billing 8.1.0, found {version}")

text = PLUGIN.read_text(encoding="utf-8")
original = text

if "import com.getcapacitor.JSObject;" not in text:
    marker = "package de.carstenklaffke.billing;\n"
    if marker not in text:
        raise SystemExit("BillingPlugin package declaration not found")
    text = text.replace(marker, marker + "\nimport com.getcapacitor.JSObject;\n", 1)

launch_failure_block = '''JSObject launchFailure = new JSObject();
                        launchFailure.put("success", false);
                        launchFailure.put("responseCode", billingResult2.getResponseCode());
                        launchFailure.put("billingResponseCode", billingResult2.getResponseCode());
                        launchFailure.put("code", billingResult2.getResponseCode());
                        launchFailure.put("debugMessage", billingResult2.getDebugMessage());
                        launchFailure.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult2.getResponseCode() + "] Error launching billing flow: " + billingResult2.getDebugMessage());
                        call.resolve(launchFailure);
                        return;'''

replacements = [
    (
        'call.reject("Error retrieving product details: " + suffix);',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "] Error retrieving product details: " + suffix, String.valueOf(code));',
    ),
    (
        'call.reject("Purchase canceled");',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "] Purchase canceled", String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Error during purchase: " + billingResult.getDebugMessage());',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "] Error during purchase: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Billing service not connected");',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "] Billing service not connected: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Billing service disconnected");',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + BillingClient.BillingResponseCode.SERVICE_DISCONNECTED + "] Billing service disconnected", String.valueOf(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED));',
    ),
    (
        'call.reject("Error launching billing flow: " + billingResult2.getDebugMessage());',
        launch_failure_block,
    ),
    (
        'call.reject("Error launching billing flow: " + billingResult2.getDebugMessage(), String.valueOf(billingResult2.getResponseCode()));',
        launch_failure_block,
    ),
    (
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult2.getResponseCode() + "] Error launching billing flow: " + billingResult2.getDebugMessage(), String.valueOf(billingResult2.getResponseCode()));',
        launch_failure_block,
    ),
    (
        'call.reject("Error acknowledging purchase: " + billingResult1.getDebugMessage());',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult1.getResponseCode() + "] Error acknowledging purchase: " + billingResult1.getDebugMessage(), String.valueOf(billingResult1.getResponseCode()));',
    ),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new)

needle_offer = 'String offerToken = subscriptionOfferDetails.getOfferToken();'
replacement_offer = '''String requestedOfferToken = call.getString("offerToken", null);
                                String offerToken = requestedOfferToken;
                                if (offerToken == null || offerToken.trim().isEmpty()) {
                                    offerToken = subscriptionOfferDetails.getOfferToken();
                                }'''
if 'String requestedOfferToken = call.getString("offerToken", null);' not in text:
    if text.count(needle_offer) != 1:
        raise SystemExit("Subscription offerToken launch insertion point not found exactly once")
    text = text.replace(needle_offer, replacement_offer, 1)

needle_diag = 'ProductDetails.SubscriptionOfferDetails subscriptionOfferDetails = productDetails.getSubscriptionOfferDetails().get(0);\n'
insert_diag = (
    'ProductDetails.SubscriptionOfferDetails subscriptionOfferDetails = productDetails.getSubscriptionOfferDetails().get(0);\n'
    '                                ret.put("subscription_offer_count", productDetails.getSubscriptionOfferDetails().size());\n'
    '                                ret.put("base_plan_id", subscriptionOfferDetails.getBasePlanId());\n'
    '                                ret.put("offer_id", subscriptionOfferDetails.getOfferId());\n'
    '                                ret.put("offer_token", subscriptionOfferDetails.getOfferToken());\n'
)
if 'ret.put("subscription_offer_count"' not in text:
    if text.count(needle_diag) != 1:
        raise SystemExit("Subscription offer diagnostics insertion point not found exactly once")
    text = text.replace(needle_diag, insert_diag, 1)

required = [
    "import com.getcapacitor.JSObject;",
    'String.valueOf(code)',
    'call.resolve(launchFailure);',
    'String requestedOfferToken = call.getString("offerToken", null);',
    'ret.put("subscription_offer_count"',
    'ret.put("base_plan_id"',
    'ret.put("offer_id"',
    'ret.put("offer_token"',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit("Native billing diagnostics incomplete: " + ", ".join(missing))

if text == original:
    print("Native billing structured launch-result bridge already applied")
else:
    PLUGIN.write_text(text, encoding="utf-8")
    print("Applied native billing structured launch-result bridge and selected offer-token forwarding")
