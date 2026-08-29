// ============================================================
// Google Play Billing Wrapper (Fifty Fit first-party bridge)
// ============================================================
// Native Google Play Billing is the source of purchase state.
// Product IDs and localized prices come from Google Play at runtime.
// Server verification/entitlement registration happens before the
// purchase is acknowledged; see registerPurchase.js.

import { BILLING_PRODUCTS, setPlayStorePricing } from "./config";
import { BillingPlugin as NativeBillingPlugin } from "./fiftyFitBilling";

const ANDROID_PACKAGE_NAME = "com.bodyahmed77.fiftyfit";
const EXPECTED_BASE_PLAN_BY_DURATION = {
  monthly: "monthly",
  quarterly: "quarterly",
  halfyearly: "halfyearly",
  yearly: "yearly",
};

const PURCHASE_FLOW_TIMEOUT_MS = 60000;

let plugin = NativeBillingPlugin;
let purchaseInFlight = false;
let billingConnected = false;

function withPurchaseTimeout(promise, ms = PURCHASE_FLOW_TIMEOUT_MS) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(
        "Google Play purchase flow exceeded the maximum allowed time",
      );
      err.code = "PURCHASE_FLOW_TIMEOUT";
      err.responseCode = null;
      err.nativeCode = null;
      err.nativeMessage = "Purchase operation timed out after 60 seconds";
      err.operationCode = "purchase_flow_timeout";
      reject(err);
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
  const responseCode =
    source?.responseCode ??
    source?.billingResponseCode ??
    e?.responseCode ??
    e?.billingResponseCode ??
    null;
  const operationCode =
    source?.operationCode ??
    e?.operationCode ??
    null;
  const fallback = operationCode || fallbackCode;
  const code =
    responseCode != null
      ? String(responseCode)
      : source?.code != null && !/^billing_|^purchase_|^native_/.test(String(source.code))
        ? String(source.code)
        : fallback;
  const message = String(
    source?.debugMessage ||
      source?.message ||
      e?.nativeMessage ||
      e?.message ||
      "Google Play Billing could not complete the operation",
  );
  const err = new Error(message);
  err.code = String(code);
  err.responseCode = responseCode;
  err.nativeCode =
    responseCode ??
    source?.code ??
    e?.nativeCode ??
    null;
  err.nativeMessage =
    source?.debugMessage || source?.message || e?.nativeMessage || e?.message || null;
  err.operationCode = operationCode || fallbackCode;
  err.billingResponseCodeName = billingResponseName(responseCode ?? err.code);
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
  if (result.productDetails && typeof result.productDetails === "object") return result.productDetails;
  if (Array.isArray(result.productDetailsList) && result.productDetailsList.length) return result.productDetailsList[0];
  if (Array.isArray(result.productDetails) && result.productDetails.length) return result.productDetails[0];
  if (Array.isArray(result)) return result[0] || null;
  return null;
}

function localizedDisplayPrice(details) {
  if (!details || typeof details !== "object") return null;
  const candidates = [details.formattedPrice, details.localizedPrice, details.priceString, details.displayPrice, details.price];
  for (const candidate of candidates) {
    if (candidate != null && String(candidate).trim()) return String(candidate).trim();
  }
  return null;
}

function getSubscriptionOffers(details) {
  if (!details || typeof details !== "object") return [];
  const candidates = [details.subscriptionOfferDetails, details.subscriptionOfferDetailsList, details.offers];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(Boolean);
  }
  return [];
}

function offerTokenOf(offer) { return offer?.offerToken || offer?.offer_token || null; }
function basePlanIdOf(offer) { return offer?.basePlanId || offer?.base_plan_id || null; }
function offerIdOf(offer) { return offer?.offerId || offer?.offer_id || null; }

function selectSubscriptionOffer(details, durationId) {
  const offers = getSubscriptionOffers(details);
  const expectedBasePlan = EXPECTED_BASE_PLAN_BY_DURATION[durationId] || null;
  const eligible = offers.filter((offer) => !!offerTokenOf(offer));
  if (!eligible.length) return { offer: null, offers, expectedBasePlan };
  const basePlanMatches = expectedBasePlan ? eligible.filter((offer) => basePlanIdOf(offer) === expectedBasePlan) : [];
  const candidates = basePlanMatches.length ? basePlanMatches : eligible;
  const preferred = candidates.find((offer) => !offerIdOf(offer)) || candidates[0] || null;
  return { offer: preferred, offers, expectedBasePlan };
}

async function queryModernProductDetailsForProduct(billing, productId) {
  if (!billing || typeof billing.queryProductDetails !== "function") return null;
  const result = await billing.queryProductDetails({ product: productId, type: "SUBS" });
  const details = normalizeSkuDetails(result);
  if (!details) return null;
  return {
    ...details,
    productId: details.productId || details.sku || details.id || productId,
    formattedPrice: localizedDisplayPrice(details),
    priceCurrencyCode: details.priceCurrencyCode || details.price_currency_code || details.currencyCode || null,
    source: "productDetails",
  };
}

