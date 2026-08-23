from pathlib import Path
import json

PLUGIN = Path("node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java")
PACKAGE_JSON = Path("node_modules/capacitor-billing/package.json")
PLUGIN_GRADLE = Path("node_modules/capacitor-billing/android/build.gradle")

for required in (PACKAGE_JSON, PLUGIN, PLUGIN_GRADLE):
    if not required.exists():
        raise SystemExit(f"Missing capacitor-billing native file: {required}")

version = json.loads(PACKAGE_JSON.read_text(encoding="utf-8")).get("version", "")
if version != "8.1.0":
    raise SystemExit(f"Expected capacitor-billing 8.1.0, found {version}")

text = PLUGIN.read_text(encoding="utf-8")
gradle_text = PLUGIN_GRADLE.read_text(encoding="utf-8")

# Pin Play Billing 9.1.0.
gradle_text = gradle_text.replace(
    "com.android.billingclient:billing:7.1.0",
    "com.android.billingclient:billing:9.1.0",
)
if "com.android.billingclient:billing:9.1.0" not in gradle_text:
    marker = "dependencies {\n"
    if marker not in gradle_text:
        raise SystemExit("Billing plugin dependencies block not found")
    gradle_text = gradle_text.replace(
        marker,
        marker + "    implementation('com.android.billingclient:billing:9.1.0')\n",
        1,
    )

# PBL9 imports.
for imp in (
    "import com.android.billingclient.api.PendingPurchasesParams;",
    "import com.android.billingclient.api.QueryProductDetailsResult;",
    "import org.json.JSONArray;",
):
    if imp not in text:
        anchor = (
            "import com.android.billingclient.api.QueryProductDetailsParams;\n"
            if "billingclient" in imp
            else "import org.json.JSONException;\n"
        )
        if anchor not in text:
            raise SystemExit(f"Native Billing import anchor not found for {imp}")
        text = text.replace(anchor, anchor + imp + "\n", 1)

# PBL9 BillingClient builder.
legacy_builder = ".enablePendingPurchases()\n                .build();"
modern_builder = ".enablePendingPurchases(\n                        PendingPurchasesParams.newBuilder()\n                                .enableOneTimeProducts()\n                                .build())\n                .enableAutoServiceReconnection()\n                .build();"
if legacy_builder in text:
    text = text.replace(legacy_builder, modern_builder, 1)
elif ".enablePendingPurchases()" in text:
    raise SystemExit("Unrecognized PBL7 enablePendingPurchases() form")

# PBL9 ProductDetails query callback shape.
legacy_callback = "billingClient.queryProductDetailsAsync(params, (billingResult1, productDetailsList) -> {"
modern_callback = "billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) -> {\n                        List<ProductDetails> productDetailsList = queryProductDetailsResult == null\n                                ? new ArrayList<>()\n                                : queryProductDetailsResult.getProductDetailsList();"
count = text.count(legacy_callback)
if count == 2:
    text = text.replace(legacy_callback, modern_callback)
elif text.count("billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) ->") != 2:
    raise SystemExit(f"Expected exactly 2 PBL9 query callbacks, found legacy={count}")

# Preserve the native response code through the Capacitor resolve path.
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
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "][OnPurchasesUpdatedSubResponseCode=" + billingResult.getOnPurchasesUpdatedSubResponseCode() + "] Purchase canceled", String.valueOf(billingResult.getResponseCode()));',
    ),
    (
        'call.reject("Error during purchase: " + billingResult.getDebugMessage());',
        'call.reject("FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult.getResponseCode() + "][OnPurchasesUpdatedSubResponseCode=" + billingResult.getOnPurchasesUpdatedSubResponseCode() + "] Error during purchase: " + billingResult.getDebugMessage(), String.valueOf(billingResult.getResponseCode()));',
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

# Export every subscription offer to JS so billing.js can select the correct base plan/offer.
offer_anchor = 'ProductDetails.SubscriptionOfferDetails subscriptionOfferDetails = productDetails.getSubscriptionOfferDetails().get(0);\n'
if 'ret.put("subscriptionOfferDetails"' not in text:
    offer_block = (
        'JSONArray subscriptionOffers = new JSONArray();\n'
        '                                for (ProductDetails.SubscriptionOfferDetails offer : productDetails.getSubscriptionOfferDetails()) {\n'
        '                                    JSObject offerJson = new JSObject();\n'
        '                                    offerJson.put("offerToken", offer.getOfferToken());\n'
        '                                    offerJson.put("basePlanId", offer.getBasePlanId());\n'
        '                                    offerJson.put("offerId", offer.getOfferId());\n'
        '                                    subscriptionOffers.put(offerJson);\n'
        '                                }\n'
        '                                ret.put("subscriptionOfferDetails", subscriptionOffers);\n'
    )
    if offer_anchor not in text:
        raise SystemExit("Subscription offer export insertion point not found")
    text = text.replace(offer_anchor, offer_anchor + offer_block, 1)

# Honor the offerToken selected by the JS layer.
legacy_offer = 'String offerToken = subscriptionOfferDetails.getOfferToken();'
if legacy_offer in text:
    text = text.replace(
        legacy_offer,
        'String requestedOfferToken = call.getString("offerToken", null);\n'
        '                                String offerToken = requestedOfferToken != null && !requestedOfferToken.trim().isEmpty()\n'
        '                                        ? requestedOfferToken\n'
        '                                        : subscriptionOfferDetails.getOfferToken();',
        1,
    )

required = [
    "import com.android.billingclient.api.PendingPurchasesParams;",
    "import com.android.billingclient.api.QueryProductDetailsResult;",
    "import org.json.JSONArray;",
    ".enablePendingPurchases(\n                        PendingPurchasesParams.newBuilder()",
    ".enableAutoServiceReconnection()",
    "queryProductDetailsResult.getProductDetailsList()",
    "FIFTYFIT_BILLING_ERROR",
    "BillingResponseCode=",
    "getOnPurchasesUpdatedSubResponseCode()",
    "billingResult2.getResponseCode()",
    'ret.put("subscriptionOfferDetails"',
    'String requestedOfferToken = call.getString("offerToken", null);',
    'launchFailure.put("responseCode", billingResult2.getResponseCode());',
    'call.resolve(launchFailure);',
]
missing = [needle for needle in required if needle not in text]
if missing:
    raise SystemExit("Billing native PBL9 hardening incomplete: " + ", ".join(missing))

if ".enablePendingPurchases()" in text:
    raise SystemExit("PBL7 no-arg enablePendingPurchases() remains")
if text.count("billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) ->") != 2:
    raise SystemExit("PBL9 query callback migration did not produce exactly two callbacks")
if "com.android.billingclient:billing:7.1.0" in gradle_text:
    raise SystemExit("PBL7 billing dependency remains")
if "com.android.billingclient:billing:9.1.0" not in gradle_text:
    raise SystemExit("PBL9 billing dependency is missing")

PLUGIN.write_text(text, encoding="utf-8")
PLUGIN_GRADLE.write_text(gradle_text, encoding="utf-8")
print("Applied capacitor-billing 8.1.0 PBL9 compatibility, diagnostics, all subscription offers, selected offerToken support, and structured launch-result propagation")
