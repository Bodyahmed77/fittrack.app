from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def require(condition, message):
    if not condition:
        raise SystemExit(f"ADMIN EXPIRY CHECK FAILED: {message}")

api = read("supabase/functions/admin-api/index.ts")
ui = read("src/AdminDashboard.jsx")
patch = read("scripts/patch-admin-entitlement-expiry.py")

require("function parseExpiry" in api, "backend expiry parser missing")
require("return parsed.valid && parsed.ms > Date.now();" in api, "backend expiry does not fail closed")
require("const active = !!expiry && Number.isFinite(expiryMs) && expiryMs > Date.now();" in patch, "support UI patch is not fail closed")
require("purchaseActive" in patch, "purchase expiry status helper missing")
require("const purchaseActive" in ui or "purchaseActive" in patch, "purchase expiry helper not part of source/patch chain")
print("[admin-expiry] PASS")
