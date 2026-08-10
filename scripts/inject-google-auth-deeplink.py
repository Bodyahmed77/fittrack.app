#!/usr/bin/env python3
"""Inject deep-link intent-filter so Chrome can return to FitTrack after Google OAuth.

Scheme: com.fittrack.app://google-auth
Android folder is generated in CI (gitignored); run after `npx cap add/sync android`.
"""
from pathlib import Path
import sys

MANIFEST = Path("android/app/src/main/AndroidManifest.xml")
MARKER = "com.fittrack.app://google-auth"
FILTER = """
            <!-- FitTrack Google OAuth return from external Chrome Custom Tabs -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.fittrack.app" android:host="google-auth" />
            </intent-filter>
"""

def main():
    if not MANIFEST.exists():
        print("skip: AndroidManifest.xml not found (android platform not generated yet)")
        return 0
    text = MANIFEST.read_text(encoding="utf-8")
    if MARKER in text or 'android:host="google-auth"' in text:
        print("google-auth deep link intent-filter already present")
        return 0
    needle = "</activity>"
    idx = text.find(needle)
    if idx < 0:
        print("::error::Could not find </activity> in AndroidManifest.xml", file=sys.stderr)
        return 1
    # Insert before the first </activity> (MainActivity)
    text = text[:idx] + FILTER + text[idx:]
    MANIFEST.write_text(text, encoding="utf-8")
    print("injected google-auth deep link intent-filter into AndroidManifest.xml")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
