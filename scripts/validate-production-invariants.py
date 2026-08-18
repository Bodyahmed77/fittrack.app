from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"PRODUCTION INVARIANT FAILED: {message}")


package = read("package.json")
billing = read("src/billing.js")
register_purchase = read("src/registerPurchase.js")
google_auth = read("src/googleAuth.js")
app = read("src/App.jsx")
deep_fixes = read("scripts/apply-deep-runtime-fixes.py")
runtime_audit = read("scripts/apply-runtime-audit-fixes.py")
verify_purchase = read("supabase/functions/verify-purchase/index.ts")

require("repair-google-auth-after-runtime-mutations.py" not in package,
        "retired Google auth repair script is still in postinstall")
require(not (ROOT / "scripts/repair-google-auth-after-runtime-mutations.py").exists(),
        "retired Google auth repair script still exists")

bad_fallback = 'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {'
require(bad_fallback not in google_auth, "Google Sign-In still hides DEVELOPER_ERROR")
require(bad_fallback not in deep_fixes, "deep runtime transform can reintroduce DEVELOPER_ERROR fallback")
require('if (!isNoCredentialError(mapped)) {' in google_auth, "canonical Google no-credential branch missing")

# Purchase acknowledgement must be server-side and follow independent verification.
require("sendAck" not in billing and "acknowledgePurchase" not in billing,
        "billing.js still acknowledges purchases on the client")
require("sendAck" not in register_purchase and "acknowledgePurchase" not in register_purchase,
        "registerPurchase.js still acknowledges purchases on the client")
register_verify = 'await postPurchase(endpoint, idToken, serverProductId, purchaseToken)'
require(register_verify in register_purchase, "server verification request missing")

require("const shouldUnlock = result?.success === true;" in app,
        "Paywall does not hand successful native purchases to server verification")
require("const shouldUnlock = result?.success === true && result?.verified === true;" not in app,
        "Paywall still requires pre-server verification and would reject deferred verification")
require("await registerServerEntitlement(" in app,
        "Paywall server entitlement registration is missing")

# Billing must fail closed when Google returns no eligible subscription offer.
require('code = "offer_token_missing"' in billing,
        "missing offerToken is not surfaced as a deterministic billing error")
require('offerToken: selectedOfferToken' in billing,
        "selected subscription offerToken is not explicitly forwarded to native billing")

# Admin grants must stay separate from Play-verified entitlements.
require('const legacyAdmin = parsed.adminEntitlements || {};' in deep_fixes,
        "legacy Play entitlements can still be promoted into admin grants")
require('adminEntitlements: effective' in deep_fixes,
        "admin grant is not persisted in adminEntitlements")
require('entitlements: effective' not in deep_fixes,
        "admin write still overwrites the Play-verified entitlements source")
require('const accountPatch = {' in runtime_audit,
        "admin profile editor does not use a field-scoped account patch")

# Ensure the actual transformed AdminScreen saveAccount body is field-scoped.
admin_start = app.find("function AdminScreen")
app_root = app.find("/* ============================== APP ROOT", admin_start)
require(admin_start >= 0 and app_root > admin_start,
        "AdminScreen section not found")
admin_section = app[admin_start:app_root]
match = re.search(r"const saveAccount = async \(\) => \{(.*?)\n  \};", admin_section, re.S)
require(bool(match), "AdminScreen saveAccount not found")
save_account_body = match.group(1)
require("const accountPatch = {" in save_account_body,
        "AdminScreen saveAccount is not field-scoped after transformation")
require("setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });" not in save_account_body,
        "AdminScreen saveAccount still writes the whole stale user document")

# The account initializer must persist explicit signup language.
require('function freshState(language = null)' in deep_fixes,
        "freshState language fix missing from canonical transform")
require('language,' in deep_fixes,
        "freshState does not persist supplied language")

# Normal profile writes must strip server-managed entitlement fields.
require('key !== "entitlements"' in runtime_audit,
        "normal profile writes are not stripping entitlements")
require('key !== "adminEntitlements"' in deep_fixes,
        "normal profile writes are not stripping adminEntitlements")

# Server entitlement lifecycle and acknowledgement.
require('function hasPaidEntitlement(state: string, expiryTime: string | null)' in verify_purchase,
        "server entitlement lifecycle helper missing")
require('SUBSCRIPTION_STATE_CANCELED' in verify_purchase and 'expiryMs > Date.now()' in verify_purchase,
        "server incorrectly treats all canceled subscriptions as immediately expired")
require('acknowledgeSubscription(' in verify_purchase,
        "server-side Play acknowledgement is missing")
require('acknowledgementState' in verify_purchase,
        "server does not inspect Google Play acknowledgement state")

print("Production invariants passed")
