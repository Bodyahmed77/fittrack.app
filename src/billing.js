// ============================================================
// Google Play Billing Wrapper (capacitor-billing)
// ============================================================
// Native Google Play Billing is the source of purchase state.
// Product IDs and localized prices come from Google Play at runtime.
// Server verification/entitlement registration happens before the
// purchase is acknowledged; see registerPurchase.js.

import { BILLING_PRODUCTS, setPlayStorePricing } from "./config";

const ANDROID_PACKAGE_NAME = "com.bodyahmed77.fiftyfit";
const EXPECTED_BASE_PLAN_BY_DURATION = {
  monthly: "monthly",
  quarterly: "quarterly",
  halfyearly: "halfyearly",
  yearly: "yearly",
};

let plugin = null;
let purchaseInFlight = false;
let billingConnected = false;

async function getPlugin() {
  if (plugin) return plugin;
  try {
    const mod = await import(/* @vite-ignore */ "capacitor-billing");
    plugin = mod?.BillingPlugin || mod?.default || null;
    return plugin;
  } catch (e) {
    console.warn("Billing plugin unavailable", e);
    return null;
  }
}

function billingResponseName(code) {
  const names = {
    "0": "OK",
    "1": "USER_CANCELED",
    "2": "SERVICE_UNAVAILABLE",
    "3": "BILLING_UNAVAILABLE",
    "4": "ITEM_UNAVAILABLE",
    "5": "DEVELOPER_ERROR",
    "6": "ERROR",
    "7": "ITEM_ALREADY_OWNED",
    "8": "ITEM_NOT_OWNED",
    "-1": "SERVICE_DISCONNECTED",
    "-2": "FEATURE_NOT_SUPPORTED",
  };
  return names[String(code)] || "UNKNOWN";
}

function writeBillingDiagnostics(patch) {
  if (typeof window === "undefined") return;
  try {
    window.__fiftyFitBillingDiagnostics = {
      ...(window.__fiftyFitBillingDiagnostics || {}),
      ...patch,
      packageName: ANDROID_PACKAGE_NAME,
      updatedAt: new Date().toISOString(),
    };
  } catch (_) {}
}

async function ensureBillingConnection(billing) {
  if (!billing || typeof billing.startConnection !== "function") return;
  if (billingConnected) return;

  try {
    const result = await billing.startConnection();
    const responseCode =
      result?.responseCode ??
      result?.billingResponseCode ??
      result?.response?.responseCode;

    if (responseCode != null && String(responseCode) !== "0") {
      throw billingError(
        {
          responseCode,
          message: result?.debugMessage || result?.response?.message,
        },
        "billing_connection_failed",
      );
    }

    billingConnected = true;
    writeBillingDiagnostics({
      stage: "billing_connected",
      billingConnection: "connected",
      responseCode: responseCode ?? 0,
      responseName: billingResponseName(responseCode ?? 0),
    });
  } catch (e) {
    billingConnected = false;
    writeBillingDiagnostics({
      stage: "billing_connection_failed",
      billingConnection: "failed",
      responseCode: e?.responseCode ?? e?.code ?? null,
      responseName: billingResponseName(e?.responseCode ?? e?.code),
      debugMessage: e?.debugMessage || e?.nativeMessage || e?.message || null,
    });
    throw billingError(e, "billing_connection_failed");
  }
}

