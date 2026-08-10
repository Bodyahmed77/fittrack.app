#!/usr/bin/env python3
"""Force pure-black Android status + navigation bars after `npx cap sync`.

Root cause of residual gray strips (Cap 7 + edge-to-edge):
- adjustMarginsForEdgeToEdge leaves native margin regions outside the WebView.
- On Android 10+ enforceStatusBarContrast / enforceNavigationBarContrast can
  paint a light scrim that reads as gray even when bar colors are #000000.
- StatusBar JS plugin does not set navigationBarColor at all.
- statusBarColor is ignored on some Android 15 builds; windowBackground and
  contrast flags still matter for the margin regions.

This script is idempotent and patches EVERY <style> block in values/styles.xml.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "styles.xml"
STYLES_V31 = ROOT / "android" / "app" / "src" / "main" / "res" / "values-v31" / "styles.xml"
MANIFEST = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"

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


def main() -> None:
    print(patch_styles(STYLES))
    print(patch_styles(STYLES_V31))
    print(patch_manifest(MANIFEST))


if __name__ == "__main__":
    main()
