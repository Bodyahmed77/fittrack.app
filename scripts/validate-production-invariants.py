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
production_final = read("scripts/patch-production-final.py")
production_final2 = read("scripts/patch-production-final-2.py")
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

# The production build transforms App.jsx with these canonical scripts. Validate
# the source transforms themselves, then use App.jsx only for stable anchors.
require('firestoreEntitlementsRef' in production_final,
        "production transform does not keep Firestore entitlement state separate")
require('setLoadError' in production_final and 'setLoaded(false)' in production_final,
        "production transform does not protect failed Firestore reads")
require('key !== "entitlements"' in production_final,
        "production transform does not protect Play entitlement fields")
require('setPhase("dataError")' in production_final,
        "production transform does not provide retryable account-load handling")
require('function daysUntil(iso)' in production_final and 'Math.ceil((ms - Date.now()) / 86400000)' in production_final,
        "production transform does not contain the robust Pro expiry countdown")
require('serverVerification?.expiresAt' in production_final or 'serverVerification?.expiresAt' in production_final2,
        "purchase transform does not persist server-verified expiry")
require('FIFTYFIT_PRO_EXPIRY_WATCHDOG_V2' in production_final,
        "production transform does not include Pro expiry watchdog")

# App source itself must not reintroduce whole-document entitlement writes.
require('setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });' not in app,
        "App source still contains stale whole-document Admin save")

# Server entitlement lifecycle + acknowledgement.
require('acknowledgeSubscription(' in verify_purchase,
        "server-side Google Play acknowledgement is missing")
require('acknowledgementState' in verify_purchase,
        "Google Play acknowledgement state is not checked")
require('SUBSCRIPTION_STATE_CANCELED' in verify_purchase and 'expiryMs > Date.now()' in verify_purchase,
        "canceled-but-unexpired subscriptions are not handled correctly")
require('expiresAt' in verify_purchase,
        "server does not return/track subscription expiry")
require('acknowledgementPending' in verify_purchase,
        "verified purchase does not remain successful when acknowledgement is pending")

# AI daily reset is driven by a server-computed date in the user's IANA timezone.
ai = read("src/aiCoach.js")
require('timeZone' in ai, "AI client does not send timezone context")
edge_ai = ROOT / "supabase/functions/ai-coach/index.ts"
if edge_ai.exists():
    ai_backend = edge_ai.read_text(encoding="utf-8")
    require('dateInTimeZone(timeZone)' in ai_backend,
            "AI backend does not compute local date from timezone")
    require('FREE_LIMIT=3' in ai_backend or 'FREE_LIMIT = 3' in ai_backend,
            "AI free daily limit is not enforced server-side")
    require('PRO_LIMIT=50' in ai_backend or 'PRO_LIMIT = 50' in ai_backend,
            "AI Pro daily limit is not enforced server-side")
    require('reserve_ai_usage' in ai_backend and 'refund_ai_usage' in ai_backend,
            "AI atomic usage reserve/refund is missing")
    require('getIdToken(true)' in ai,
            "AI client does not recover from expired Firebase tokens")

# Web demo must remain explicitly isolated and responsive.
require('FIFTYFIT_WEB_DEMO' in read("scripts/patch-web-demo.py"),
        "responsive web demo patch is missing")
require('(new URLSearchParams(window.location.search).get("demo") === "1")' in read("scripts/patch-web-demo.py"),
        "web demo is not explicitly opt-in")

print("Production invariants passed")
