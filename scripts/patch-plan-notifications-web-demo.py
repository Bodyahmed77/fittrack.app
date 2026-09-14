#!/usr/bin/env python3
"""Route planNotifications native imports through the web-demo shims."""
from pathlib import Path

p = Path("src/planNotifications.js")
if not p.exists():
    raise SystemExit(f"missing {p}")
s = p.read_text(encoding="utf-8")
marker = "FIFTYFIT_PLAN_NOTIFICATIONS_WEB_DEMO_V1"
if marker not in s:
    s = s.replace('import { Capacitor } from "@capacitor/core";', 'import { Capacitor } from "./.web-demo/capacitor-core.js";', 1)
    s = s.replace('import { LocalNotifications } from "@capacitor/local-notifications";', 'import { LocalNotifications } from "./.web-demo/capacitor-local-notifications.js";', 1)
    s = f"/* {marker} */\n" + s
    p.write_text(s, encoding="utf-8")
    print("plan notification web-demo imports patched")
else:
    print("plan notification web-demo imports already patched")
