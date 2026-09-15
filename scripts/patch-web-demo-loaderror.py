#!/usr/bin/env python3
"""Repair the web-demo useAppData/loadError contract after demo source replacement.

patch-web-demo.py intentionally replaces the native Firestore hook implementation
with a browser-local implementation. Production hardening runs before it and
adds a loadError contract to GymApp. Keep that contract present in the demo hook
so the real router can render without a ReferenceError.
"""
from pathlib import Path
import os

APP = Path("src/App.jsx")
MARKER = "FIFTYFIT_WEB_DEMO_LOADERROR_FIX_V1"

if os.environ.get("VITE_WEB_DEMO") != "1":
    raise SystemExit(0)

s = APP.read_text(encoding="utf-8")
if MARKER in s:
    print("web-demo loadError contract already present")
    raise SystemExit(0)

# 1) Ensure the root router actually declares loadError. This is intentionally
# robust to whether patch-production-final already performed the replacement.
old_root = '''  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(
    firebaseUser?.uid,
  );'''
new_root = '''  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError } = useAppData(
    firebaseUser?.uid,
  );'''
if "saveError, loadError } = useAppData" not in s:
    if old_root not in s:
        raise SystemExit("web-demo loadError: root hook destructuring anchor not found")
    s = s.replace(old_root, new_root, 1)

# 2) Add the state to the browser-local useAppData hook created by web-demo V8.
hook = 'function useAppData(uid) {'
start = s.find(hook)
if start < 0:
    raise SystemExit("web-demo loadError: useAppData anchor not found")
next_fn = s.find('\nfunction nutritionCycleState(', start)
if next_fn < 0:
    raise SystemExit("web-demo loadError: useAppData end anchor not found")
hook_text = s[start:next_fn]
if 'const [loadError, setLoadError] = useState(null);' not in hook_text:
    hook_text = hook_text.replace(
        '  const [saveError, setSaveError] = useState(null);\n',
        '  const [saveError, setSaveError] = useState(null);\n  const [loadError, setLoadError] = useState(null);\n',
        1,
    )
# The hook should never expose a demo load failure; normal demo writes clear it.
if 'setLoadError(null);' not in hook_text:
    raise SystemExit("web-demo loadError: hook state insertion failed")
if 'return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError, loadError };' not in hook_text:
    return_anchor = '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError };'
    if return_anchor not in hook_text:
        raise SystemExit("web-demo loadError: hook return anchor not found")
    hook_text = hook_text.replace(
        return_anchor,
        '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError, loadError };',
        1,
    )
s = s[:start] + hook_text + s[next_fn:]

# 3) Mark the transformed demo source for idempotence.
s = s.replace('function useAppData(uid) {', f'/* {MARKER} */\nfunction useAppData(uid) {{', 1)
APP.write_text(s, encoding="utf-8")
print("web-demo loadError contract fixed")
