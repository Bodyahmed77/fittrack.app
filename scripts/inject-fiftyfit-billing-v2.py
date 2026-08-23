#!/usr/bin/env python3
from pathlib import Path
import re

APP = Path("android/app")
JAVA_DIR = APP / "src/main/java/com/bodyahmed77/fiftyfit/billing"
PLUGIN = JAVA_DIR / "FiftyFitBillingPlugin.java"

JAVA = r'''package com.bodyahmed77.fiftyfit.billing;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
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
    private PluginCall activePurchaseCall;
    private BillingClient activePurchaseClient;

    private BillingClient newClient(final PluginCall call) {
        final BillingClient[] holder = new BillingClient[1];
        holder[0] = BillingClient.newBuilder(getActivity())
                .setListener((result, purchases) -> onPurchasesUpdated(holder[0], call, result, purchases))
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder()
                                .enableOneTimeProducts()
                                .build())
                .enableAutoServiceReconnection()
                .build();
        return holder[0];
    }

    private void endClient(BillingClient client) {
        try { if (client != null) client.endConnection(); } catch (Exception ignored) {}
    }

    private void success(PluginCall call, JSObject out, BillingClient client) {
        call.resolve(out);
        endClient(client);
    }

    private void fail(PluginCall call, BillingResult result, String stage, BillingClient client) {
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
        try { out.put("subResponseCode", result == null ? -1 : result.getOnPurchasesUpdatedSubResponseCode()); }
        catch (Exception ignored) { out.put("subResponseCode", -1); }
        call.resolve(out);
        endClient(client);
    }

    private void fail(PluginCall call, int code, String message, String stage, BillingClient client) {
        JSObject out = new JSObject();
        out.put("success", false);
        out.put("responseCode", code);
        out.put("billingResponseCode", code);
        out.put("code", code);
        out.put("operationCode", stage);
        out.put("debugMessage", message == null ? "" : message);
        out.put("message", "FIFTYFIT_BILLING_ERROR [BillingResponseCode=" + code + "][stage=" + stage + "] " + (message == null ? "" : message));
        call.resolve(out);
        endClient(client);
    }

    private void connect(BillingClient client, PluginCall call, Runnable ready) {
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else fail(call, result, "billing_connection_failed", client);
            }
            @Override public void onBillingServiceDisconnected() {
                fail(call, BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
                        "Billing service disconnected", "billing_service_disconnected", client);
            }
        });
    }

    private JSONArray offers(ProductDetails details) throws JSONException {
        JSONArray arr = new JSONArray();
        List<ProductDetails.SubscriptionOfferDetails> list = details.getSubscriptionOfferDetails();
        if (list == null) return arr;
        for (ProductDetails.SubscriptionOfferDetails offer : list) {
            JSObject obj = new JSObject();
            obj.put("offerToken", offer.getOfferToken());
            obj.put("basePlanId", offer.getBasePlanId());
            obj.put("offerId", offer.getOfferId());
            if (offer.getPricingPhases() != null && !offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                ProductDetails.PricingPhase p = offer.getPricingPhases().getPricingPhaseList().get(0);
                obj.put("formattedPrice", p.getFormattedPrice());
                obj.put("price", p.getFormattedPrice());
                obj.put("priceAmountMicros", p.getPriceAmountMicros());
                obj.put("priceCurrencyCode", p.getPriceCurrencyCode());
                obj.put("billingPeriod", p.getBillingPeriod());
            }
            arr.put(obj);
        }
        return arr;
    }

    private JSObject product(ProductDetails details) throws JSONException {
        JSObject out = new JSObject();
        out.put("productId", details.getProductId());
        out.put("title", details.getName());
        out.put("description", details.getDescription());
        out.put("subscriptionOfferDetails", offers(details));
        out.put("source", "FiftyFitBilling");
        if (details.getSubscriptionOfferDetails() != null && !details.getSubscriptionOfferDetails().isEmpty()) {
            ProductDetails.SubscriptionOfferDetails offer = details.getSubscriptionOfferDetails().get(0);
            if (offer.getPricingPhases() != null && !offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                ProductDetails.PricingPhase p = offer.getPricingPhases().getPricingPhaseList().get(0);
                out.put("formattedPrice", p.getFormattedPrice());
                out.put("price", p.getFormattedPrice());
                out.put("priceCurrencyCode", p.getPriceCurrencyCode());
                out.put("currencyCode", p.getPriceCurrencyCode());
                out.put("billingPeriod", p.getBillingPeriod());
                out.put("recurrenceMode", p.getRecurrenceMode());
            }
        }
        return out;
    }

    private void querySingleProduct(PluginCall call, BillingClient client, String productId, boolean keepOpen, String requestedOfferToken) {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        list.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(list).build();
        client.queryProductDetailsAsync(params, (result, queryResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || queryResult == null) {
                fail(call, result, "product_query_failed", client);
                return;
            }
            List<ProductDetails> products = queryResult.getProductDetailsList();
            if (products == null || products.isEmpty()) {
                fail(call, BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
                        "Google Play returned no product details", "product_query_empty", client);
                return;
            }
            try {
                if (!keepOpen) {
                    success(call, product(products.get(0)), client);
                    return;
                }
                ProductDetails details = products.get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                String token = requestedOfferToken;
                if (token == null || token.trim().isEmpty()) {
                    if (offers != null && !offers.isEmpty()) token = offers.get(0).getOfferToken();
                }
                if (offers == null || offers.isEmpty() || token == null || token.trim().isEmpty()) {
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    fail(call, BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
                            "Google Play returned no eligible subscription offer", "offer_token_missing", client);
                    return;
                }
                BillingFlowParams flow = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(java.util.Collections.singletonList(
                                BillingFlowParams.ProductDetailsParams.newBuilder()
                                        .setProductDetails(details)
                                        .setOfferToken(token)
                                        .build()))
                        .build();
                BillingResult launch = client.launchBillingFlow(getActivity(), flow);
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    activePurchaseCall = null;
                    activePurchaseClient = null;
                    fail(call, launch, "launchBillingFlow_result", client);
                }
            } catch (JSONException e) {
                activePurchaseCall = null;
                activePurchaseClient = null;
                fail(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "serialization_failed", client);
            }
        });
    }

    private void onPurchasesUpdated(BillingClient client, PluginCall call, BillingResult result, List<Purchase> purchases) {
        if (call == null) { endClient(client); return; }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            if (call == activePurchaseCall) activePurchaseCall = null;
            if (client == activePurchaseClient) activePurchaseClient = null;
            fail(call, result, result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED
                    ? "purchase_user_canceled" : "purchase_update_failed", client);
            return;
        }
        if (purchases == null || purchases.isEmpty()) {
            if (call == activePurchaseCall) activePurchaseCall = null;
            if (client == activePurchaseClient) activePurchaseClient = null;
            JSObject out = new JSObject();
            out.put("success", false);
            out.put("responseCode", 0);
            out.put("code", "purchase_not_completed");
            out.put("operationCode", "purchase_update_empty");
            out.put("debugMessage", "Google Play returned no purchase objects");
            success(call, out, client);
            return;
        }
        try {
            Purchase purchase = purchases.get(0);
            JSObject out = new JSObject(purchase.getOriginalJson());
            out.put("success", true);
            out.put("responseCode", 0);
            out.put("billingResponseCode", 0);
            out.put("pending", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING);
            out.put("purchased", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED);
            out.put("source", "FiftyFitBilling");
            if (call == activePurchaseCall) activePurchaseCall = null;
            if (client == activePurchaseClient) activePurchaseClient = null;
            success(call, out, client);
        } catch (JSONException e) {
            if (call == activePurchaseCall) activePurchaseCall = null;
            if (client == activePurchaseClient) activePurchaseClient = null;
            fail(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "purchase_serialization_failed", client);
        }
    }

    @PluginMethod
    public void startConnection(PluginCall call) {
        BillingClient client = newClient(call);
        connect(client, call, () -> {
            JSObject out = new JSObject();
            out.put("success", true);
            out.put("responseCode", 0);
            out.put("billingResponseCode", 0);
            out.put("code", 0);
            out.put("debugMessage", "Billing connected");
            success(call, out, client);
        });
    }

    @PluginMethod
    public void queryProductDetails(PluginCall call) {
        String productId = call.getString("product", null);
        if (productId == null || productId.trim().isEmpty()) {
            fail(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing product id", "product_id_missing", null);
            return;
        }
        BillingClient client = newClient(call);
        connect(client, call, () -> querySingleProduct(call, client, productId, false, null));
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        BillingClient client = newClient(call);
        connect(client, call, () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build();
            client.queryPurchasesAsync(params, (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    fail(call, result, "purchase_query_failed", client);
                    return;
                }
                try {
                    JSONArray arr = new JSONArray();
                    if (purchases != null) for (Purchase p : purchases) arr.put(new JSObject(p.getOriginalJson()));
                    JSObject out = new JSObject();
                    out.put("success", true);
                    out.put("responseCode", 0);
                    out.put("purchases", arr);
                    success(call, out, client);
                } catch (JSONException e) {
                    fail(call, BillingClient.BillingResponseCode.ERROR, e.getMessage(), "purchase_serialization_failed", client);
                }
            });
        });
    }

    @PluginMethod
    public void launchBillingFlow(PluginCall call) {
        if (activePurchaseCall != null) {
            fail(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "A purchase is already in progress", "billing_busy", null);
            return;
        }
        String productId = call.getString("product", null);
        if (productId == null || productId.trim().isEmpty()) {
            fail(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing product id", "product_id_missing", null);
            return;
        }
        String requestedOfferToken = call.getString("offerToken", null);
        final BillingClient[] holder = new BillingClient[1];
        holder[0] = newClient(call);
        BillingClient client = holder[0];
        // Replace the client's callback by creating a dedicated client whose listener captures the stable reference.
        client.endConnection();
        holder[0] = BillingClient.newBuilder(getActivity())
                .setListener((result, purchases) -> onPurchasesUpdated(holder[0], call, result, purchases))
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        client = holder[0];
        activePurchaseCall = call;
        activePurchaseClient = client;
        final BillingClient finalClient = client;
        connect(finalClient, call, () -> querySingleProduct(call, finalClient, productId, true, requestedOfferToken));
    }

    @PluginMethod
    public void sendAck(PluginCall call) {
        String token = call.getString("purchaseToken", null);
        if (token == null || token.trim().isEmpty()) {
            fail(call, BillingClient.BillingResponseCode.DEVELOPER_ERROR, "Missing purchase token", "ack_token_missing", null);
            return;
        }
        BillingClient client = newClient(call);
        connect(client, call, () -> {
            AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(token)
                    .build();
            client.acknowledgePurchase(params, result -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    JSObject out = new JSObject();
                    out.put("success", true);
                    out.put("responseCode", 0);
                    success(call, out, client);
                } else {
                    fail(call, result, "acknowledge_failed", client);
                }
            });
        });
    }
}
'''