export function productIdFor(planId, durationId = "monthly") {
  const entry = BILLING_PRODUCTS?.[planId];
  const id =
    typeof entry === "string"
      ? entry
      : entry?.[durationId] || entry?.monthly || null;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function allProductIds() {
  const out = [];
  Object.values(BILLING_PRODUCTS || {}).forEach((entry) => {
    if (typeof entry === "string") {
      if (entry) out.push(entry);
      return;
    }
    Object.values(entry || {}).forEach((id) => {
      if (typeof id === "string" && id) out.push(id);
    });
  });
  return [...new Set(out)];
}

function purchaseProducts(purchase) {
  const products = purchase?.products || purchase?.productIds;
  if (Array.isArray(products)) return products.filter(Boolean);
  const product = purchase?.productId || purchase?.product || purchase?.sku;
  return product ? [product] : [];
}

function extractPurchaseToken(purchase) {
  if (!purchase || typeof purchase !== "object") return null;
  const token =
    purchase.purchaseToken ||
    purchase.token ||
    purchase.purchase?.purchaseToken ||
    purchase.product?.purchaseToken ||
    purchase.result?.purchaseToken ||
    purchase.result?.purchase?.purchaseToken;
  return typeof token === "string" && token ? token : null;
}

function isPurchased(purchase) {
  if (!purchase || typeof purchase !== "object") return false;
  const token = extractPurchaseToken(purchase);
  if (!token) return false;

  const state = purchase.purchaseState ?? purchase.purchase?.purchaseState;
  if (state == null) return true;
  return state === 1 || state === "1";
}

function billingError(e, fallbackCode = "billing_error") {
  const source = e?.error || e?.response || e;
  const code =
    source?.code ??
    source?.responseCode ??
    source?.billingResponseCode ??
    e?.code ??
    e?.responseCode ??
    fallbackCode;
  const message = String(
    source?.message ||
      source?.debugMessage ||
      e?.message ||
      "Google Play Billing could not complete the operation",
  );
  const err = new Error(message);
  err.code = String(code);
  err.responseCode =
    source?.responseCode ?? source?.billingResponseCode ?? e?.responseCode ?? null;
  err.nativeCode =
    source?.code ??
    source?.responseCode ??
    source?.billingResponseCode ??
    e?.nativeCode ??
    null;
  err.nativeMessage =
    source?.debugMessage || source?.message || e?.nativeMessage || e?.message || null;
  err.billingResponseCodeName = billingResponseName(err.responseCode ?? err.code);
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
  err.raw = e;
  return err;
}

function normalizeSkuDetails(result) {
  if (!result || typeof result !== "object") return null;
  if (result.value === "web") return result;
  if (result.productId || result.sku || result.id || result.price || result.formattedPrice) return result;
  if (result.productDetails && typeof result.productDetails === "object") {
    return result.productDetails;
  }
  if (Array.isArray(result.productDetailsList) && result.productDetailsList.length) {
    return result.productDetailsList[0];
  }
  if (Array.isArray(result.productDetails) && result.productDetails.length) {
    return result.productDetails[0];
  }
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return null;
}

function localizedDisplayPrice(details) {
  if (!details || typeof details !== "object") return null;
  const candidates = [
    details.formattedPrice,
    details.localizedPrice,
    details.priceString,
    details.displayPrice,
    details.price,
  ];
  for (const candidate of candidates) {
    if (candidate != null && String(candidate).trim()) return String(candidate).trim();
  }
  return null;
}

function getSubscriptionOffers(details) {
  if (!details || typeof details !== "object") return [];
  const candidates = [
    details.subscriptionOfferDetails,
    details.subscriptionOfferDetailsList,
    details.offers,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(Boolean);
  }
  return [];
}

function offerTokenOf(offer) {
  return (
    offer?.offerToken ||
    offer?.offer_token ||
    null
  );
}

function basePlanIdOf(offer) {
  return offer?.basePlanId || offer?.base_plan_id || null;
}

function offerIdOf(offer) {
  return offer?.offerId || offer?.offer_id || null;
}

function selectSubscriptionOffer(details, durationId) {
  const offers = getSubscriptionOffers(details);
  const expectedBasePlan = EXPECTED_BASE_PLAN_BY_DURATION[durationId] || null;

  const eligible = offers.filter((offer) => !!offerTokenOf(offer));
  if (!eligible.length) return { offer: null, offers, expectedBasePlan };

  const basePlanMatches = expectedBasePlan
    ? eligible.filter((offer) => basePlanIdOf(offer) === expectedBasePlan)
    : [];

  const candidates = basePlanMatches.length ? basePlanMatches : eligible;
  const preferred =
    candidates.find((offer) => !offerIdOf(offer)) ||
    candidates[0] ||
    null;

  return { offer: preferred, offers, expectedBasePlan };
}

async function queryModernProductDetailsForProduct(billing, productId) {
  if (!billing || typeof billing.queryProductDetails !== "function") return null;
  const result = await billing.queryProductDetails({
    product: productId,
    type: "SUBS",
  });
  const details = normalizeSkuDetails(result);
  if (!details) return null;
  return {
    ...details,
    productId: details.productId || details.sku || details.id || productId,
    formattedPrice: localizedDisplayPrice(details),
    priceCurrencyCode:
      details.priceCurrencyCode ||
      details.price_currency_code ||
      details.currencyCode ||
      null,
    source: "productDetails",
  };
}

async function querySkuDetailsForProduct(billing, productId) {
  if (!billing || typeof billing.querySkuDetails !== "function") {
    throw Object.assign(
      new Error("capacitor-billing querySkuDetails is unavailable"),
      { code: "billing_query_unsupported" },
    );
  }

  const result = await billing.querySkuDetails({
    product: productId,
    type: "SUBS",
  });

  const details = normalizeSkuDetails(result);
  if (!details) return null;

  return {
    ...details,
    productId: details.productId || details.sku || details.id || productId,
    formattedPrice: localizedDisplayPrice(details),
    priceCurrencyCode:
      details.priceCurrencyCode ||
      details.price_currency_code ||
      details.currencyCode ||
      null,
    source: "skuDetails",
  };
}

async function queryAnyProductDetails(billing, productId) {
  if (typeof billing?.queryProductDetails === "function") {
    try {
      const modern = await queryModernProductDetailsForProduct(billing, productId);
      if (modern) return modern;
    } catch (e) {
      console.warn("[Billing] queryProductDetails failed", productId, e);
    }
  }
  return querySkuDetailsForProduct(billing, productId);
}

async function queryActiveSubscriptions(billing) {
  try {
    if (typeof billing?.queryPurchases === "function") {
      const result = await billing.queryPurchases({ type: "SUBS" });
      return Array.isArray(result) ? result : result?.purchases || [];
    }
    if (typeof billing?.getPurchases === "function") {
      const result = await billing.getPurchases();
      return Array.isArray(result) ? result : result?.purchases || [];
    }
  } catch (e) {
    writeBillingDiagnostics({
      stage: "active_subscription_query_failed",
      responseCode: e?.responseCode ?? e?.code ?? null,
      responseName: billingResponseName(e?.responseCode ?? e?.code),
      debugMessage: e?.debugMessage || e?.nativeMessage || e?.message || String(e),
    });
  }
  return [];
}

export async function queryProducts() {
  const billing = await getPlugin();
  if (!billing) return { preview: true, products: null };

  const ids = allProductIds();
  if (!ids.length) {
    return {
      preview: false,
      products: [],
      error: Object.assign(new Error("No Google Play product IDs configured"), {
        code: "billing_products_missing",
      }),
    };
  }

  try {
    await ensureBillingConnection(billing);

    const products = [];
    const unfetched = [];

    for (const id of ids) {
      try {
        const details = await queryAnyProductDetails(billing, id);
        if (details && localizedDisplayPrice(details)) {
          products.push(details);
        } else if (details) {
          unfetched.push({
            productId: id,
            statusCode: "PRICE_MISSING",
            message: "Google Play returned product details without a localized price",
            priceCurrencyCode: details.priceCurrencyCode || null,
          });
        } else {
          unfetched.push({
            productId: id,
            statusCode: "NO_PRODUCT_DETAILS",
            message: "Google Play returned no product details for this subscription",
          });
        }
      } catch (e) {
        unfetched.push({
          productId: id,
          statusCode:
            e?.responseCode ?? e?.billingResponseCode ?? e?.code ?? "query_failed",
          message: e?.message || String(e),
        });
      }
    }

    setPlayStorePricing(products);

    writeBillingDiagnostics({
      stage: "catalog_loaded",
      productCount: products.length,
      unfetched,
      firstProduct: products[0]
        ? {
            productId: products[0].productId,
            formattedPrice: products[0].formattedPrice,
            priceCurrencyCode: products[0].priceCurrencyCode || null,
            source: products[0].source || null,
          }
        : null,
    });

    return {
      preview: false,
      products,
      unfetched,
    };
  } catch (e) {
    const error = billingError(e, "billing_query_failed");
    writeBillingDiagnostics({
      stage: "catalog_query_failed",
      productCount: 0,
      unfetched: [],
      code: error.code,
      responseCode: error.responseCode,
      responseName: error.billingResponseCodeName,
      message: error.message,
    });
    return {
      preview: false,
      products: [],
      error,
    };
  }
}

export async function purchase(planId, durationId) {
  const productId = productIdFor(planId, durationId);
  if (!productId) {
    return {
      success: false,
      preview: false,
      error: Object.assign(new Error("This Pro product is not configured yet"), {
        code: "product_not_configured",
      }),
    };
  }

  if (purchaseInFlight) {
    return {
      success: false,
      preview: false,
      error: Object.assign(
        new Error("A Google Play purchase is already in progress"),
        { code: "billing_busy" },
      ),
    };
  }

  const billing = await getPlugin();
  if (!billing) {
    return {
      success: false,
      preview: true,
      message: "Billing is unavailable outside Android",
    };
  }

  purchaseInFlight = true;

  try {
    await ensureBillingConnection(billing);

    // Google documents that an app should not attempt to sell a subscription
    // that the user already owns. Detect that condition before launch so a
    // repeated tester account does not look like an opaque Play failure.
    const activeSubscriptions = await queryActiveSubscriptions(billing);
    const alreadyOwned = activeSubscriptions.find((purchase) =>
      isPurchased(purchase) && purchaseProducts(purchase).includes(productId),
    );
    if (alreadyOwned) {
      const token = extractPurchaseToken(alreadyOwned);
      const err = new Error(
        `This Google Play subscription is already owned: ${productId}`,
      );
      err.code = "ITEM_ALREADY_OWNED";
      err.responseCode = 7;
      err.nativeCode = 7;
      err.billingResponseCodeName = "ITEM_ALREADY_OWNED";
      err.productId = productId;
      writeBillingDiagnostics({
        stage: "purchase_blocked_already_owned",
        productId,
        responseCode: 7,
        responseName: "ITEM_ALREADY_OWNED",
        purchaseTokenPresent: !!token,
        message: err.message,
      });
      return {
        success: false,
        preview: false,
        error: err,
        alreadyOwned: true,
      };
    }

    const selected = await queryAnyProductDetails(billing, productId);
    if (!selected || !localizedDisplayPrice(selected)) {
      const err = new Error(
        `Google Play did not return an available localized product for ${productId}`,
      );
      err.code = "product_unavailable";
      err.productId = productId;
      throw err;
    }

    const selectedOffer = selectSubscriptionOffer(selected, durationId);
    const selectedOfferToken = offerTokenOf(selectedOffer.offer);
    const basePlanId = basePlanIdOf(selectedOffer.offer);
    const offerId = offerIdOf(selectedOffer.offer);

    if (!selectedOfferToken) {
      const err = new Error(
        `Google Play returned no eligible subscription offer for ${productId}`,
      );
      err.code = "offer_token_missing";
      err.productId = productId;
      err.basePlanId = basePlanId;
      err.offerId = offerId;
      throw err;
    }

    writeBillingDiagnostics({
      stage: "before_launchBillingFlow",
      productId,
      durationId,
      expectedBasePlanId: selectedOffer.expectedBasePlan,
      selectedBasePlanId: basePlanId,
      selectedOfferId: offerId,
      offerCount: selectedOffer.offers.length,
      offerTokenPresent: true,
      offerTokenMatchesProduct: true,
    });

    let result;
    try {
      result = await billing.launchBillingFlow({
        product: productId,
        type: "SUBS",
        offerToken: selectedOfferToken,
      });
    } catch (launchError) {
      const launchMapped = billingError(launchError, "billing_flow_failed");
      writeBillingDiagnostics({
        stage: "launchBillingFlow_exception",
        productId,
        durationId,
        selectedBasePlanId: basePlanId,
        selectedOfferId: offerId,
        offerTokenPresent: true,
        code: launchMapped.code,
        responseCode: launchMapped.responseCode,
        responseName: launchMapped.billingResponseCodeName,
        message: launchMapped.message,
        nativeCode: launchMapped.nativeCode || null,
        nativeMessage: launchMapped.nativeMessage || null,
        subResponseCode: launchMapped.subResponseCode || null,
        raw: String(launchError?.message || launchError || ""),
      });
      throw launchMapped;
    }

    const responseCode =
      result?.responseCode ??
      result?.billingResponseCode ??
      result?.response?.responseCode;
    const debugMessage =
      result?.debugMessage ||
      result?.response?.message ||
      result?.message ||
      "Google Play did not complete the purchase";
    const responseName = billingResponseName(responseCode);

    writeBillingDiagnostics({
      stage: "launchBillingFlow_result",
      productId,
      durationId,
      selectedBasePlanId: basePlanId,
      selectedOfferId: offerId,
      offerTokenPresent: true,
      responseCode: responseCode ?? null,
      responseName,
      debugMessage,
      subResponseCode: result?.subResponseCode ?? null,
      rawResult: result,
    });

    if (responseCode != null && String(responseCode) !== "0") {
      const flowError = billingError(
        {
          responseCode,
          message: `Google Play ${responseName} (code ${responseCode}): ${debugMessage}`,
          subResponseCode: result?.subResponseCode,
        },
        "billing_flow_failed",
      );
      flowError.message =
        `Google Play ${responseName} (code ${responseCode}) — ${debugMessage}`;
      flowError.productId = productId;
      flowError.basePlanId = basePlanId;
      flowError.offerId = offerId;
      return {
        success: false,
        preview: false,
        error: flowError,
      };
    }

    const token = extractPurchaseToken(result);
    if (!token) {
      const noTokenError = Object.assign(
        new Error(
          "Google Play opened/returned from the billing flow but did not provide a purchase token",
        ),
        {
          code: result?.pending ? "purchase_pending" : "purchase_not_completed",
          productId,
          basePlanId,
          offerId,
        },
      );
      writeBillingDiagnostics({
        stage: result?.pending ? "purchase_pending" : "purchase_token_missing",
        productId,
        selectedBasePlanId: basePlanId,
        selectedOfferId: offerId,
        responseCode: responseCode ?? null,
        responseName,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        message: noTokenError.message,
      });
      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: noTokenError,
      };
    }

    // IMPORTANT: do not acknowledge here. The server must independently verify
    // the token with Google Play before the purchase becomes acknowledged.
    return {
      success: true,
      preview: false,
      verified: false,
      nativeAcknowledged: false,
      acknowledgementDeferred: true,
      productId: purchaseProducts(result)[0] || productId,
      result,
    };
  } catch (e) {
    const error = billingError(e, "billing_flow_failed");
    writeBillingDiagnostics({
      stage: "purchase_exception",
      productId,
      durationId,
      code: error.code,
      responseCode: error.responseCode,
      responseName: error.billingResponseCodeName,
      message: error.message,
      nativeMessage: error.nativeMessage || null,
      subResponseCode: error.subResponseCode || null,
    });
    return {
      success: false,
      preview: false,
      error,
    };
  } finally {
    purchaseInFlight = false;
  }
}

