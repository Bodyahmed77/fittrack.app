#!/usr/bin/env python3
from pathlib import Path
import re

ANDROID = Path("android")
APP = ANDROID / "app"
JAVA_DIR = APP / "src/main/java/com/bodyahmed77/fiftyfit/billing"
PLUGIN = JAVA_DIR / "FiftyFitBillingPlugin.java"

JAVA = r'''package com.bodyahmed77.fiftyfit.billing;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "FiftyFitBilling")
public final class FiftyFitBillingPlugin extends Plugin {
    public static final String MARKER = "FIFTYFIT_NATIVE_BILLING_V6";

    private BillingClient billingClient;
    private PluginCall activePurchaseCall;
    private BillingClient activePurchaseClient;

    private BillingClient newBillingClient(PurchasesUpdatedListener listener) {
        return BillingClient.newBuilder(getActivity())
                .setListener(listener)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder()
                                .enableOneTimeProducts()
                                .build())
                .enableAutoServiceReconnection()
                .build();
    }

    private void resolveFailure(final PluginCall call, final BillingResult result, final String stage) {
        JSObject out = new JSObject();
        int code = result == null ? BillingClient.BillingResponseCode.ERROR : result.getResponseCode();
        String debug = result == null ? "No BillingResult returned" : result.getDebugMessage();
        out.put("success", false);
        out.put("responseCode", code);
        out.put("billingResponseCode", code);
        out.put("code", code);
        out.put("operationCode", stage);
        out.put("debugMessage", debug == null ? "" : debug);
        out.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "][stage=" + stage + "] " + (debug == null ? "" : debug));
        try {
            out.put("subResponseCode", result == null ? -1 : result.getOnPurchasesUpdatedSubResponseCode());
        } catch (Exception ignored) {
            out.put("subResponseCode", -1);
        }
        call.resolve(out);
    }

    private void resolveFailure(final PluginCall call, final int code, final String message, final String stage) {
        JSObject out = new JSObject();
        out.put("success", false);
        out.put("responseCode", code);
        out.put("billingResponseCode", code);
        out.put("code", code);
        out.put("operationCode", stage);
        out.put("debugMessage", message == null ? "" : message);
        out.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "][stage=" + stage + "] " + (message == null ? "" : message));
        call.resolve(out);
    }

    private void finishClient(BillingClient client) {
        try {
            if (client != null) client.endConnection();
        } catch (Exception ignored) {}
        if (client == billingClient) billingClient = null;
    }

    private JSONArray serializeOffers(ProductDetails details) throws JSONException {
        JSONArray offers = new JSONArray();
        List<ProductDetails.SubscriptionOfferDetails> list = details.getSubscriptionOfferDetails();
        if (list == null) return offers;
        for (ProductDetails.SubscriptionOfferDetails offer : list) {
            JSObject item = new JSObject();
            item.put("offerToken", offer.getOfferToken());
            item.put("basePlanId", offer.getBasePlanId());
            item.put("offerId", offer.getOfferId());
            ProductDetails.PricingPhases phases = offer.getPricingPhases();
            if (phases != null && !phases.getPricingPhaseList().isEmpty()) {
                ProductDetails.PricingPhase phase = phases.getPricingPhaseList().get(0);
                item.put("formattedPrice", phase.getFormattedPrice());
                item.put("priceAmountMicros", phase.getPriceAmountMicros());
                item.put("priceCurrencyCode", phase.getPriceCurrencyCode());
                item.put("billingPeriod", phase.getBillingPeriod());
                item.put("recurrenceMode", phase.getRecurrenceMode());
            }
            offers.put(item);
        }
        return offers;
    }

    private JSObject serializeProduct(ProductDetails details) throws JSONException {
        JSObject out = new JSObject();
        out.put("productId", details.getProductId());
        out.put("title", details.getName());
        out.put("description", details.getDescription());
        out.put("subscriptionOfferDetails", serializeOffers(details));
        out.put("source", "FiftyFitBilling");
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers != null && !offers.isEmpty()) {
            ProductDetails.SubscriptionOfferDetails first = offers.get(0);
            ProductDetails.PricingPhases phases = first.getPricingPhases();
            if (phases != null && !phases.getPricingPhaseList().isEmpty()) {
                ProductDetails.PricingPhase phase = phases.getPricingPhaseList().get(0);
                out.put("formattedPrice", phase.getFormattedPrice());
                out.put("price", phase.getFormattedPrice());
                out.put("priceAmountMicros", phase.getPriceAmountMicros());
                out.put("priceCurrencyCode", phase.getPriceCurrencyCode());
                out.put("currencyCode", phase.getPriceCurrencyCode());
                out.put("billingPeriod", phase.getBillingPeriod());
                out.put("recurrenceMode", phase.getRecurrenceMode());
            }
        }
        return out;
    }

    private void queryProductDetails(final PluginCall call, final BillingClient client, final String productId) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        client.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || result == null) {
                resolveFailure(call, billingResult, "product_query_failed");
                finishClient(client);
                return;
            }
            List<ProductDetails> list = result.getProductDetailsList();
            if (list == null || list.isEmpty()) {
                resolveFailure(call, billingResult, "product_query_empty");
                finishClient(client);
                return;
            }
            try {
                call.resolve(serializeProduct(list.get(0)));
            } catch (JSONException e) {
                resolveFailure(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "product_serialization_failed");
            } finally {
                finishClient(client);
            }
        });
    }

    private void startConnection(final PluginCall call, final Runnable onReady, final BillingClient client) {
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onReady.run();
                } else {
                    resolveFailure(call, result, "billing_connection_failed");
                    finishClient(client);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                resolveFailure(call, BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
                        "Billing service disconnected", "billing_service_disconnected");
                finishClient(client);
            }
        });
    }

    @PluginMethod
    public void startConnection(final PluginCall call) {
        BillingClient client = newBillingClient((result, purchases) -> {});
        billingClient = client;
        startConnection(call, () -> {
            JSObject out = new JSObject();
            out.put("success", true);
            out.put("responseCode", 0);
            out.put("billingResponseCode", 0);
            out.put("code", 0);
            out.put("debugMessage", "Billing connected");
            out.put("source", "FiftyFitBilling");
            call.resolve(out);
            finishClient(client);
        }, client);
    }

    @PluginMethod
    public void queryProductDetails(final PluginCall call) {
        String productId = call.getString("product", null);
        if (productId == null || productId.trim().isEmpty()) {
            resolveFailure(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing product id", "product_id_missing");
            return;
        }
        BillingClient client = newBillingClient((result, purchases) -> {});
        startConnection(call, () -> queryProductDetails(call, client, productId), client);
    }

    @PluginMethod
    public void queryPurchases(final PluginCall call) {
        BillingClient client = newBillingClient((result, purchases) -> {});
        startConnection(call, () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build();
            client.queryPurchasesAsync(params, (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    resolveFailure(call, result, "purchase_query_failed");
                    finishClient(client);
                    return;
                }
                try {
                    JSONArray list = new JSONArray();
                    if (purchases != null) {
                        for (Purchase purchase : purchases) {
                            list.put(new JSObject(purchase.getOriginalJson()));
                        }
                    }
                    JSObject out = new JSObject();
                    out.put("purchases", list);
                    out.put("success", true);
                    out.put("responseCode", 0);
                    out.put("source", "FiftyFitBilling");
                    call.resolve(out);
                } catch (JSONException e) {
                    resolveFailure(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "purchase_serialization_failed");
                } finally {
                    finishClient(client);
                }
            });
        }, client);
    }

    private void onPurchasesUpdated(BillingClient client, PluginCall call, BillingResult result, List<Purchase> purchases) {
        if (call == null) {
            finishClient(client);
            return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            resolveFailure(call, result, result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED
                    ? "purchase_user_canceled" : "purchase_update_failed");
            finishClient(client);
            return;
        }
        try {
            if (purchases == null || purchases.isEmpty()) {
                JSObject out = new JSObject();
                out.put("success", false);
                out.put("pending", false);
                out.put("responseCode", 0);
                out.put("code", "purchase_not_completed");
                out.put("operationCode", "purchase_update_empty");
                out.put("debugMessage", "Google Play returned no purchase objects");
                call.resolve(out);
            } else {
                Purchase purchase = purchases.get(0);
                JSObject out = new JSObject(purchase.getOriginalJson());
                out.put("success", true);
                out.put("responseCode", 0);
                out.put("billingResponseCode", 0);
                out.put("source", "FiftyFitBilling");
                out.put("pending", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING);
                out.put("purchased", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED);
                call.resolve(out);
            }
        } catch (JSONException e) {
            resolveFailure(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "purchase_serialization_failed");
        } finally {
            if (call == activePurchaseCall) activePurchaseCall = null;
            if (client == activePurchaseClient) activePurchaseClient = null;
            finishClient(client);
        }
    }

    @PluginMethod
    public void launchBillingFlow(final PluginCall call) {
        if (activePurchaseCall != null) {
            resolveFailure(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR,
                    "A purchase is already in progress", "billing_busy");
            return;
        }

        final String productId = call.getString("product", null);
        if (productId == null || productId.trim().isEmpty()) {
            resolveFailure(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing product id", "product_id_missing");
            return;
        }

        final String requestedOfferToken = call.getString("offerToken", null);
        BillingClient client = newBillingClient((result, purchases) -> onPurchasesUpdated(client, call, result, purchases));
        activePurchaseCall = call;
        activePurchaseClient = client;

        startConnection(call, () -> {
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(products)
                    .build();
            client.queryProductDetailsAsync(params, (queryResult, result) -> {
                if (queryResult.getResponseCode() != BillingClient.BillingResponseCode.OK || result == null) {
                    resolveFailure(call, queryResult, "product_query_failed");
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    finishClient(client);
                    return;
                }
                List<ProductDetails> details = result.getProductDetailsList();
                if (details == null || details.isEmpty()) {
                    resolveFailure(call, queryResult, "product_query_empty");
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    finishClient(client);
                    return;
                }

                ProductDetails product = details.get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
                String offerToken = requestedOfferToken;
                if (offerToken == null || offerToken.trim().isEmpty()) {
                    if (offers != null && !offers.isEmpty()) offerToken = offers.get(0).getOfferToken();
                }
                if (offers == null || offers.isEmpty() || offerToken == null || offerToken.trim().isEmpty()) {
                    resolveFailure(call, BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
                            "Google Play returned no eligible subscription offer", "offer_token_missing");
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    finishClient(client);
                    return;
                }

                BillingFlowParams.ProductDetailsParams.Builder paramsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product)
                        .setOfferToken(offerToken);
                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(java.util.Collections.singletonList(paramsBuilder.build()))
                        .build();

                BillingResult launchResult = client.launchBillingFlow(getActivity(), flowParams);
                if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    resolveFailure(call, launchResult, "launchBillingFlow_result");
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    finishClient(client);
                }
            });
        }, client);
    }

    @PluginMethod
    public void sendAck(final PluginCall call) {
        String token = call.getString("purchaseToken", null);
        if (token == null || token.trim().isEmpty()) {
            resolveFailure(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing purchase token", "ack_token_missing");
            return;
        }
        BillingClient client = newBillingClient((result, purchases) -> {});
        startConnection(call, () -> {
            com.android.billingclient.api.AcknowledgePurchaseParams params =
                    com.android.billingclient.api.AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(token)
                            .build();
            client.acknowledgePurchase(params, result -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    JSObject out = new JSObject();
                    out.put("success", true);
                    out.put("responseCode", 0);
                    out.put("source", "FiftyFitBilling");
                    call.resolve(out);
                } else {
                    resolveFailure(call, result, "acknowledge_failed");
                }
                finishClient(client);
            });
        }, client);
    }
}
'''

