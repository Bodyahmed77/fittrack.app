#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKERS = (
    "before_launchBillingFlow",
    "launchBillingFlow_exception",
    "launchBillingFlow_result",
    "__fiftyFitBillingDiagnostics",
)
UI_MARKERS = (
    "formatBillingFailureToast",
    "Google Play code:",
)
TRANSFORM_MARKERS = (
    "extractBillingResponseCode",
)


def fail(message: str) -> None:
    print(f"RELEASE ARTIFACT VERIFICATION FAILED: {message}")
    raise SystemExit(1)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def read_text(path: Path) -> str:
    require(path.is_file() and path.stat().st_size > 0, f"missing or empty: {path}")
    return path.read_text(encoding="utf-8", errors="replace")


def verify_dependency_consistency() -> None:
    package = json.loads(read_text(ROOT / "package.json"))
    lock = json.loads(read_text(ROOT / "package-lock.json"))
    root_lock = lock.get("packages", {}).get("", {})
    package_dev = package.get("devDependencies", {})
    lock_dev = root_lock.get("devDependencies", {})
    require(
        lock_dev.get("@vitejs/plugin-react") == package_dev.get("@vitejs/plugin-react"),
        "package.json and package-lock.json disagree on @vitejs/plugin-react",
    )
    require(
        lock_dev.get("vite") == package_dev.get("vite"),
        "package.json and package-lock.json disagree on Vite",
    )


def verify_source_and_native() -> None:
    verify_dependency_consistency()
    src_billing = read_text(ROOT / "src/billing.js")
    src_app = read_text(ROOT / "src/App.jsx")
    vite = read_text(ROOT / "vite.config.js")
    require("responseCode" in src_billing and "responseName" in src_billing, "source does not retain BillingResponseCode diagnostics")
    require("offerToken" in src_billing, "source does not forward the subscription offer token")
    for marker in MARKERS[:3]:
        require(marker in src_billing, f"src/billing.js has no runtime billing marker: {marker}")
    for marker in UI_MARKERS:
        require(marker in src_app, f"src/App.jsx has no billing error UI marker: {marker}")
    for marker in TRANSFORM_MARKERS:
        require(marker in vite, f"vite.config.js is missing billing normalization transform: {marker}")

    native_plugin = ROOT / "node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java"
    native_text = read_text(native_plugin)
    native_gradle = read_text(ROOT / "node_modules/capacitor-billing/android/build.gradle")
    require("com.android.billingclient:billing:9.1.0" in native_gradle, "capacitor-billing native module is not pinned to Play Billing 9.1.0")
    require("com.android.billingclient:billing:7.1.0" not in native_gradle, "legacy PBL7 dependency remains in native module")
    for needle, label in (
        ("PendingPurchasesParams", "PBL9 pending-purchase API"),
        ("QueryProductDetailsResult", "PBL9 product-details callback"),
        ("enableAutoServiceReconnection()", "automatic billing service reconnection"),
        ("FIFTYFIT_BILLING_ERROR", "native billing diagnostic marker"),
    ):
        require(needle in native_text, f"missing {label}")


def verify_prebuild() -> None:
    verify_source_and_native()

    dist = ROOT / "dist"
    require(dist.is_dir(), "dist directory does not exist")
    dist_js = list(dist.rglob("*.js"))
    require(dist_js, "no JavaScript was emitted into dist")
    dist_text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in dist_js)
    for marker in MARKERS:
        require(marker in dist_text, f"dist is missing runtime billing marker: {marker}")
    for marker in UI_MARKERS:
        require(marker in dist_text, f"dist is missing billing error UI marker: {marker}")
    for marker in TRANSFORM_MARKERS:
        require(marker in dist_text, f"dist is missing billing error normalization transform: {marker}")

    android_public = ROOT / "android/app/src/main/assets/public"
    require(android_public.is_dir(), "Capacitor Android public assets directory missing")
    public_js = list(android_public.rglob("*.js"))
    require(public_js, "no JavaScript was copied into Android public assets")
    public_text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in public_js)
    for marker in MARKERS:
        require(marker in public_text, f"Android public assets are missing runtime billing marker: {marker}")
    for marker in UI_MARKERS:
        require(marker in public_text, f"Android public assets are missing billing error UI marker: {marker}")
    for marker in TRANSFORM_MARKERS:
        require(marker in public_text, f"Android public assets are missing billing error normalization transform: {marker}")

    print("PRE-BUILD RELEASE CONTENT GATE PASSED")
    print("Dependency, Billing diagnostics, and error normalization confirmed in source, dist and Android public assets")
    print("PBL9 native bridge and deterministic FIFTYFIT_BILLING_ERROR marker confirmed")


def verify_final_artifacts() -> None:
    verify_source_and_native()

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
        for marker in MARKERS:
            require(marker.encode() in packaged_js, f"AAB web assets are missing runtime billing marker: {marker}")
        for marker in UI_MARKERS:
            require(marker.encode() in packaged_js, f"AAB web assets are missing billing error UI marker: {marker}")
        for marker in TRANSFORM_MARKERS:
            require(marker.encode() in packaged_js, f"AAB web assets are missing billing error normalization transform: {marker}")

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
        for marker in MARKERS:
            require(marker.encode() in apk_js, f"APK web assets are missing runtime billing marker: {marker}")
        for marker in UI_MARKERS:
            require(marker.encode() in apk_js, f"APK web assets are missing billing error UI marker: {marker}")
        for marker in TRANSFORM_MARKERS:
            require(marker.encode() in apk_js, f"APK web assets are missing billing error normalization transform: {marker}")

    require(aab_index_hash == apk_index_hash, f"APK/AAB web index mismatch: {aab_index_hash} != {apk_index_hash}")

    print("FINAL RELEASE ARTIFACT VERIFICATION PASSED")
    print(f"AAB: {aab.stat().st_size} bytes")
    print(f"APK: {apk.stat().st_size} bytes")
    print(f"APK/AAB index sha256: {aab_index_hash}")
    print("Billing diagnostics and error normalization present in source, dist, Android assets, APK and AAB")
    print("Native FIFTYFIT_BILLING_ERROR marker present in source and AAB dex")


if __name__ == "__main__":
    if "--prebuild" in sys.argv:
        verify_prebuild()
    else:
        verify_final_artifacts()
