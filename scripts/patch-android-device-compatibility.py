from pathlib import Path

MANIFEST = Path("android/app/src/main/AndroidManifest.xml")
MARKER = "FIFTYFIT_DEVICE_COMPATIBILITY_V1"

if not MANIFEST.exists():
    raise SystemExit("AndroidManifest.xml not found")

text = MANIFEST.read_text(encoding="utf-8")

# Fifty Fit is a WebView fitness app and does not require a physical touchscreen
# or fake-touch interface at install time. Explicitly mark these features optional
# so Google Play does not filter TV/automotive/other non-touch variants solely from
# the default Android touch-feature inference. Runtime UI remains touch-optimized
# for phones/tablets; this changes distribution filtering, not app behavior.
if MARKER not in text:
    anchor = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">'
    if anchor not in text:
        raise SystemExit("Manifest root anchor not found")
    additions = '''\n    <!-- FIFTYFIT_DEVICE_COMPATIBILITY_V1: non-touch hardware is not an install blocker. -->\n    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n    <uses-feature android:name="android.hardware.faketouch" android:required="false" />\n    <uses-feature android:name="android.software.leanback" android:required="false" />\n'''
    text = text.replace(anchor, anchor + additions, 1)
    MANIFEST.write_text(text, encoding="utf-8")

text = MANIFEST.read_text(encoding="utf-8")
for feature in ("android.hardware.touchscreen", "android.hardware.faketouch", "android.software.leanback"):
    if f'android:name="{feature}" android:required="false"' not in text:
        raise SystemExit(f"Compatibility feature declaration missing: {feature}")
print("Android device compatibility declarations applied")