if not ANDROID.exists():
    raise SystemExit("android directory does not exist before native injection")
JAVA_DIR.mkdir(parents=True, exist_ok=True)
PLUGIN.write_text(JAVA, encoding="utf-8")

# Pin Play Billing 9.1.0 in the app module. This is the app's billing engine;
# it no longer depends on capacitor-billing's Android API surface at runtime.
gradle = APP / "build.gradle"
text = gradle.read_text(encoding="utf-8")
if "com.android.billingclient:billing:9.1.0" not in text:
    marker = "dependencies {"
    if marker not in text:
        raise SystemExit("android/app/build.gradle dependencies block not found")
    text = text.replace(marker, marker + "\n    implementation 'com.android.billingclient:billing:9.1.0'", 1)
gradle.write_text(text, encoding="utf-8")

# Register the first-party plugin in the generated Capacitor Activity.
activities = list((APP / "src/main/java").rglob("MainActivity.java"))
if not activities:
    raise SystemExit("MainActivity.java not found")
activity = activities[0]
activity_text = activity.read_text(encoding="utf-8")
import_line = "import com.bodyahmed77.fiftyfit.billing.FiftyFitBillingPlugin;"
if import_line not in activity_text:
    package_match = re.search(r"^package\s+[\w.]+;\s*$", activity_text, flags=re.MULTILINE)
    if not package_match:
        raise SystemExit("MainActivity package declaration not found")
    activity_text = activity_text[:package_match.end()] + "\n\n" + import_line + activity_text[package_match.end():]

register_line = "registerPlugin(FiftyFitBillingPlugin.class);"
if register_line not in activity_text:
    oncreate = re.search(r"protected void onCreate\s*\(\s*Bundle\s+savedInstanceState\s*\)\s*\{", activity_text)
    if oncreate:
        insert_at = oncreate.end()
        activity_text = activity_text[:insert_at] + "\n        " + register_line + activity_text[insert_at:]
    else:
        if "import android.os.Bundle;" not in activity_text:
            activity_text = activity_text.replace(import_line, "import android.os.Bundle;\n" + import_line, 1)
        block = "\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        " + register_line + "\n    }\n"
        activity_text = activity_text.rstrip()[:-1] + block + "}\n"
activity.write_text(activity_text, encoding="utf-8")

print("First-party FiftyFitBilling Android bridge injected")
print("Native marker:", PLUGIN)
print("Registered plugin in:", activity)
print("Pinned app dependency: com.android.billingclient:billing:9.1.0")
