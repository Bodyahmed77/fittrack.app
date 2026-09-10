#!/usr/bin/env python3
from pathlib import Path
import re

PLUGIN = Path("node_modules/capacitor-billing/android/build.gradle")

if not PLUGIN.exists():
    print("capacitor-billing Gradle module not present yet; skip source patch")
    raise SystemExit(0)

text = PLUGIN.read_text(encoding="utf-8")
original = text
# capacitor-billing 8.1.0 currently declares Play Billing 7.1.0 with a strict
# constraint. Fifty Fit's native billing implementation uses the newer Play
# Billing API, so the embedded plugin must resolve against the same major API.
text = re.sub(r"com\.android\.billingclient:billing:7\.1\.0", "com.android.billingclient:billing:9.1.0", text)
text = re.sub(r"com\.android\.billingclient:billing:\s*\[?7\.1\.0\]?", "com.android.billingclient:billing:9.1.0", text)
if text == original:
    # Do not silently pass when a future plugin changes its dependency declaration.
    if "billing:7.1.0" in text or "billing {" in text and "7.1.0" in text:
        raise SystemExit("capacitor-billing PBL7 dependency detected but patch pattern did not match")
    print("capacitor-billing Play Billing dependency already normalized")
else:
    PLUGIN.write_text(text, encoding="utf-8")
    print("capacitor-billing Play Billing dependency normalized: 7.1.0 -> 9.1.0")

# Guard against any strict PBL7 constraint that survives the textual replacement.
final = PLUGIN.read_text(encoding="utf-8")
if "7.1.0" in final and "billing" in final:
    raise SystemExit("PBL7 billing reference remains in capacitor-billing Gradle module")