export async function restorePurchases() {
  const billing = await getPlugin();
  if (!billing) return { restoredPlans: [], purchases: [], preview: true };

  const restoredPlans = [];
  const purchasesOut = [];

  try {
    await ensureBillingConnection(billing);

    let purchases = [];
    if (typeof billing.queryPurchases === "function") {
      const result = await billing.queryPurchases({ type: "SUBS" });
      purchases = Array.isArray(result) ? result : result?.purchases || [];
    } else if (typeof billing.getPurchases === "function") {
      const result = await billing.getPurchases();
      purchases = Array.isArray(result) ? result : result?.purchases || [];
    } else {
      return {
        restoredPlans: [],
        purchases: [],
        preview: false,
        unsupported: true,
        error: Object.assign(
          new Error("Active Google Play purchase queries are unavailable"),
          { code: "billing_restore_unsupported" },
        ),
      };
    }

    const activePurchases = (Array.isArray(purchases) ? purchases : []).filter(
      isPurchased,
    );

    const idToPlan = {};
    Object.entries(BILLING_PRODUCTS || {}).forEach(([plan, entry]) => {
      if (typeof entry === "string") {
        idToPlan[entry] = plan;
      } else {
        Object.values(entry || {}).forEach((pid) => {
          if (pid) idToPlan[pid] = plan;
        });
      }
    });

    activePurchases.forEach((purchase) => {
      const productIds = purchaseProducts(purchase);
      const token = extractPurchaseToken(purchase);
      productIds.forEach((id) => {
        const plan = idToPlan[id];
        if (plan && !restoredPlans.includes(plan)) restoredPlans.push(plan);
        if (plan && token) {
          purchasesOut.push({
            planId: plan,
            productId: id,
            purchaseToken: token,
            result: purchase,
          });
        }
      });
    });

    writeBillingDiagnostics({
      stage: "restore_complete",
      activePurchaseCount: activePurchases.length,
      restoredPlans,
    });

    return {
      restoredPlans,
      purchases: purchasesOut,
      preview: false,
      verified: false,
    };
  } catch (e) {
    const error = billingError(e, "billing_restore_failed");
    writeBillingDiagnostics({
      stage: "restore_failed",
      code: error.code,
      responseCode: error.responseCode,
      responseName: error.billingResponseCodeName,
      message: error.message,
    });
    return {
      restoredPlans,
      purchases: purchasesOut,
      preview: false,
      error,
    };
  }
}
