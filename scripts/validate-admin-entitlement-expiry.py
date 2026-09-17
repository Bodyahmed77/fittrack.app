from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def require(condition, message):
    if not condition:
        raise SystemExit(f"ADMIN ENTITLEMENT SAFETY FAILED: {message}")

admin_api = read("supabase/functions/admin-api/index.ts")
admin_ui = read("src/AdminDashboard.jsx")

# Support entitlements must fail closed when an expiry value is malformed.
# A missing expiry is intentionally handled separately by an explicit policy,
# but an invalid value must never be treated as "active forever" accidentally.
for source, label in [(admin_api, "admin api"), (admin_ui, "admin ui")]:
    require("Number.isFinite(expiryMs) && expiryMs > Date.now()" in source or "Number.isFinite(expiryMs) && expiryMs > Date.now()" in source.replace("\n", " "), f"{label}: expiry-active branch not explicit")
    require("!Number.isFinite(expiryMs)" not in source or "invalid" in source.lower(), f"{label}: invalid expiry handling is undocumented")

# Purchased Play state must be rendered with its expiry, not from a stale boolean
# alone. Keep this invariant tied to the admin surface until a dedicated selector
# is introduced in the canonical data model.
require("purchased.proExpiresAt" in admin_ui, "admin ui must read purchase expiry")
require("Google Play entitlements" in admin_ui, "purchase-backed entitlement section missing")

print("[admin-entitlement-expiry] PASS")