async function queryAnyProductDetails(billing, productId) {
  try {
    return await queryModernProductDetailsForProduct(billing, productId);
  } catch (e) {
    writeBillingDiagnostics({
      stage: "product_query_failed",
      productId,
      code: e?.code || null,
      responseCode: e?.responseCode ?? null,
      responseName: billingResponseName(e?.responseCode ?? e?.code),
      debugMessage: e?.debugMessage || e?.nativeMessage || e?.message || String(e),
    });
    throw e;
  }
}

async function queryActiveSubscriptions(billing) {
  if (typeof billing?.queryPurchases !== "function") return [];
  const result = await billing.queryPurchases({ type: "SUBS" });
  return Array.isArray(result) ? result : result?.purchases || [];
}

export async function queryProducts() {
  if (!plugin) return { preview: true, products: null };
  const ids = allProductIds();
  if (!ids.length) {
    return { preview: false, products: [], error: Object.assign(new Error("No Google Play product IDs configured"), { code: "billing_products_missing" }) };
  }
  try {
    await ensureBillingConnection(plugin);
    const products = [];
    const unfetched = [];
    for (const id of ids) {
      try {
        const details = await queryAnyProductDetails(plugin, id);
        if (details && localizedDisplayPrice(details)) products.push(details);
        else unfetched.push({ productId: id, statusCode: "NO_PRODUCT_DETAILS", message: "Google Play returned no usable product details" });
      } catch (e) {
        unfetched.push({ productId: id, statusCode: e?.responseCode ?? e?.code ?? "query_failed", message: e?.message || String(e) });
      }
    }
    setPlayStorePricing(products);
    writeBillingDiagnostics({ stage: "catalog_loaded", productCount: products.length, unfetched });
    return { preview: false, products, unfetched };
  } catch (e) {
    const error = billingError(e, "billing_query_failed");
    writeBillingDiagnostics({ stage: "catalog_query_failed", code: error.code, responseCode: error.responseCode, responseName: error.billingResponseCodeName, message: error.message });
    return { preview: false, products: [], error };
  }
}

