#!/usr/bin/env python3
"""Normalize capacitor-billing's Android source to Play Billing 9.1.0 APIs.

capacitor-billing@8.1.0 still declares/uses Play Billing 7-era APIs. The release
pipeline intentionally upgrades that module to PBL 9.1.0, so its Java source
must be made source-compatible as well.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
GRADLE = ROOT / "node_modules/capacitor-billing/android/build.gradle"
JAVA = ROOT / "node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java"

if not GRADLE.exists():
    print("capacitor-billing Gradle module not present yet; skip source patch")
    raise SystemExit(0)

# Dependency pin.
text = GRADLE.read_text(encoding="utf-8")
text2 = re.sub(r"com\.android\.billingclient:billing:7\.1\.0", "com.android.billingclient:billing:9.1.0", text)
text2 = re.sub(r"com\.android\.billingclient:billing:\s*\[?7\.1\.0\]?", "com.android.billingclient:billing:9.1.0", text2)
if text2 != text:
    GRADLE.write_text(text2, encoding="utf-8")
    print("capacitor-billing Play Billing dependency normalized: 7.1.0 -> 9.1.0")
else:
    print("capacitor-billing Play Billing dependency already normalized")

final = GRADLE.read_text(encoding="utf-8")
if "com.android.billingclient:billing:7.1.0" in final:
    raise SystemExit("PBL7 billing reference remains in capacitor-billing Gradle module")

if not JAVA.exists():
    print("capacitor-billing Java source not present; Gradle dependency only normalized")
    raise SystemExit(0)

java = JAVA.read_text(encoding="utf-8")
original = java

# PBL 9.1 replaces the no-arg pending-purchase opt-in with PendingPurchasesParams.
if "import com.android.billingclient.api.PendingPurchasesParams;" not in java:
    anchor = "import com.android.billingclient.api.ProductDetails;"
    if anchor in java:
        java = java.replace(anchor, anchor + "\nimport com.android.billingclient.api.PendingPurchasesParams;", 1)
    else:
        raise SystemExit("capacitor-billing Java: ProductDetails import anchor missing")
java = java.replace(
    ".enablePendingPurchases()",
    ".enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())",
)

# PBL 9.1 returns QueryProductDetailsResult instead of List<ProductDetails>.
java = java.replace("productDetailsList != null && !productDetailsList.isEmpty()", "productDetailsList != null && productDetailsList.getProductDetailsList() != null && !productDetailsList.getProductDetailsList().isEmpty()")
java = java.replace("productDetailsList.get(0)", "productDetailsList.getProductDetailsList().get(0)")
java = java.replace("rejectQueryProductDetailsFailure(call, billingResult1, productDetailsList);", "rejectQueryProductDetailsFailure(call, billingResult1, productDetailsList.getProductDetailsList());")

if java != original:
    JAVA.write_text(java, encoding="utf-8")
    print("capacitor-billing Java source normalized for Play Billing 9.1.0")
else:
    print("capacitor-billing Java source already normalized for Play Billing 9.1.0")

# Fail closed if known PBL7 API calls remain in the plugin source.
check = JAVA.read_text(encoding="utf-8")
for bad in (".enablePendingPurchases()", "productDetailsList.get(0)"):
    if bad in check:
        raise SystemExit(f"PBL7-era API remains in capacitor-billing source: {bad}")
