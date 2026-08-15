"""Non-destructive release sanity checks for the current Fifty Fit source.

This release gate also applies small, idempotent Billing diagnostics/fixes that
must be present in every Android release build. The transformations are scoped
to exact known source fragments and fail loudly if the expected source shape is
missing, so we do not silently rewrite unrelated code.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")
BILLING = Path("src/billing.js")

text = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
billing_text = BILLING.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Billing runtime diagnostics
# ---------------------------------------------------------------------------
# The UI used to discard the native Billing error and always show a generic
# "Purchase was not completed" message. Keep the real Google Play response
# visible so device testing tells us the actual response code/message.
old_app = '''      if (!shouldUnlock) {
        showToast(
          ar
            ? "لم يتم إتمام عملية الشراء — حاول تاني"
            : "Purchase was not completed — please try again",
        );
        return;
      }'''
new_app = '''      if (!shouldUnlock) {
        const billingErr = result?.error || {};
        const billingCode = String(
          billingErr.code ||
          (result?.pending ? "purchase_pending" : "billing_flow_failed"),
        );
        const billingMessage = String(
          billingErr.message ||
          (result?.pending
            ? "Google Play returned a pending purchase"
            : "Google Play did not complete the purchase"),
        );
        const billingProduct = result?.productId || "unknown_product";

        if (typeof window !== "undefined") {
          try {
            window.__fiftyFitLastBillingError = {
              code: billingCode,
              message: billingMessage,
              productId: billingProduct,
              pending: !!result?.pending,
              cancelled: !!result?.cancelled,
              subResponseCode: billingErr.subResponseCode || null,
              updatedAt: new Date().toISOString(),
            };
          } catch (_) {
            /* ignore */
          }
        }

        showToast(
          ar
            ? `فشل الدفع — كود Google Play: ${billingCode} — ${billingMessage}`
            : `Purchase failed — Google Play code: ${billingCode} — ${billingMessage}`,
        );
        return;
      }'''
if old_app in text:
    text = text.replace(old_app, new_app, 1)
elif "window.__fiftyFitLastBillingError" not in text:
    raise SystemExit("release-fixes: expected billing failure UI block was not found")

# ---------------------------------------------------------------------------
# Do not acknowledge pending purchases
# ---------------------------------------------------------------------------
# Acknowledgement is only valid after the purchase reaches PURCHASED. The
# previous path acknowledged any result carrying a token, which could turn a
# pending-flow diagnostic into a misleading acknowledgement failure.
old_token = '''    const token = extractPurchaseToken(result);
    if (!token) {
      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: Object.assign(
          new Error("Google Play did not return a purchase token"),
          {
            code: result?.pending
              ? "purchase_pending"
              : "purchase_not_completed",
          },
        ),
      };
    }

    if (typeof billing.sendAck === "function") {'''
new_token = '''    const token = extractPurchaseToken(result);
    if (!token) {
      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: Object.assign(
          new Error("Google Play did not return a purchase token"),
          {
            code: result?.pending
              ? "purchase_pending"
              : "purchase_not_completed",
          },
        ),
      };
    }

    const purchaseState =
      result?.purchaseState ?? result?.purchase?.purchaseState;
    const purchaseIsCompleted =
      result?.pending !== true &&
      (purchaseState == null || purchaseState === 1 || purchaseState === "1");
    if (!purchaseIsCompleted) {
      return {
        success: false,
        preview: false,
        pending: true,
        cancelled: !!result?.cancelled || !!result?.canceled,
        error: Object.assign(
          new Error("Google Play purchase is pending and has not been acknowledged"),
          { code: "purchase_pending" },
        ),
      };
    }

    if (typeof billing.sendAck === "function") {'''
if old_token in billing_text:
    billing_text = billing_text.replace(old_token, new_token, 1)
elif "const purchaseIsCompleted =" not in billing_text:
    raise SystemExit("release-fixes: expected billing acknowledgement block was not found")

# Persist the two exact source files changed by the release fixer so future
# builds do not depend on CI-only mutations. This is intentionally idempotent.
APP.write_text(text, encoding="utf-8")
BILLING.write_text(billing_text, encoding="utf-8")

# ---------------------------------------------------------------------------
# Existing release sanity checks
# ---------------------------------------------------------------------------
checks = [
    ("App.jsx exists", APP.exists()),
    ("main.jsx exists", MAIN.exists()),
    ("billing.js exists", BILLING.exists()),
    ("FullScreenVideoViewer canonical", text.count("function FullScreenVideoViewer(") == 1),
    ("VideoPlayer canonical", text.count("function VideoPlayer(") == 1),
    ("no TikTok oEmbed", not re.search(r"\boembed\b", text, re.I)),
    ("no DOM appendChild injection", "appendChild" not in text),
    ("cardio state machine present", 'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";' in text),
    ("cardio persistence present", "await persist(true, null, 35);" in text),
    ("StartupGate present", "function StartupGate" in main_text),
    ("billing diagnostics UI present", "window.__fiftyFitLastBillingError" in text),
    ("billing pending guard present", "const purchaseIsCompleted =" in billing_text),
]

failed = [label for label, ok in checks if not ok]
if failed:
    raise SystemExit("release-fixes: required sanity checks failed: " + ", ".join(failed))

print("release-fixes: sanity checks passed; Billing diagnostics + pending guard applied")