export async function purchase(planId, durationId) {
  if (purchaseInFlight) {
    return { success: false, preview: false, error: Object.assign(new Error("A Google Play purchase is already in progress"), { code: "billing_busy", operationCode: "billing_busy" }) };
  }

  const productId = productIdFor(planId, durationId);
  if (!productId) {
    return { success: false, preview: false, error: Object.assign(new Error("This Pro product is not configured yet"), { code: "product_not_configured" }) };
  }

  if (!plugin) {
    return { success: false, preview: true, message: "Billing is unavailable outside Android" };
  }

  purchaseInFlight = true;
  writeBillingDiagnostics({ stage: "purchase_started", productId, planId, durationId });

  try {
    const purchaseResult = await withPurchaseTimeout((async () => {
      await ensureBillingConnection(plugin);
      writeBillingDiagnostics({ stage: "purchase_connection_ready", productId, planId, durationId });

      const activeSubscriptions = await queryActiveSubscriptions(plugin);
      const alreadyOwned = activeSubscriptions.find((purchase) => isPurchased(purchase) && purchaseProducts(purchase).includes(productId));
      if (alreadyOwned) {
        // Treat already-owned as recoverable success so App can server-verify + unlock.
        const token = extractPurchaseToken(alreadyOwned);
        writeBillingDiagnostics({
          stage: "purchase_already_owned_recovered",
          productId,
          responseCode: 7,
          responseName: "ITEM_ALREADY_OWNED",
          purchaseTokenPresent: !!token,
        });
        return {
          success: true,
          preview: false,
          alreadyOwned: true,
          productId: purchaseProducts(alreadyOwned)[0] || productId,
          result: alreadyOwned,
          purchaseToken: token || null,
        };
      }

      const selected = await queryAnyProductDetails(plugin, productId);
      if (!selected || !localizedDisplayPrice(selected)) {
        const err = new Error(`Google Play did not return an available localized product for ${productId}`);
        err.code = "product_unavailable";
        err.productId = productId;
        throw err;
      }

      const selectedOffer = selectSubscriptionOffer(selected, durationId);
      const selectedOfferToken = offerTokenOf(selectedOffer.offer);
      const basePlanId = basePlanIdOf(selectedOffer.offer);
      const offerId = offerIdOf(selectedOffer.offer);
      if (!selectedOfferToken) {
        const err = new Error(`Google Play returned no eligible subscription offer for ${productId}`);
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
      });

      let result;
      try {
        writeBillingDiagnostics({ stage: "calling_native_launch", productId, durationId });
        result = await plugin.launchBillingFlow({ product: productId, type: "SUBS", offerToken: selectedOfferToken });
        writeBillingDiagnostics({ stage: "native_launch_returned", productId, durationId, rawResult: result });
      } catch (launchError) {
        const launchMapped = billingError(launchError, "billing_flow_failed");
        writeBillingDiagnostics({
          stage: "launchBillingFlow_exception",
          productId,
          durationId,
          selectedBasePlanId: basePlanId,
          selectedOfferId: offerId,
          code: launchMapped.code,
          responseCode: launchMapped.responseCode,
          responseName: launchMapped.billingResponseCodeName,
          message: launchMapped.message,
          nativeCode: launchMapped.nativeCode || null,
          nativeMessage: launchMapped.nativeMessage || null,
          operationCode: launchMapped.operationCode || null,
        });
        throw launchMapped;
      }

      const responseCode = result?.responseCode ?? result?.billingResponseCode ?? result?.response?.responseCode ?? null;
      const debugMessage = result?.debugMessage || result?.response?.message || result?.message || null;
      const responseName = billingResponseName(responseCode);

      writeBillingDiagnostics({
        stage: "launchBillingFlow_result",
        productId,
        durationId,
        selectedBasePlanId: basePlanId,
        selectedOfferId: offerId,
        offerTokenPresent: true,
        responseCode,
        responseName,
        debugMessage: debugMessage || null,
        subResponseCode: result?.subResponseCode ?? null,
        rawResult: result,
      });

      if (responseCode != null && String(responseCode) !== "0") {
        const flowError = billingError({ responseCode, message: debugMessage || `Google Play ${responseName} (code ${responseCode})`, subResponseCode: result?.subResponseCode }, "billing_flow_failed");
        flowError.message = `Google Play ${responseName} (code ${responseCode}) — ${debugMessage || "No debug message"}`;
        flowError.debugMessage = debugMessage || null;
        flowError.productId = productId;
        flowError.basePlanId = basePlanId;
        flowError.offerId = offerId;
        return { success: false, preview: false, error: flowError };
      }

      const token = extractPurchaseToken(result);
      if (!token) {
        const noTokenError = Object.assign(new Error(result?.pending ? "Google Play purchase is pending; waiting for purchase confirmation" : "Google Play returned no purchase token"), {
          code: result?.pending ? "purchase_pending" : "purchase_not_completed",
          operationCode: result?.pending ? "purchase_pending" : "purchase_token_missing",
          productId,
          basePlanId,
          offerId,
        });
        writeBillingDiagnostics({ stage: result?.pending ? "purchase_pending" : "purchase_token_missing", productId, responseCode: responseCode ?? null, pending: !!result?.pending, message: noTokenError.message });
        return { success: false, preview: false, pending: !!result?.pending, error: noTokenError };
      }

      writeBillingDiagnostics({ stage: "purchase_token_received", productId, purchaseTokenPresent: true });
      return {
        success: true,
        preview: false,
        verified: false,
        nativeAcknowledged: false,
        acknowledgementDeferred: true,
        productId: purchaseProducts(result)[0] || productId,
        result,
      };
    })());
    return purchaseResult;
  } catch (e) {
    const error = billingError(e, "billing_flow_failed");
    writeBillingDiagnostics({
      stage: error.operationCode || "purchase_exception",
      productId,
      planId,
      durationId,
      code: error.code,
      responseCode: error.responseCode,
      responseName: error.billingResponseCodeName,
      message: error.message,
      nativeMessage: error.nativeMessage || null,
      operationCode: error.operationCode || null,
      timeout: String(error.code || "").includes("TIMEOUT"),
    });
    return { success: false, preview: false, error };
  } finally {
    purchaseInFlight = false;
  }
}

export async function restorePurchases() {
  if (!plugin) return { restoredPlans: [], purchases: [], preview: true };
  const restoredPlans = [];
  const purchasesOut = [];
  try {
    await ensureBillingConnection(plugin);
    const result = await plugin.queryPurchases({ type: "SUBS" });
    const purchases = Array.isArray(result) ? result : result?.purchases || [];
    const activePurchases = purchases.filter(isPurchased);
    const idToPlan = {};
    Object.entries(BILLING_PRODUCTS || {}).forEach(([plan, entry]) => {
      if (typeof entry === "string") idToPlan[entry] = plan;
      else Object.values(entry || {}).forEach((pid) => { if (pid) idToPlan[pid] = plan; });
    });
    activePurchases.forEach((purchase) => {
      const productIds = purchaseProducts(purchase);
      const token = extractPurchaseToken(purchase);
      productIds.forEach((id) => {
        const plan = idToPlan[id];
        if (plan && !restoredPlans.includes(plan)) restoredPlans.push(plan);
        if (plan && token) purchasesOut.push({ planId: plan, productId: id, purchaseToken: token, result: purchase });
      });
    });
    return { restoredPlans, purchases: purchasesOut, preview: false, verified: false };
  } catch (e) {
    const error = billingError(e, "billing_restore_failed");
    writeBillingDiagnostics({ stage: "restore_failed", code: error.code, responseCode: error.responseCode, responseName: error.billingResponseCodeName, message: error.message });
    return { restoredPlans, purchases: purchasesOut, preview: false, error };
  }
}
