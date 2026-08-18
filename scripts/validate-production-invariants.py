from pathlib import Path

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

# Build mutation chain: the retired Google repair stage must no longer be required.
require(
    "repair-google-auth-after-runtime-mutations.py" not in package,
    "retired Google auth repair script is still in postinstall",
)
require(
    not (ROOT / "scripts/repair-google-auth-after-runtime-mutations.py").exists(),
    "retired Google auth repair script still exists",
)

# Google developer errors must remain visible; only a true no-credential case may
# fall through to the legacy chooser compatibility path.
bad_fallback = 'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {'
require(bad_fallback not in google_auth, "Google Sign-In still hides DEVELOPER_ERROR")
require(bad_fallback not in deep_fixes, "deep runtime transform can reintroduce DEVELOPER_ERROR fallback")
require('if (!isNoCredentialError(mapped)) {' in google_auth, "canonical Google no-credential branch missing")

# Purchase acknowledgement must happen only after verify-purchase succeeds.
ack_call = "billing.sendAck({ purchaseToken })"
ack_call_2 = "billing.acknowledgePurchase({ purchaseToken })"
require(ack_call not in billing and ack_call_2 not in billing,
        "billing.js acknowledges purchases before server verification")
register_verify = 'await postPurchase(endpoint, idToken, serverProductId, purchaseToken)'
register_ack = 'const ack = await acknowledgePurchaseToken(purchaseToken)'
require(register_verify in register_purchase, "server verification request missing")
require(register_ack in register_purchase, "acknowledgement is not sequenced after verification")
require(register_purchase.index(register_verify) < register_purchase.index(register_ack),
        "acknowledgement appears before server verification")

# The Paywall must treat the native purchase as a transport success only. The
# registerServerEntitlement call below it is the authoritative unlock gate.
require(
    "const shouldUnlock = result?.success === true;" in app,
    "Paywall does not hand successful native purchases to server verification",
)
require(
    "const shouldUnlock = result?.success === true && result?.verified === true;" not in app,
    "Paywall still requires pre-server verification and would reject deferred verification",
)
require(
    "await registerServerEntitlement(" in app,
    "Paywall server entitlement registration is missing",
)

# Billing must fail closed when Google returns no eligible subscription offer.
require('code = "offer_token_missing"' in billing,
        "missing offerToken is not surfaced as a deterministic billing error")
require('offerToken: selectedOfferToken' in billing,
        "selected subscription offerToken is not explicitly forwarded to native billing")

# Admin grants must stay separate from Play-verified entitlements and must not
# inherit historical purchase flags.
require('const legacyAdmin = parsed.adminEntitlements || {};' in deep_fixes,
        "legacy Play entitlements can still be promoted into admin grants")
require('adminEntitlements: effective' in deep_fixes,
        "admin grant is not persisted in adminEntitlements")
require('entitlements: effective' not in deep_fixes,
        "admin write still overwrites the Play-verified entitlements source")
require('const accountPatch = {' in runtime_audit,
        "admin profile editor does not use a field-scoped account patch")
require('await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });' not in runtime_audit,
        "admin profile editor can still overwrite the whole user document")

# The account initializer must persist the explicit signup language.
require('function freshState(language = null)' in deep_fixes,
        "freshState language fix missing from canonical transform")
require('language,' in deep_fixes,
        "freshState does not persist the supplied language")

# Normal profile writes must strip server-managed entitlement fields.
require('key !== "entitlements"' in runtime_audit,
        "normal profile writes are not stripping entitlements")
require('key !== "adminEntitlements"' in deep_fixes,
        "normal profile writes are not stripping adminEntitlements")

# Server entitlement lifecycle: subscription cancellation does not end access
# early; CANCELED remains entitled until expiryTime, while ACTIVE/GRACE are valid.
require('function hasPaidEntitlement(state: string, expiryTime: string | null)' in verify_purchase,
        "server entitlement lifecycle helper missing")
require('SUBSCRIPTION_STATE_CANCELED' in verify_purchase and 'expiryMs > Date.now()' in verify_purchase,
        "server incorrectly treats all canceled subscriptions as immediately expired")
require('acknowledgeSubscription(' in verify_purchase,
        "server-side Play acknowledgement is missing")
require('acknowledgementState' in verify_purchase,
        "server does not inspect Google Play acknowledgement state")

print("Production invariants passed")
