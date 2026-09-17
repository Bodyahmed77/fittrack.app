from pathlib import Path

P = Path("src/AdminDashboard.jsx")
MARKER = "FIFTYFIT_ADMIN_EXPIRY_HARDENING_V1"

s = P.read_text(encoding="utf-8")

old = '''  const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59.999Z`) : NaN;
  const active = !expiry || !Number.isFinite(expiryMs) || expiryMs > Date.now();'''
new = '''  const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59.999Z`) : NaN;
  const active = !!expiry && Number.isFinite(expiryMs) && expiryMs > Date.now();'''
if old in s and new not in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit("admin expiry normalizer anchor not found")

old_helper = '''const purchased = user?.data?.entitlements || {};
  const effective = useMemo(() => effectiveEntitlements(user?.data), [user]);'''
new_helper = '''const purchased = user?.data?.entitlements || {};
  const purchaseActive = (key) => {
    const expiry = purchased.proExpiresAt ? String(purchased.proExpiresAt).trim() : "";
    const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59.999Z`) : NaN;
    return !!purchased[key] && Number.isFinite(expiryMs) && expiryMs > Date.now();
  };
  const effective = useMemo(() => effectiveEntitlements(user?.data), [user]);'''
if old_helper in s and new_helper not in s:
    s = s.replace(old_helper, new_helper, 1)
elif new_helper not in s:
    raise SystemExit("admin purchase helper anchor not found")

old_purchase = '{purchased[key] ? "ACTIVE" : "OFF"}'
new_purchase = '{purchaseActive(key) ? "ACTIVE" : "OFF"}'
if old_purchase in s and new_purchase not in s:
    s = s.replace(old_purchase, new_purchase, 1)
elif new_purchase not in s:
    raise SystemExit("admin purchase status anchor not found")

if MARKER not in s:
    s = f"/* {MARKER} */\n" + s

P.write_text(s, encoding="utf-8")
print("admin entitlement expiry hardening applied")
