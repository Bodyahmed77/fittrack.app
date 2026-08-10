#!/usr/bin/env python3
"""Inject an intent-filter for com.fittrack.app://google-auth into AndroidManifest.xml
so the external Chrome OAuth redirect returns into the Capacitor app.
Safe to run multiple times (idempotent).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTENT_BLOCK = """
            <!-- Google OAuth deep link (external browser → app) -->
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.fittrack.app" android:host="google-auth" />
            </intent-filter>
"""


def find_manifest() -> Path:
    preferred = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    if preferred.is_file():
        return preferred
    android = ROOT / "android"
    if android.is_dir():
        for p in android.rglob("AndroidManifest.xml"):
            if "src/main" in str(p).replace("\\", "/"):
                return p
    raise SystemExit("AndroidManifest.xml not found (run after npx cap sync/add android)")


def main() -> None:
    path = find_manifest()
    text = path.read_text(encoding="utf-8")
    if 'android:host="google-auth"' in text:
        print(f"Deep-link intent-filter already present in {path}")
        return

    pattern = re.compile(
        r"(<activity\b[^>]*android:name=\"[^\"]*MainActivity\"[^>]*>)(.*?)(</activity>)",
        re.DOTALL | re.IGNORECASE,
    )
    m = pattern.search(text)
    if m:
        new_text = text[: m.start(3)] + INTENT_BLOCK + text[m.start(3) :]
    else:
        idx = text.find("</activity>")
        if idx < 0:
            raise SystemExit(f"No </activity> found in {path}")
        new_text = text[:idx] + INTENT_BLOCK + text[idx:]

    path.write_text(new_text, encoding="utf-8")
    print(f"Injected Google OAuth deep-link intent-filter into {path}")


if __name__ == "__main__":
    main()
