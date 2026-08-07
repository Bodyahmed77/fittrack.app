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

    // Acknowledge the purchase so Google doesn't auto-refund it.
    // A real subscription must be acknowledged within 3 days; we do it
    // immediately after a successful flow using the returned purchase token.
    const token =
      result?.purchaseToken ||
      result?.product?.purchaseToken ||
      result?.purchase?.purchaseToken;
    if (token && typeof billing.sendAck === "function") {
      try {
        await billing.sendAck({ purchaseToken: token });
      } catch (ackErr) {
        // Already acknowledged, or a manual-ack setup in Play Console.
        console.warn("Ack failed (may already be acknowledged)", ackErr);
      }
    }

    return { success: true, preview: false, result };
  } catch (e) {
    // User cancelled the flow or a billing error occurred.
    return { success: false, preview: false, error: e };
  }
}

// Restore any previously purchased (and still active) subscriptions.
// Iterates every configured product ID so "both_pro" and the individual
// plans are all considered. Returns the list of restored plan IDs.
export async function restorePurchases() {
  const billing = await getPlugin();
  if (!billing) return { restoredPlans: [], preview: true };

  const restoredPlans = [];
  try {
    // Query all active purchases for our subscription products.
    let purchases = [];
    if (typeof billing.queryPurchases === "function") {
      purchases = (await billing.queryPurchases({ type: "SUBS" })) || [];
    } else if (typeof billing.getPurchases === "function") {
      purchases = (await billing.getPurchases()) || [];
    }

    // In Google Play Billing, queryPurchases returns active subscriptions
    // keyed by product. Map any returned product IDs back to our plans.
    const ids = Array.isArray(purchases) ? purchases : [];
    const normalized = Array.isArray(ids) ? ids : [];
    const activeIds = normalized.map((p) => p?.productId || p?.product || p);
    if (activeIds.length === 0) {
      // Fallback: probe each product individually (older plugin shape).
      for (const pid of allProductIds()) {
        let res = null;
        if (typeof billing.querySkuDetails === "function") {
          res = await billing.querySkuDetails({ product: pid, type: "SUBS" });
        }
        const found = Array.isArray(res) ? res.length > 0 : !!res;
        if (found) activeIds.push(pid);
      }
    }

    // Map product IDs back to plan keys (training / nutrition / both).
    const idToPlan = {};
    Object.entries(BILLING_PRODUCTS).forEach(([plan, pid]) => {
      idToPlan[pid] = plan;
    });
    activeIds.forEach((id) => {
      const plan = idToPlan[id];
      if (plan && !restoredPlans.includes(plan)) restoredPlans.push(plan);
    });

    return { restoredPlans, preview: false };
  } catch (e) {
    return { restoredPlans, preview: false, error: e };
  }
}
