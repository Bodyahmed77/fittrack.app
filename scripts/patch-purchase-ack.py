#!/usr/bin/env python3
"""Fix purchase productId + ensure server registration uses a string product id.

Native acknowledge happens in billing.js before this path runs.
Idempotent. Run from repo root before Vite build.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"


def main() -> None:
    if not APP.is_file():
        raise SystemExit(f"missing {APP}")
    src = APP.read_text(encoding="utf-8")
    original = src
    applied = 0

    old_import = """import {
  purchase as billingPurchase,
  queryProducts as billingQueryProducts,
  restorePurchases as billingRestore,
} from \"./billing\";"""

    new_import = """import {
  purchase as billingPurchase,
  queryProducts as billingQueryProducts,
  restorePurchases as billingRestore,
  productIdFor,
} from \"./billing\";"""

    if old_import in src:
        src = src.replace(old_import, new_import, 1)
        applied += 1
    elif "productIdFor," in src and 'from "./billing"' in src:
        applied += 1
    else:
        print("WARN: billing import pattern not found")

    old_key = """        const productKey =
          BILLING_PRODUCTS[planId] || result?.productId || planId;
        try {
          await registerServerEntitlement(
            productKey,
            result?.productId || productKey,
            result?.result,
          );"""

    new_key = """        // Always pass a concrete Google Play product id string (never the
        // BILLING_PRODUCTS duration map object). Native acknowledge already
        // ran in billing.purchase(); this call grants Supabase entitlements
        // so the admin dashboard can see the subscription.
        const productKey =
          (typeof result?.productId === "string" && result.productId) ||
          productIdFor(planId, durationId) ||
          planId;
        try {
          await registerServerEntitlement(
            productKey,
            productKey,
            result?.result || result,
          );"""

    if old_key in src:
        src = src.replace(old_key, new_key, 1)
        applied += 1
    elif "productIdFor(planId, durationId)" in src:
        applied += 1
    else:
        print("WARN: productKey registration block not found")

    if src != original:
        APP.write_text(src, encoding="utf-8")
        print(f"patch-purchase-ack: wrote {APP} ({applied} patterns)")
    else:
        print(f"patch-purchase-ack: already up to date ({applied} patterns matched)")


if __name__ == "__main__":
    main()
