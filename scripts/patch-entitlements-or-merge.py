#!/usr/bin/env python3
"""Ensure admin Pro grants and Play purchases both unlock the UI.

1) Snapshot merge: OR Firestore entitlements with Play-verified flags.
2) Empty Play restore must not force-clear Pro (preserves admin grants).
3) productKey must be a string product id, not BILLING_PRODUCTS[planId] object.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
text = APP.read_text(encoding="utf-8")
original = text

# Ensure productIdFor is imported from billing
old_imp = """import {
  purchase as billingPurchase,
  queryProducts as billingQueryProducts,
  restorePurchases as billingRestore,
} from \"./billing\";"""
new_imp = """import {
  purchase as billingPurchase,
  queryProducts as billingQueryProducts,
  restorePurchases as billingRestore,
  productIdFor,
} from \"./billing\";"""
if "productIdFor," not in text and "productIdFor }" not in text:
    if old_imp not in text:
        raise SystemExit("billing import block not found")
    text = text.replace(old_imp, new_imp, 1)

old_merge = """          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },"""
new_merge = """          entitlements: (() => {
            // Admin grants live in Firestore; Play-verified flags live in the ref.
            // UI Pro = either source (OR). Never let an empty Play restore wipe admin Pro.
            const fs = parsed.entitlements || {};
            const vr = verifiedEntitlementsRef.current || {};
            return {
              trainingPro: !!(fs.trainingPro || vr.trainingPro),
              nutritionPro: !!(fs.nutritionPro || vr.nutritionPro),
              aiCoachPro: !!(fs.aiCoachPro || vr.aiCoachPro),
              proExpiresAt: vr.proExpiresAt || fs.proExpiresAt || null,
            };
          })(),"""

if "fs.trainingPro || vr.trainingPro" not in text:
    if old_merge not in text:
        raise SystemExit("entitlements merge block not found in App.jsx")
    text = text.replace(old_merge, new_merge, 1)

old_empty = """        if (!records.length) {
          // An empty real Play query means there are no active purchases.
          // Preview/unsupported results are not authoritative and must not wipe offline state.
          if (result?.preview || result?.unsupported) return;
          setVerifiedEntitlements({
            trainingPro: false,
            nutritionPro: false,
            aiCoachPro: false,
            proExpiresAt: null,
          });
          return;
        }"""
new_empty = """        if (!records.length) {
          // Empty Play query is not authoritative for admin-granted Pro in Firestore.
          // Do NOT force-clear verified flags — snapshot merge already ORs both sources.
          if (result?.preview || result?.unsupported) return;
          return;
        }"""

if "Do NOT force-clear verified flags" not in text:
    if old_empty not in text:
        raise SystemExit("empty restore block not found in App.jsx")
    text = text.replace(old_empty, new_empty, 1)

# productKey bug: BILLING_PRODUCTS[planId] is an object, not a string id
if "productIdFor(planId, durationId)" not in text and "BILLING_PRODUCTS[planId]?.[durationId]" not in text:
    if "BILLING_PRODUCTS[planId] || result?.productId" in text:
        text = text.replace(
            "BILLING_PRODUCTS[planId] || result?.productId || planId",
            """(typeof productIdFor === \"function\" ? productIdFor(planId, durationId) : null) ||
          result?.productId ||
          (typeof BILLING_PRODUCTS[planId] === \"string\"
            ? BILLING_PRODUCTS[planId]
            : BILLING_PRODUCTS[planId]?.[durationId] ||
              BILLING_PRODUCTS[planId]?.monthly) ||
          planId""",
            1,
        )
    else:
        raise SystemExit("productKey block not found")

if text != original:
    APP.write_text(text, encoding="utf-8")
    print("App.jsx: entitlements OR-merge + productKey string fix applied")
else:
    print("App.jsx: patches already present")
