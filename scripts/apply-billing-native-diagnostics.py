from pathlib import Path
import json

PLUGIN = Path("node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java")
PACKAGE_JSON = Path("node_modules/capacitor-billing/package.json")
PLUGIN_GRADLE = Path("node_modules/capacitor-billing/android/build.gradle")

if not PACKAGE_JSON.exists() or not PLUGIN.exists() or not PLUGIN_GRADLE.exists():
    raise SystemExit("capacitor-billing 8.x native source/build files are missing")

version = json.loads(PACKAGE_JSON.read_text(encoding="utf-8")).get("version", "")
if version != "8.1.0":
    raise SystemExit(f"Expected capacitor-billing 8.1.0, found {version}")

text = PLUGIN.read_text(encoding="utf-8")
original = text

gradle_text = PLUGIN_GRADLE.read_text(encoding="utf-8")
original_gradle = gradle_text

if "com.android.billingclient:billing:7.1.0" in gradle_text:
    gradle_text = gradle_text.replace(
        "com.android.billingclient:billing:7.1.0",
        "com.android.billingclient:billing:9.1.0",
        1,
    )
elif "com.android.billingclient:billing:9.1.0" not in gradle_text:
    marker = "dependencies {\n"
    if marker not in gradle_text:
        raise SystemExit("Billing plugin dependencies block not found")
    gradle_text = gradle_text.replace(
        marker,
        marker + "    implementation('com.android.billingclient:billing:9.1.0')\n",
        1,
    )

imports = [
    "import com.android.billingclient.api.PendingPurchasesParams;",
    "import com.android.billingclient.api.QueryProductDetailsResult;",
]
for imp in imports:
    if imp not in text:
        marker = "import com.android.billingclient.api.QueryProductDetailsParams;\n"
        if marker not in text:
            raise SystemExit("BillingPlugin import insertion point not found")
        text = text.replace(marker, marker + imp + "\n", 1)

if "import org.json.JSONArray;" not in text:
    marker = "import org.json.JSONException;\n"
    if marker not in text:
        raise SystemExit("BillingPlugin JSON import anchor not found")
    text = text.replace(marker, marker + "import org.json.JSONArray;\n", 1)

old_builder = ".enablePendingPurchases()\n                .build();"
new_builder = ".enablePendingPurchases(\n                        PendingPurchasesParams.newBuilder()\n                                .enableOneTimeProducts()\n                                .build())\n                .enableAutoServiceReconnection()\n                .build();"
if old_builder in text:
    text = text.replace(old_builder, new_builder, 1)
elif ".enablePendingPurchases()" in text:
    raise SystemExit("Found unrecognized PBL7 enablePendingPurchases() form")

old_callback = "billingClient.queryProductDetailsAsync(params, (billingResult1, productDetailsList) -> {"
new_callback = "billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) -> {\n                        List<ProductDetails> productDetailsList = queryProductDetailsResult == null\n                                ? new ArrayList<>()\n                                : queryProductDetailsResult.getProductDetailsList();"
count = text.count(old_callback)
if count == 2:
    text = text.replace(old_callback, new_callback)
elif text.count("billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) ->") != 2:
    raise SystemExit(f"Expected exactly 2 PBL9 query callbacks, found {count}")

launch_failure_block = '''JSObject launchFailure = new JSObject();
                                launchFailure.put("success", false);
                                launchFailure.put("responseCode", billingResult2.getResponseCode());
                                launchFailure.put("billingResponseCode", billingResult2.getResponseCode());
                                launchFailure.put("code", billingResult2.getResponseCode());
                                launchFailure.put("debugMessage", billingResult2.getDebugMessage());
                                launchFailure.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + billingResult2.getResponseCode() + "] Error launching billing flow: " + billingResult2.getDebugMessage());
                                launchFailure.put("productId", productId);
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

launch_offer_old = 'String offerToken = subscriptionOfferDetails.getOfferToken();'
launch_offer_new = (
    'String requestedOfferToken = call.getString("offerToken", null);\n'
    '                                String offerToken = requestedOfferToken != null && !requestedOfferToken.trim().isEmpty()\n'
    '                                        ? requestedOfferToken\n'
    '                                        : subscriptionOfferDetails.getOfferToken();'
)
if launch_offer_old in text:
    text = text.replace(launch_offer_old, launch_offer_new, 1)

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
    "String.valueOf(billingResult2.getResponseCode())",
    'ret.put("subscriptionOfferDetails"',
    'String requestedOfferToken = call.getString("offerToken", null);',
    'launchFailure.put("responseCode", billingResult2.getResponseCode());',
    'call.resolve(launchFailure);',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit("Billing native PBL9 hardening incomplete: " + ", ".join(missing))

if ".enablePendingPurchases()" in text:
    raise SystemExit("PBL7 no-arg enablePendingPurchases() still present after migration")
if text.count("billingClient.queryProductDetailsAsync(params, (billingResult1, queryProductDetailsResult) ->") != 2:
    raise SystemExit("PBL9 queryProductDetailsAsync migration did not produce exactly two callbacks")
if "com.android.billingclient:billing:7.1.0" in gradle_text:
    raise SystemExit("PBL7 billing dependency still present in capacitor-billing build.gradle")
if "com.android.billingclient:billing:9.1.0" not in gradle_text:
    raise SystemExit("PBL9 billing dependency missing from capacitor-billing build.gradle")

if text != original:
    PLUGIN.write_text(text, encoding="utf-8")
if gradle_text != original_gradle:
    PLUGIN_GRADLE.write_text(gradle_text, encoding="utf-8")

if text == original and gradle_text == original_gradle:
    print("Billing native PBL9 compatibility + diagnostics + structured launch-result propagation already applied")
else:
    print("Applied capacitor-billing 8.1.0 native PBL9 compatibility, diagnostics, all subscription offers, selected offerToken support, and structured launch-result propagation")
