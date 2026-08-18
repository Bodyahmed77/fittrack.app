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

replacements = [
    (
        'call.reject("Error retrieving product details: " + suffix);',
        'call.reject("Error retrieving product details [BillingResponseCode=" + code + "]: " + suffix, String.valueOf(code));',
    ),
    (
        'call.reject("Purchase canceled");',
        'call.reject("Purchase canceled [BillingResponseCode=" + billingResult.getResponseCode() + "]", String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Error during purchase: " + billingResult.getDebugMessage());',
        'call.reject("Error during purchase [BillingResponseCode=" + billingResult.getResponseCode() + "]: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Billing service not connected");',
        'call.reject("Billing service not connected [BillingResponseCode=" + billingResult.getResponseCode() + "]: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Billing service disconnected");',
        'call.reject("Billing service disconnected [BillingResponseCode=" + BillingClient.BillingResponseCode.SERVICE_DISCONNECTED + "]", String.valueOf(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED));',
    ),
    (
        'call.reject("Error launching billing flow: " + billingResult2.getDebugMessage());',
        'call.reject("Error launching billing flow [BillingResponseCode=" + billingResult2.getResponseCode() + "]: " + billingResult2.getDebugMessage(), String.valueOf(billingResult2.getResponseCode()));',
    ),
    (
        'call.reject("Error acknowledging purchase: " + billingResult1.getDebugMessage());',
        'call.reject("Error acknowledging purchase [BillingResponseCode=" + billingResult1.getResponseCode() + "]: " + billingResult1.getDebugMessage(), String.valueOf(billingResult1.getResponseCode()));',
    ),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new)

needle = 'ProductDetails.SubscriptionOfferDetails subscriptionOfferDetails = productDetails.getSubscriptionOfferDetails().get(0);\n'
insert = (
    'ProductDetails.SubscriptionOfferDetails subscriptionOfferDetails = productDetails.getSubscriptionOfferDetails().get(0);\n'
    '                                ret.put("subscription_offer_count", productDetails.getSubscriptionOfferDetails().size());\n'
    '                                ret.put("base_plan_id", subscriptionOfferDetails.getBasePlanId());\n'
    '                                ret.put("offer_id", subscriptionOfferDetails.getOfferId());\n'
    '                                ret.put("offer_token", subscriptionOfferDetails.getOfferToken());\n'
)
if 'ret.put("subscription_offer_count"' not in text:
    if needle not in text:
        raise SystemExit("Subscription offer diagnostics insertion point not found")
    text = text.replace(needle, insert, 1)

required = [
    'BillingResponseCode=',
    'String.valueOf(code)',
    'String.valueOf(billingResult2.getResponseCode())',
    'ret.put("subscription_offer_count"',
    'ret.put("base_plan_id"',
    'ret.put("offer_id"',
    'ret.put("offer_token"',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit("Billing native diagnostics incomplete: " + ", ".join(missing))

if text == original:
    print("Billing native diagnostics already applied")
else:
    PLUGIN.write_text(text, encoding="utf-8")
    print("Applied capacitor-billing 8.1.0 native diagnostics")
