#!/usr/bin/env python3
from pathlib import Path
import re

PLUGIN = Path("node_modules/capacitor-billing/android/build.gradle")

if not PLUGIN.exists():
    print("capacitor-billing Gradle module not present yet; skip source patch")
    raise SystemExit(0)

text = PLUGIN.read_text(encoding="utf-8")
original = text
text = re.sub(r"com\.android\.billingclient:billing:7\.1\.0", "com.android.billingclient:billing:9.1.0", text)
text = re.sub(r"com\.android\.billingclient:billing:\s*\[?7\.1\.0\]?", "com.android.billingclient:billing:9.1.0", text)
if text != original:
    PLUGIN.write_text(text, encoding="utf-8")
    print("capacitor-billing Play Billing dependency normalized: 7.1.0 -> 9.1.0")
else:
    print("capacitor-billing Play Billing dependency already normalized")

final = PLUGIN.read_text(encoding="utf-8")
if "com.android.billingclient:billing:7.1.0" in final:
    raise SystemExit("PBL7 billing reference remains in capacitor-billing Gradle module")
