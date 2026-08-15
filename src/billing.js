// ============================================================
// Google Play Billing Wrapper (capacitor-billing)
// ============================================================
// Native Google Play Billing is the source of purchase state.
// Product IDs and localized prices come from Google Play at runtime.

import { BILLING_PRODUCTS, setPlayStorePricing } from "./config";

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
  } catch (e) {
    billingConnected = false;
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
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
  return err;
}

function normalizeSkuDetails(result) {
  if (!result || typeof result !== "object") return null;
  if (result.value === "web") return result;
  if (result.productId || result.sku || result.id || result.price) return result;
  if (result.productDetails && typeof result.productDetails === "object") {
    return result.productDetails;
  }
  return result;
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

  return normalizeSkuDetails(result);
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
        const details = await querySkuDetailsForProduct(billing, id);
        if (details) {
          products.push({
            ...details,
            productId: details.productId || details.sku || details.id || id,
          });
        } else {
          unfetched.push({
            productId: id,
            message: "querySkuDetails returned no product details",
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

    return {
      preview: false,
      products,
      unfetched,
    };
  } catch (e) {
    return {
      preview: false,
      products: [],
      error: billingError(e, "billing_query_failed"),
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

    const token = extractPurchaseToken(result);
    if (!token) {
      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: Object.assign(
          new Error("Google Play did not return a purchase token"),
          {
            code: result?.pending
              ? "purchase_pending"
              : "purchase_not_completed",
          },
        ),
      };
    }

    if (typeof billing.sendAck === "function") {
      try {
        await billing.sendAck({ purchaseToken: token });
      } catch (ackErr) {
        return {
          success: false,
          preview: false,
          error: billingError(ackErr, "ack_failed"),
        };
      }
    } else if (typeof billing.acknowledgePurchase === "function") {
      try {
        await billing.acknowledgePurchase({ purchaseToken: token });
      } catch (ackErr) {
        return {
          success: false,
          preview: false,
          error: billingError(ackErr, "ack_failed"),
        };
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
      verified: true,
      nativeAcknowledged: true,
      productId: purchaseProducts(result)[0] || productId,
      result,
    };
  } catch (e) {
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
