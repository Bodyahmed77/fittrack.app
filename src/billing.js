// ============================================================
// Google Play Billing Wrapper (capacitor-billing)
// ============================================================
// Defensive production wrapper around Google Play Billing.
// The native billing plugin is the only source of purchase state.
// Server verification happens separately in registerPurchase.js.

import { BILLING_PRODUCTS } from "./config";

let plugin = null;
let purchaseInFlight = false;

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

export function productIdFor(planId, _durationId) {
  const id = BILLING_PRODUCTS?.[planId];
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function allProductIds() {
  return [...new Set(Object.values(BILLING_PRODUCTS || {}).filter(Boolean))];
}

function purchaseProducts(purchase) {
  const products = purchase?.products || purchase?.productIds;
  if (Array.isArray(products)) return products.filter(Boolean);
  const product = purchase?.productId || purchase?.product;
  return product ? [product] : [];
}

function isPurchased(purchase) {
  if (!purchase || typeof purchase !== "object") return false;
  const state = purchase.purchaseState ?? purchase.purchase?.purchaseState;
  const token = extractPurchaseToken(purchase);
  return (state === 1 || state === "1") && !!token;
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
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
  return err;
}

function normalizeProductList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  if (Array.isArray(result?.list)) return result.list;
  if (Array.isArray(result?.productDetails)) return result.productDetails;
  return [];
}

function productMatches(product, productId) {
  const ids = [
    product?.productId,
    product?.product,
    product?.sku,
    product?.id,
  ].filter(Boolean);
  return ids.includes(productId);
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
    let result = null;
    if (typeof billing.queryProductDetails === "function") {
      result = await billing.queryProductDetails({ products: ids, type: "SUBS" });
    } else if (typeof billing.querySkuDetails === "function") {
      result = await billing.querySkuDetails({ product: ids, type: "SUBS" });
    } else {
      return {
        preview: false,
        products: [],
        unsupported: true,
        error: Object.assign(
          new Error("Google Play product query is unavailable in this billing build"),
          { code: "billing_query_unsupported" },
        ),
      };
    }

    const list = normalizeProductList(result);
    return {
      preview: false,
      products: list,
      unfetched: result?.unfetchedProducts || result?.unfetched || [],
    };
  } catch (e) {
    return { preview: false, products: [], error: billingError(e, "billing_query_failed") };
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
      error: Object.assign(new Error("A Google Play purchase is already in progress"), {
        code: "billing_busy",
      }),
    };
  }

  const billing = await getPlugin();
  if (!billing) {
    return { success: false, preview: true, message: "Billing is unavailable outside Android" };
  }

  purchaseInFlight = true;

  try {
    // Do not open the native purchase screen with an unknown/unavailable SKU.
    // This avoids a large class of native BillingClient errors and prevents
    // the WebView from being left in a broken state after a failed attempt.
    if (typeof billing.queryProductDetails === "function" || typeof billing.querySkuDetails === "function") {
      const catalog = await queryProducts();
      if (catalog?.error) {
        return { success: false, preview: false, error: catalog.error };
      }
      const list = Array.isArray(catalog?.products) ? catalog.products : [];
      if (list.length && !list.some((p) => productMatches(p, productId))) {
        return {
          success: false,
          preview: false,
          error: Object.assign(
            new Error(`Google Play product is unavailable: ${productId}`),
            { code: "product_unavailable" },
          ),
        };
      }
      if (!list.length) {
        return {
          success: false,
          preview: false,
          error: Object.assign(
            new Error(`Google Play product is unavailable: ${productId}`),
            { code: "product_unavailable" },
          ),
        };
      }
    }

    const result = await billing.launchBillingFlow({
      product: productId,
      type: "SUBS",
    });

    const responseCode =
      result?.responseCode ??
      result?.billingResponseCode ??
      result?.response?.responseCode;
    if (responseCode != null && String(responseCode) !== "0") {
      return {
        success: false,
        preview: false,
        error: billingError(
          {
            responseCode,
            message: result?.debugMessage || result?.response?.message,
            subResponseCode: result?.subResponseCode,
          },
          "billing_flow_failed",
        ),
      };
    }

    if (!isPurchased(result)) {
      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: Object.assign(
          new Error("Google Play purchase was not completed"),
          { code: result?.pending ? "purchase_pending" : "purchase_not_completed" },
        ),
      };
    }

    const token = extractPurchaseToken(result);
    if (!token) {
      return {
        success: false,
        preview: false,
        error: Object.assign(new Error("Google Play purchase token is missing"), {
          code: "purchase_token_missing",
        }),
      };
    }

    if (typeof billing.sendAck === "function") {
      try {
        await billing.sendAck({ purchaseToken: token });
      } catch (ackErr) {
        return { success: false, preview: false, error: billingError(ackErr, "ack_failed") };
      }
    } else {
      return {
        success: false,
        preview: false,
        error: Object.assign(
          new Error("Google Play acknowledgement is unavailable"),
          { code: "ack_unavailable" },
        ),
      };
    }

    return {
      success: true,
      preview: false,
      // This means the native BillingClient purchase was acknowledged and a
      // purchase token is present. It is NOT server verification. The caller
      // immediately performs verify-purchase before unlocking Pro.
      verified: true,
      nativeAcknowledged: true,
      productId: purchaseProducts(result)[0] || productId,
      result,
    };
  } catch (e) {
    // IMPORTANT: do NOT call endConnection/disconnect/close here. Some native
    // billing implementations keep a shared BillingClient connection and
    // tearing it down after a transient error can make the next purchase fail
    // until the whole application is restarted.
    return {
      success: false,
      preview: false,
      error: billingError(e, "billing_flow_failed"),
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

    const activePurchases = (Array.isArray(purchases) ? purchases : []).filter(isPurchased);
    const idToPlan = {};
    Object.entries(BILLING_PRODUCTS || {}).forEach(([plan, pid]) => {
      if (pid) idToPlan[pid] = plan;
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

    return {
      restoredPlans,
      purchases: purchasesOut,
      preview: false,
      verified: false,
    };
  } catch (e) {
    return {
      restoredPlans,
      purchases: purchasesOut,
      preview: false,
      error: billingError(e, "billing_restore_failed"),
    };
  }
}
