"""Android release guardrails for Google Sign-In and Play Billing.

The Android release uses the current Credential Manager path for Google Sign-In.
The script preserves the real native error code so a configuration failure is
never hidden behind a generic message.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")
BILLING = Path("src/billing.js")
GOOGLE_AUTH = Path("src/googleAuth.js")

text = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
billing_text = BILLING.read_text(encoding="utf-8")
google_auth_text = GOOGLE_AUTH.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Google Sign-In: keep the modern Credential Manager runtime path enabled.
# ---------------------------------------------------------------------------
google_auth_text = google_auth_text.replace(
    "useCredentialManager: false,", "useCredentialManager: true,"
)

# Preserve the real Google status 10 instead of reducing it to a generic error.
map_anchor = '''  const message = String(error.message || error).toLowerCase();\n\n  if ('''
map_replacement = '''  const message = String(error.message || error).toLowerCase();
  const numericCode = String(error.code ?? error.errorCode ?? "");

  if (
    numericCode === "10" ||
    code === "10" ||
    /developer.?error|DEVELOPER_ERROR/.test(`${code} ${numericCode} ${message}`)
  ) {
    return copyDiagnostic(
      Object.assign(
        new Error(
          "Google Sign-In developer error (10): Android package/SHA configuration does not match the certificate used by the installed build",
        ),
        { code: "developer_error", googleStatusCode: "10" },
      ),
      error,
    );
  }

  if ('''
if "googleStatusCode: \"10\"" not in google_auth_text:
    if map_anchor not in google_auth_text:
        raise SystemExit("Google auth error mapping anchor not found")
    google_auth_text = google_auth_text.replace(map_anchor, map_replacement, 1)

native_log_old = '''    console.error(
      "[GoogleSignIn] native chooser failed",
      mapped?.nativeCode || mapped?.code || "",
      mapped?.nativeMessage || mapped?.message || "",
    );
    throw mapped;
'''
native_log_new = '''    try {
      window.__fiftyFitGoogleAuthDiagnostics = {
        stage: "native_sign_in",
        code: mapped?.code || "unknown",
        googleStatusCode:
          mapped?.googleStatusCode || mapped?.nativeCode || mapped?.nativeErrorCode || null,
        nativeCode: mapped?.nativeCode || null,
        nativeErrorCode: mapped?.nativeErrorCode || null,
        nativeMessage: mapped?.nativeMessage || null,
        message: mapped?.message || String(mapped || ""),
        updatedAt: new Date().toISOString(),
      };
    } catch (_) {
      /* ignore */
    }
    console.error(
      "[GoogleSignIn] native chooser failed",
      mapped?.nativeCode || mapped?.nativeErrorCode || mapped?.code || "",
      mapped?.nativeMessage || mapped?.message || "",
    );
    throw mapped;
'''
if "window.__fiftyFitGoogleAuthDiagnostics" not in google_auth_text:
    if native_log_old in google_auth_text:
        google_auth_text = google_auth_text.replace(native_log_old, native_log_new, 1)

# ---------------------------------------------------------------------------
# Billing: surface the actual Google Play response instead of always showing
# the generic billing_flow_failed message.
# ---------------------------------------------------------------------------
app_old = '''      if (!shouldUnlock) {
        showToast(
          ar
            ? "لم يتم إتمام عملية الشراء — حاول تاني"
            : "Purchase was not completed — please try again",
        );
        return;
      }'''
app_new = '''      if (!shouldUnlock) {
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
              responseCode: billingErr.responseCode || null,
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
if "window.__fiftyFitLastBillingError" not in text and app_old in text:
    text = text.replace(app_old, app_new, 1)

billing_old = '''    const token = extractPurchaseToken(result);
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
billing_new = '''    const token = extractPurchaseToken(result);
    if (!token) {
      const nativeResponseCode =
        result?.responseCode ??
        result?.billingResponseCode ??
        result?.response?.responseCode ??
        null;
      const nativeDebugMessage =
        result?.debugMessage ||
        result?.response?.message ||
        result?.message ||
        null;
      const nativeSubResponseCode = result?.subResponseCode ?? null;
      const noTokenCode =
        nativeResponseCode != null && String(nativeResponseCode) !== "0"
          ? String(nativeResponseCode)
          : result?.pending
            ? "purchase_pending"
            : "purchase_not_completed";
      const noTokenMessage =
        nativeDebugMessage ||
        (result?.pending
          ? "Google Play purchase is pending"
          : "Google Play did not return a purchase token");

      return {
        success: false,
        preview: false,
        pending: !!result?.pending,
        cancelled: !!result?.cancelled || !!result?.canceled,
        productId,
        error: Object.assign(new Error(String(noTokenMessage)), {
          code: noTokenCode,
          responseCode: nativeResponseCode,
          subResponseCode: nativeSubResponseCode,
        }),
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
        productId,
        error: Object.assign(
          new Error("Google Play purchase is pending and has not been acknowledged"),
          { code: "purchase_pending" },
        ),
      };
    }

    if (typeof billing.sendAck === "function") {'''
if "const nativeResponseCode =" not in billing_text and billing_old in billing_text:
    billing_text = billing_text.replace(billing_old, billing_new, 1)

APP.write_text(text, encoding="utf-8")
BILLING.write_text(billing_text, encoding="utf-8")
GOOGLE_AUTH.write_text(google_auth_text, encoding="utf-8")

checks = [
    ("App.jsx exists", APP.exists()),
    ("main.jsx exists", MAIN.exists()),
    ("billing.js exists", BILLING.exists()),
    ("googleAuth.js exists", GOOGLE_AUTH.exists()),
    ("FullScreenVideoViewer canonical", text.count("function FullScreenVideoViewer(") == 1),
    ("VideoPlayer canonical", text.count("function VideoPlayer(") == 1),
    ("no TikTok oEmbed", not re.search(r"\boembed\b", text, re.I)),
    ("no DOM appendChild injection", "appendChild" not in text),
    ("cardio state machine present", 'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";' in text),
    ("cardio persistence present", "await persist(true, null, 35);" in text),
    ("StartupGate present", "function StartupGate" in main_text),
    ("billing diagnostics UI present", "window.__fiftyFitLastBillingError" in text),
    ("billing pending guard present", "const purchaseIsCompleted =" in billing_text),
    ("billing response-code diagnostics present", "const nativeResponseCode =" in billing_text),
    ("Google Credential Manager enabled", "useCredentialManager: true" in google_auth_text and "useCredentialManager: false" not in google_auth_text),
    ("Google Error 10 diagnostics present", "googleStatusCode: \"10\"" in google_auth_text),
    ("Google native diagnostics present", "window.__fiftyFitGoogleAuthDiagnostics" in google_auth_text),
]
failed = [label for label, ok in checks if not ok]
if failed:
    raise SystemExit("release-fixes: required sanity checks failed: " + ", ".join(failed))

print("release-fixes: Google Credential Manager + Billing diagnostics applied")
