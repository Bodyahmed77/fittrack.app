#!/usr/bin/env python3
"""Ensure Android status + navigation bars and window background are pure black.
Runs after `npx cap sync android`. Idempotent.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "styles.xml"
MANIFEST = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"

STATUS_ITEMS = [
    ("android:statusBarColor", "#000000"),
    ("android:navigationBarColor", "#000000"),
    ("android:windowBackground", "@android:color/black"),
    ("android:navigationBarDividerColor", "#000000"),
]


def patch_styles(path: Path) -> str:
    if not path.is_file():
        return "styles.xml missing (skip)"
    text = path.read_text(encoding="utf-8")
    changed = False
    for name, value in STATUS_ITEMS:
        item = f'<item name="{name}">{value}</item>'
        if f'name="{name}"' in text:
            new_text, n = re.subn(
                rf'<item name="{re.escape(name)}">[^<]*</item>',
                item,
                text,
            )
            if n:
                text = new_text
                changed = True
            continue
        if item not in text:
            text2, n = re.subn(
                r"(</style>)",
                f"        {item}\n    \\1",
                text,
                count=1,
            )
            if n:
                text = text2
                changed = True
    if changed:
        path.write_text(text, encoding="utf-8")
        return "styles.xml updated"
    return "styles.xml already ok"


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
        r"(<activity\b[^>]*android:name=\"[^\"]*MainActivity\"[^>]*)(>)",
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
    print(patch_manifest(MANIFEST))


if __name__ == "__main__":
    main()
