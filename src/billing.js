// ============================================================
// Google Play Billing Wrapper (capacitor-billing)
// ============================================================
// Clean, modular production abstraction around Google Play Billing.
// No RevenueCat — Google Play Billing only.

import { BILLING_PRODUCTS } from "./config";

let plugin = null;
let purchaseInFlight = false;

async function getPlugin() {
  if (plugin) return plugin;
  try {
    const mod = await import(/* @vite-ignore */ "capacitor-billing");
    plugin = mod.BillingPlugin;
    return plugin;
  } catch (e) {
    console.warn("Billing plugin not available — running in preview mode", e);
    return null;
  }
}

export function productIdFor(planId, durationId) {
  const id = BILLING_PRODUCTS[planId];
  return id || null;
}

export function allProductIds() {
  return Object.values(BILLING_PRODUCTS).filter(Boolean);
}

function purchaseProducts(purchase) {
  const products = purchase?.products || purchase?.productIds;
  if (Array.isArray(products)) return products;
  const product = purchase?.productId || purchase?.product;
  return product ? [product] : [];
}

function isPurchased(purchase) {
  return (
    purchase &&
    (purchase.purchaseState === 1 || purchase.purchaseState === "1") &&
    !!(purchase.purchaseToken || purchase.token)
  );
}

function extractPurchaseToken(purchase) {
  if (!purchase || typeof purchase !== "object") return null;
  const token =
    purchase.purchaseToken ||
    purchase.token ||
    purchase.purchase?.purchaseToken ||
    purchase.product?.purchaseToken;
  return typeof token === "string" && token ? token : null;
}

function billingError(e) {
  const code = e?.code || e?.responseCode || e?.response?.code || "";
  const message = String(e?.message || e?.response?.message || e || "Billing error");
  const err = new Error(message);
  if (code) err.code = String(code);
  return err;
}

// Some native billing implementations keep a failed/cancelled activity or
// connection alive. Clean it up when the plugin exposes a compatible method;
// never let cleanup failure mask the original billing error.
async function resetBillingAfterFailure(billing) {
  try {
    if (typeof billing?.endConnection === "function") await billing.endConnection();
    else if (typeof billing?.disconnect === "function") await billing.disconnect();
    else if (typeof billing?.close === "function") await billing.close();
  } catch (_) {
    // Best effort only.
  }
}

export async function queryProducts(durationId = "monthly") {
  const billing = await getPlugin();
  if (!billing) return { preview: true, products: null };
  try {
    let result = null;
    if (typeof billing.queryProductDetails === "function") {
      result = await billing.queryProductDetails({ products: allProductIds() });
    } else if (typeof billing.querySkuDetails === "function") {
      result = await billing.querySkuDetails({ product: allProductIds() });
    }
    const list = Array.isArray(result) ? result : result?.list || [];
    return { preview: false, products: list };
  } catch (e) {
    return { preview: false, products: [], error: billingError(e) };
  }
}

export async function purchase(planId, durationId) {
  const productId = productIdFor(planId, durationId);
  if (!productId) {
    return { success: false, preview: false, error: new Error("Missing product ID") };
  }

  if (purchaseInFlight) {
    return {
      success: false,
      preview: false,
      error: Object.assign(new Error("A billing operation is already in progress"), {
        code: "billing_busy",
      }),
    };
  }

  const billing = await getPlugin();
  if (!billing) {
    return { success: false, preview: true, message: "Preview mode — no real purchase" };
  }

  purchaseInFlight = true;
  try {
    const result = await billing.launchBillingFlow({
      product: productId,
      type: "SUBS",
    });

    if (!isPurchased(result)) {
      return {
        success: false,
        preview: false,
        error: Object.assign(
          new Error("Google Play did not return a completed purchase"),
          { code: "purchase_not_completed" },
        ),
      };
    }

    const token = extractPurchaseToken(result);
    if (!token || typeof billing.sendAck !== "function") {
      return {
        success: false,
        preview: false,
        error: Object.assign(
          new Error("Google Play purchase acknowledgement is unavailable"),
          { code: "ack_unavailable" },
        ),
      };
    }

    try {
      await billing.sendAck({ purchaseToken: token });
    } catch (ackErr) {
      return { success: false, preview: false, error: billingError(ackErr) };
    }

    return {
      success: true,
      preview: false,
      verified: true,
      productId: purchaseProducts(result)[0] || productId,
      result,
    };
  } catch (e) {
    const error = billingError(e);
    await resetBillingAfterFailure(billing);
    return { success: false, preview: false, error };
  } finally {
    // Critical: a cancelled/failed purchase must never lock the app into a
    // permanent "busy" state that forces the user to restart the app.
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
    }

    const activePurchases = (Array.isArray(purchases) ? purchases : []).filter(isPurchased);

    if (
      typeof billing.queryPurchases !== "function" &&
      typeof billing.getPurchases !== "function"
    ) {
      return {
        restoredPlans: [],
        purchases: [],
        preview: false,
        unsupported: true,
        error: new Error("Active Google Play purchase queries are unavailable"),
      };
    }

    const idToPlan = {};
    Object.entries(BILLING_PRODUCTS).forEach(([plan, pid]) => {
      idToPlan[pid] = plan;
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
      verified: true,
    };
  } catch (e) {
    return { restoredPlans, purchases: purchasesOut, preview: false, error: billingError(e) };
  }
}