if not APP.exists():
    raise SystemExit("android/app does not exist")
JAVA_DIR.mkdir(parents=True, exist_ok=True)
PLUGIN.write_text(JAVA, encoding="utf-8")

gradle = APP / "build.gradle"
text = gradle.read_text(encoding="utf-8")
if "com.android.billingclient:billing:9.1.0" not in text:
    marker = "dependencies {"
    if marker not in text:
        raise SystemExit("dependencies block missing from android/app/build.gradle")
    text = text.replace(marker, marker + "\n    implementation 'com.android.billingclient:billing:9.1.0'", 1)
gradle.write_text(text, encoding="utf-8")

main_files = list((APP / "src/main/java").rglob("MainActivity.java"))
if not main_files:
    raise SystemExit("MainActivity.java not found")
main = main_files[0]
text = main.read_text(encoding="utf-8")
imp = "import com.bodyahmed77.fiftyfit.billing.FiftyFitBillingPlugin;"
if imp not in text:
    pkg = re.search(r"^package\s+[\w.]+;\s*$", text, re.MULTILINE)
    if not pkg:
        raise SystemExit("MainActivity package declaration missing")
    text = text[:pkg.end()] + "\n\n" + imp + text[pkg.end():]
if "registerPlugin(FiftyFitBillingPlugin.class);" not in text:
    oncreate = re.search(r"protected void onCreate\s*\(\s*Bundle\s+savedInstanceState\s*\)\s*\{", text)
    if oncreate:
        text = text[:oncreate.end()] + "\n        registerPlugin(FiftyFitBillingPlugin.class);" + text[oncreate.end():]
    else:
        if "import android.os.Bundle;" not in text:
            text = text.replace(imp, "import android.os.Bundle;\n" + imp, 1)
        body = "\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        registerPlugin(FiftyFitBillingPlugin.class);\n    }\n"
        text = text.rstrip()
        if not text.endswith("}"):
            raise SystemExit("MainActivity class body malformed")
        text = text[:-1] + body + "}\n"
main.write_text(text, encoding="utf-8")

print("Fifty Fit first-party Billing v2 injected")
print(PLUGIN)
print(main)
