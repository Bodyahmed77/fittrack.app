#!/usr/bin/env python3
"""Patch generated Android resources and enforce the current Play target API.

This script runs after `npx cap sync`, so it is the right place for changes that
must survive the generated Android project being recreated on every CI build.

It currently:
- forces pure-black Android status/navigation bars;
- keeps adjustResize for the keyboard;
- forces compileSdk/targetSdk 36 for the Google Play 2026 submission deadline;
- installs Android 36/build-tools 36 when sdkmanager is available in CI.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "styles.xml"
STYLES_V31 = ROOT / "android" / "app" / "src" / "main" / "res" / "values-v31" / "styles.xml"
MANIFEST = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
VARIABLES = ROOT / "android" / "variables.gradle"

STATUS_ITEMS = [
    ("android:statusBarColor", "#000000"),
    ("android:navigationBarColor", "#000000"),
    ("android:windowBackground", "@android:color/black"),
    ("android:navigationBarDividerColor", "#000000"),
    ("android:windowLightStatusBar", "false"),
    ("android:windowLightNavigationBar", "false"),
    ("android:enforceStatusBarContrast", "false"),
    ("android:enforceNavigationBarContrast", "false"),
]


def _upsert_items_in_style_block(block: str) -> str:
    body = block
    for name, value in STATUS_ITEMS:
        item = f'<item name="{name}">{value}</item>'
        if re.search(rf'<item name="{re.escape(name)}">[^<]*</item>', body):
            body = re.sub(
                rf'<item name="{re.escape(name)}">[^<]*</item>',
                item,
                body,
            )
        else:
            body = re.sub(r"</style>", f"        {item}\n    </style>", body, count=1)
    return body


def patch_styles(path: Path) -> str:
    if not path.is_file():
        return f"{path} missing (skip)"
    text = path.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r"<style\b[^>]*>[\s\S]*?</style>",
        lambda m: _upsert_items_in_style_block(m.group(0)),
        text,
    )
    if n == 0:
        return f"{path.name}: no <style> blocks"
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return f"{path.name}: updated {n} style block(s)"
    return f"{path.name}: already ok ({n} style block(s))"


def patch_manifest(path: Path) -> str:
    if not path.is_file():
        return "AndroidManifest missing (skip)"
    text = path.read_text(encoding="utf-8")
    if "windowSoftInputMode" in text:
        new_text, n = re.subn(
            r'android:windowSoftInputMode="[^"]*"',
            'android:windowSoftInputMode="adjustResize"',
            text,
        )
        if n and new_text != text:
            path.write_text(new_text, encoding="utf-8")
            return "windowSoftInputMode -> adjustResize"
        return "windowSoftInputMode already set"
    new_text, n = re.subn(
        r'(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*)(>)',
        r'\1 android:windowSoftInputMode="adjustResize"\2',
        text,
        count=1,
    )
    if n and new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return "added windowSoftInputMode adjustResize"
    return "manifest unchanged"


def patch_android_api() -> str:
    if not VARIABLES.is_file():
        return "variables.gradle missing — cap add/sync may have failed"

    text = VARIABLES.read_text(encoding="utf-8")
    original = text
    text = re.sub(
        r"compileSdkVersion\s*=\s*\d+",
        "compileSdkVersion = 36",
        text,
    )
    text = re.sub(
        r"targetSdkVersion\s*=\s*\d+",
        "targetSdkVersion = 36",
        text,
    )
    if "compileSdkVersion" not in text:
        text = text.replace("ext {", "ext {\n    compileSdkVersion = 36", 1)
    if "targetSdkVersion" not in text:
        text = text.replace("ext {", "ext {\n    targetSdkVersion = 36", 1)
    if text != original:
        VARIABLES.write_text(text, encoding="utf-8")
        status = "compileSdkVersion=36 targetSdkVersion=36"
    else:
        status = "compileSdkVersion=36 targetSdkVersion=36 already set"

    sdkmanager = shutil.which("sdkmanager")
    if not sdkmanager:
        return status + "; sdkmanager not found (local build may need Android 36 installed manually)"

    try:
        subprocess.run(
            [sdkmanager, "platforms;android-36", "build-tools;36.0.0"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        return status + "; Android 36 SDK/build-tools installed"
    except subprocess.CalledProcessError as exc:
        print(exc.stdout or "")
        raise SystemExit("Failed to install Android 36 SDK/build-tools") from exc


def main() -> None:
    print(patch_android_api())
    print(patch_styles(STYLES))
    print(patch_styles(STYLES_V31))
    print(patch_manifest(MANIFEST))


if __name__ == "__main__":
    main()
