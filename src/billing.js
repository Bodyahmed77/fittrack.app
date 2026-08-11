// ============================================================
// Google Play Billing Wrapper (capacitor-billing)
// ============================================================
// Clean, modular, production-shaped abstraction around the
// `capacitor-billing` plugin. All product IDs come from config.js
// (Google Play Console IDs). No RevenueCat — Google Play Billing only.
//
// Notes for real devices:
//  - The plugin resolves to BillingPlugin on Android. On the web
//    (vite preview / Capacitor web view) the dynamic import fails,
//    so we gracefully return `preview: true` and let the calling app
//    decide how to handle it (e.g. unlock in dev preview only).
// ============================================================

import { BILLING_PRODUCTS } from "./config";

// Dynamic import so the app still runs in web preview without the plugin.
let plugin = null;
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

// Map a plan to its product ID from config.js (single ID per plan).
export function productIdFor(planId, durationId) {
  const id = BILLING_PRODUCTS[planId];
  return id || null;
}

// All active subscription product IDs (used for restoration & queries).
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

// Query the Google Play Console for the current SKU details so the
// paywall can show the real price from the store, not a hardcoded one.
export async function queryProducts(durationId = "monthly") {
  const billing = await getPlugin();
  if (!billing) return { preview: true, products: null };
  try {
    // queryProductDetails returns array of { productId, price, title, ... }.
    // Older plugins use querySkuDetails. Try both defensively.
    let result = null;
    if (typeof billing.queryProductDetails === "function") {
      result = await billing.queryProductDetails({
        products: allProductIds(),
      });
    } else if (typeof billing.querySkuDetails === "function") {
      result = await billing.querySkuDetails({
        product: allProductIds(),
      });
    }
    // Normalize both shapes into { productId, price } entries.
    const list = Array.isArray(result) ? result : result?.list || [];
    return { preview: false, products: list };
  } catch (e) {
    return { preview: false, products: [], error: e };
  }
}

// Launch the native Google Play billing flow for a subscription.
// Returns { success, preview, error, result } — preview is true when the
// plugin isn't available (web preview / dev).
export async function purchase(planId, durationId) {
  const productId = productIdFor(planId, durationId);
  if (!productId) {
    return { success: false, preview: false, error: "Missing product ID" };
  }

  const billing = await getPlugin();
  if (!billing) {
    return {
      success: false,
      preview: true,
      message: "Preview mode — no real purchase",
    };
  }

  try {
    // Subscriptions use type "SUBS"
    const result = await billing.launchBillingFlow({
      product: productId,
      type: "SUBS",
    });

    if (!isPurchased(result)) {
      return {
        success: false,
        preview: false,
        error: new Error("Google Play did not return a completed purchase"),
      };
    }

    // Acknowledge the purchase so Google doesn't auto-refund it.
    // A real subscription must be acknowledged within 3 days; we do it
    // immediately after a successful flow using the returned purchase token.
    const token =
      result?.purchaseToken ||
      result?.product?.purchaseToken ||
      result?.purchase?.purchaseToken;
    if (!token || typeof billing.sendAck !== "function") {
      return {
        success: false,
        preview: false,
        error: new Error("Google Play purchase acknowledgement is unavailable"),
      };
    }
    try {
      await billing.sendAck({ purchaseToken: token });
    } catch (ackErr) {
      return { success: false, preview: false, error: ackErr };
    }

    return {
      success: true,
      preview: false,
      verified: true,
      productId: purchaseProducts(result)[0] || productId,
      result,
    };
  } catch (e) {
    // User cancelled the flow or a billing error occurred.
    return { success: false, preview: false, error: e };
  }
}

// Restore any previously purchased (and still active) subscriptions.
// Returns plan keys PLUS the underlying purchase records (token + productId)
// so the caller can run server-side Google Play verification before unlocking.
// Client-side presence of a purchase must NEVER be treated as authoritative
// entitlement on its own.
export async function restorePurchases() {
  const billing = await getPlugin();
  if (!billing) return { restoredPlans: [], purchases: [], preview: true };

  const restoredPlans = [];
  const purchasesOut = [];
  try {
    // Query all active purchases for our subscription products.
    let purchases = [];
    if (typeof billing.queryPurchases === "function") {
      const result = await billing.queryPurchases({ type: "SUBS" });
      purchases = Array.isArray(result) ? result : result?.purchases || [];
    } else if (typeof billing.getPurchases === "function") {
      const result = await billing.getPurchases();
      purchases = Array.isArray(result) ? result : result?.purchases || [];
    }

    // Only purchase records can grant entitlements. Product-detail queries
    // describe catalog items and must never be treated as purchases.
    const activePurchases = (Array.isArray(purchases) ? purchases : []).filter(
      isPurchased,
    );

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

    // Map product IDs back to plan keys (training / nutrition / both / ai).
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
            // Shape expected by registerServerEntitlement / extractToken
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
    return { restoredPlans, purchases: purchasesOut, preview: false, error: e };
  }
}
