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
verify_purchase = read("supabase/functions/verify-purchase/index.ts")

# No retired repair scripts are allowed back into the build pipeline.
require("repair-google-auth-after-runtime-mutations.py" not in package,
        "retired Google auth repair script is still in package scripts")
require(not (ROOT / "scripts/repair-google-auth-after-runtime-mutations.py").exists(),
        "retired Google auth repair script still exists")

# Google authentication should surface developer/configuration failures instead
# of converting them into a misleading 'no credential' message.
require('if (!isNoCredentialError(mapped)) {' in google_auth,
        "Google auth no-credential branch is missing")
require('mapped?.code !== "developer_error"' not in google_auth,
        "Google auth still hides developer_error")

# Client must never acknowledge purchases; server owns verification/ack.
require("sendAck" not in billing and "acknowledgePurchase" not in billing,
        "billing.js still acknowledges purchases on client")
require("sendAck" not in register_purchase and "acknowledgePurchase" not in register_purchase,
        "registerPurchase.js still acknowledges purchases on client")
require("await postPurchase(endpoint, idToken, serverProductId, purchaseToken)" in register_purchase,
        "purchase server verification request missing")

# A native success is only the input to server verification; it is not itself
# the final entitlement authority.
require("const shouldUnlock = result?.success === true;" in app,
        "Paywall native-success handoff missing")
require("registerServerEntitlement(" in app,
        "Paywall server entitlement registration missing")

# Billing fails closed when an eligible subscription offer is unavailable.
require('offer_token_missing' in billing,
        "missing subscription offer is not handled deterministically")
require('offerToken: selectedOfferToken' in billing,
        "selected offer token is not forwarded to native billing")

# Actual app-level persistence model: Firestore/admin entitlements and verified
# Play entitlements are kept distinct, and ordinary user writes do not overwrite
# the entitlement source of truth.
require('firestoreEntitlementsRef' in app,
        "Firestore entitlement source is not tracked separately")
require('loadError' in app,
        "recoverable account-load error state is missing")
require('key !== "entitlements"' in app or 'key !== "entitlements"' in package,
        "ordinary state persistence does not exclude entitlements")
require('setPhase("dataError")' in app,
        "Firestore failure does not enter retryable data-error state")

# Admin screen should avoid writing a stale copy of the whole user document.
admin_start = app.find("function AdminScreen")
app_root = app.find("/* ============================== APP ROOT", admin_start)
require(admin_start >= 0 and app_root > admin_start,
        "AdminScreen section not found")
admin_section = app[admin_start:app_root]
match = re.search(r"const saveAccount = async \(\) => \{(.*?)\n  \};", admin_section, re.S)
require(bool(match), "AdminScreen saveAccount not found")
save_account_body = match.group(1)
require("setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });" not in save_account_body,
        "AdminScreen still writes stale whole user document")

# Server entitlement lifecycle + acknowledgement.
require('acknowledgeSubscription(' in verify_purchase,
        "server-side Google Play acknowledgement is missing")
require('acknowledgementState' in verify_purchase,
        "Google Play acknowledgement state is not checked")
require('SUBSCRIPTION_STATE_CANCELED' in verify_purchase and 'expiryMs > Date.now()' in verify_purchase,
        "canceled-but-unexpired subscriptions are not handled correctly")
require('expiresAt' in verify_purchase,
        "server does not return/track subscription expiry")

# AI daily reset is driven by a server-computed date in the user's IANA timezone.
ai = read("src/aiCoach.js")
require('timeZone' in ai, "AI client does not send timezone context")
edge_ai = ROOT / "supabase/functions/ai-coach/index.ts"
if edge_ai.exists():
    ai_backend = edge_ai.read_text(encoding="utf-8")
    require('dateInTimeZone(timeZone)' in ai_backend,
            "AI backend does not compute local date from timezone")
    require('FREE_LIMIT = 3' in ai_backend and 'PRO_LIMIT = 50' in ai_backend,
            "AI free/pro daily limits are not enforced server-side")
    require('reserve_ai_usage' in ai_backend and 'refund_ai_usage' in ai_backend,
            "AI atomic usage reserve/refund is missing")

# Web demo must remain explicitly isolated and responsive.
require('FIFTYFIT_WEB_DEMO' in read("scripts/patch-web-demo.py"),
        "responsive web demo patch is missing")

print("Production invariants passed")
