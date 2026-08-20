#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def fail(message: str) -> None:
    print(f"RELEASE ARTIFACT VERIFICATION FAILED: {message}")
    raise SystemExit(1)

def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)

def read_text(path: Path) -> str:
    require(path.is_file() and path.stat().st_size > 0, f"missing or empty: {path}")
    return path.read_text(encoding="utf-8", errors="replace")

def main() -> None:
    src_billing = read_text(ROOT / "src/billing.js")
    require("before_launchBillingFlow" in src_billing, "src/billing.js has no pre-launch billing diagnostic marker")
    require("launchBillingFlow_exception" in src_billing, "src/billing.js has no launch exception diagnostic marker")
    require("launchBillingFlow_result" in src_billing, "src/billing.js has no launch result diagnostic marker")
    require("responseCode" in src_billing and "responseName" in src_billing, "source does not retain BillingResponseCode diagnostics")
    require("offerToken" in src_billing, "source does not forward the subscription offer token")

    dist = ROOT / "dist"
    require(dist.is_dir(), "dist directory does not exist")
    dist_js = list(dist.rglob("*.js"))
    require(dist_js, "no JavaScript was emitted into dist")
    dist_text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in dist_js)
    for marker in ("before_launchBillingFlow", "launchBillingFlow_exception", "launchBillingFlow_result", "__fiftyFitBillingDiagnostics"):
        require(marker in dist_text, f"dist is missing runtime billing marker: {marker}")

    android_public = ROOT / "android/app/src/main/assets/public"
    require(android_public.is_dir(), "Capacitor Android public assets directory missing")
    public_js = list(android_public.rglob("*.js"))
    require(public_js, "no JavaScript was copied into Android public assets")
    public_text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in public_js)
    for marker in ("before_launchBillingFlow", "launchBillingFlow_exception", "launchBillingFlow_result", "__fiftyFitBillingDiagnostics"):
        require(marker in public_text, f"Android public assets are missing runtime billing marker: {marker}")

    native_plugin = ROOT / "node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java"
    native_text = read_text(native_plugin)
    require("com.android.billingclient:billing:9.1.0" in (ROOT / "node_modules/capacitor-billing/android/build.gradle").read_text(encoding="utf-8", errors="replace"), "capacitor-billing native module is not pinned to Play Billing 9.1.0")
    require("PendingPurchasesParams" in native_text, "native billing bridge still uses the old pending-purchase API")
    require("QueryProductDetailsResult" in native_text, "native billing bridge lacks the PBL9 product-details callback")
    require("enableAutoServiceReconnection()" in native_text, "native billing bridge lacks automatic service reconnection")
    require("FIFTYFIT_BILLING_ERROR" in native_text, "native billing bridge is missing the deterministic diagnostic marker")

    artifact_dir = ROOT / "android/release-artifacts"
    aab = artifact_dir / "fifty-fit-release.aab"
    apk = artifact_dir / "fifty-fit-release.apk"
    require(aab.is_file() and aab.stat().st_size > 0, "release AAB is missing or empty")
    require(apk.is_file() and apk.stat().st_size > 0, "release APK is missing or empty")

    with zipfile.ZipFile(aab) as z:
        names = z.namelist()
        js_entries = [n for n in names if n.endswith(".js") and "/assets/public/" in n]
        require(js_entries, "AAB contains no packaged web JavaScript assets")
        packaged_js = b"\n".join(z.read(n) for n in js_entries)
        for marker in (b"before_launchBillingFlow", b"launchBillingFlow_exception", b"launchBillingFlow_result", b"__fiftyFitBillingDiagnostics"):
            require(marker in packaged_js, f"AAB web assets are missing runtime billing marker: {marker.decode()}")
        dex_entries = [n for n in names if n.endswith("classes.dex")]
        require(dex_entries, "AAB contains no classes.dex")
        dex_bytes = b"\n".join(z.read(n) for n in dex_entries)
        require(b"FIFTYFIT_BILLING_ERROR" in dex_bytes, "AAB native dex does not contain FIFTYFIT_BILLING_ERROR")

        module_indexes = [n for n in names if n.endswith("/assets/public/index.html")]
        require(module_indexes, "AAB contains no packaged web index.html")
        aab_index_hash = hashlib.sha256(z.read(module_indexes[0])).hexdigest()

    with zipfile.ZipFile(apk) as z:
        require("assets/public/index.html" in z.namelist(), "APK contains no packaged web index.html")
        apk_index_hash = hashlib.sha256(z.read("assets/public/index.html")).hexdigest()
        apk_js = b"\n".join(z.read(n) for n in z.namelist() if n.endswith(".js"))
        for marker in (b"before_launchBillingFlow", b"launchBillingFlow_exception", b"launchBillingFlow_result"):
            require(marker in apk_js, f"APK web assets are missing runtime billing marker: {marker.decode()}")

    require(aab_index_hash == apk_index_hash, f"APK/AAB web index mismatch: {aab_index_hash} != {apk_index_hash}")

    print("RELEASE ARTIFACT VERIFICATION PASSED")
    print(f"AAB: {aab.stat().st_size} bytes")
    print(f"APK: {apk.stat().st_size} bytes")
    print(f"APK/AAB index sha256: {aab_index_hash}")
    print("Billing runtime diagnostics: present in source, dist, Android assets, APK and AAB")
    print("Native FIFTYFIT_BILLING_ERROR marker: present in source and AAB dex")

if __name__ == "__main__":
    main()
