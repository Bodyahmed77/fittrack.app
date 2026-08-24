#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_MARKERS = (
    "FIFTYFIT_NATIVE_BILLING_V6",
    "FiftyFitBilling",
    "responseCode",
    "debugMessage",
)


def fail(message: str) -> None:
    print(f"FIRST-PARTY BILLING RELEASE CHECK FAILED: {message}")
    raise SystemExit(1)


def require(value: bool, message: str) -> None:
    if not value:
        fail(message)


def text(path: Path) -> str:
    require(path.is_file() and path.stat().st_size > 0, f"missing: {path}")
    return path.read_text(encoding="utf-8", errors="replace")


def contains_legacy_runtime_import(bundle: str) -> bool:
    """Reject executable imports/requires, but allow harmless diagnostics/comments."""
    patterns = (
        r'\bimport\s*\(\s*["\']capacitor-billing["\']\s*\)',
        r'\brequire\s*\(\s*["\']capacitor-billing["\']\s*\)',
    )
    return any(re.search(pattern, bundle) for pattern in patterns)


def source_checks() -> None:
    pkg = json.loads(text(ROOT / "package.json"))
    lock = json.loads(text(ROOT / "package-lock.json"))
    root = lock.get("packages", {}).get("") or {}
    require(pkg.get("devDependencies", {}).get("vite") == root.get("devDependencies", {}).get("vite"), "Vite manifest/lock mismatch")
    require(pkg.get("devDependencies", {}).get("@vitejs/plugin-react") == root.get("devDependencies", {}).get("@vitejs/plugin-react"), "React Vite plugin manifest/lock mismatch")

    js = text(ROOT / "src/fiftyFitBilling.js")
    release_cfg = text(ROOT / "vite.release.config.js")
    billing = text(ROOT / "src/billing.js")
    app = text(ROOT / "src/App.jsx")

    require('registerPlugin("FiftyFitBilling")' in js, "JS first-party Billing plugin registration missing")
    require("FIFTYFIT_NATIVE_BILLING_V6" in js, "JS first-party Billing marker missing")

    # The release build now uses a direct static import from billing.js. Do not
    # require an alias for capacitor-billing when the legacy runtime is no
    # longer imported at all. The important invariants are that the source
    # entrypoint is first-party and the release config does not re-introduce
    # an executable legacy import.
    require("capacitor-billing" not in release_cfg, "release Vite config still references legacy capacitor-billing runtime")
    require("fiftyFitBillingEntry" not in release_cfg, "release Vite config contains obsolete first-party alias machinery")
    require("forceFirstPartyBillingImport" not in release_cfg, "release Vite config contains obsolete import rewrite machinery")
    require('from "./fiftyFitBilling"' in billing or "from './fiftyFitBilling'" in billing, "billing.js does not statically import first-party FiftyFitBilling")
    require("responseCode" in billing and "launchBillingFlow" in billing, "billing.js does not retain Billing response diagnostics")
    require("formatBillingFailureToast" in app and "Google Play code:" in app, "Paywall billing diagnostics UI missing")

    native = ROOT / "android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java"
    native_text = text(native)
    gradle = text(ROOT / "android/app/build.gradle")
    main_files = list((ROOT / "android/app/src/main/java").rglob("MainActivity.java"))
    require(main_files, "MainActivity.java missing")
    main = text(main_files[0])

    for marker in (
        "FIFTYFIT_NATIVE_BILLING_V6",
        "@CapacitorPlugin(name = \"FiftyFitBilling\")",
        "enableAutoServiceReconnection()",
        "PendingPurchasesParams",
        "launchBillingFlow",
        "responseCode",
        "debugMessage",
        "call.resolve",
        "subscriptionOfferDetails",
    ):
        require(marker in native_text, f"native bridge missing marker: {marker}")
    require("com.android.billingclient:billing:9.1.0" in gradle, "app does not compile against Google Play Billing 9.1.0")
    require("FiftyFitBillingPlugin" in main and "registerPlugin(FiftyFitBillingPlugin.class)" in main, "first-party Billing plugin is not registered in MainActivity")


def bundled_js() -> str:
    dist = ROOT / "dist"
    files = list(dist.rglob("*.js"))
    require(files, "no dist JavaScript files")
    return "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in files)


def verify_prebuild() -> None:
    source_checks()
    dist = bundled_js()
    for marker in WEB_MARKERS:
        require(marker in dist, f"dist missing first-party billing marker: {marker}")
    require(not contains_legacy_runtime_import(dist), "dist still contains an executable legacy capacitor-billing runtime import")
    require("FiftyFitBilling" in dist, "dist does not contain the first-party FiftyFitBilling registration")
    public = ROOT / "android/app/src/main/assets/public"
    require(public.is_dir(), "Android public assets directory missing")
    public_js = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in public.rglob("*.js"))
    for marker in WEB_MARKERS:
        require(marker in public_js, f"Android public assets missing first-party billing marker: {marker}")
    require(not contains_legacy_runtime_import(public_js), "Android public assets contain an executable legacy capacitor-billing runtime import")
    print("FIRST-PARTY BILLING PREBUILD CHECK PASSED")


def verify_final() -> None:
    source_checks()
    artifact_dir = ROOT / "android/release-artifacts"
    aab = artifact_dir / "fifty-fit-release.aab"
    apk = artifact_dir / "fifty-fit-release.apk"
    require(aab.exists() and aab.stat().st_size > 0, "AAB missing")
    require(apk.exists() and apk.stat().st_size > 0, "APK missing")

    for path, label in ((aab, "AAB"), (apk, "APK")):
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            all_js = [n for n in names if n.endswith(".js")]
            require(all_js, f"{label} has no packaged JavaScript")
            js = b"\n".join(z.read(n) for n in all_js).decode("utf-8", errors="replace")
            for marker in WEB_MARKERS:
                require(marker in js, f"{label} JavaScript missing marker: {marker}")
            require(not contains_legacy_runtime_import(js), f"{label} JavaScript contains an executable legacy capacitor-billing runtime import")
            require("FiftyFitBilling" in js, f"{label} JavaScript is missing first-party FiftyFitBilling")
            dex = [n for n in names if n.endswith("classes.dex")]
            require(dex, f"{label} has no classes.dex")
            dex_bytes = b"\n".join(z.read(n) for n in dex)
            for marker in (b"FiftyFitBilling", b"FIFTYFIT_BILLING_ERROR", b"ResponseCode"):
                require(marker in dex_bytes, f"{label} native dex missing marker: {marker.decode()}")

    print("FINAL FIRST-PARTY BILLING AAB/APK CHECK PASSED")
    print(aab)
    print(apk)


if __name__ == "__main__":
    if "--prebuild" in sys.argv:
        verify_prebuild()
    else:
        verify_final()
