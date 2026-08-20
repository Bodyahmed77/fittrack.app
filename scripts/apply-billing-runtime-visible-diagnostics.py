from pathlib import Path
import re

APP = Path("src/App.jsx")
BILLING = Path("src/billing.js")

if not APP.exists() or not BILLING.exists():
    raise SystemExit("Billing runtime source files are missing")

app = APP.read_text(encoding="utf-8")
billing = BILLING.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# billing.js: normalize every native rejection shape into responseCode and
# nativeMessage. The native plugin may expose the numeric response as
# error.code/nativeCode, or embed it in FIFTYFIT_BILLING_ERROR text.
# ---------------------------------------------------------------------------
billing_pattern = re.compile(
    r'function billingError\(e, fallbackCode = "billing_error"\) \{.*?\n\}\n\nfunction normalizeSkuDetails',
    re.S,
)
billing_replacement = '''function billingError(e, fallbackCode = "billing_error") {
  const source = e?.error || e?.response || e;
  const rawMessage = String(
    source?.debugMessage ||
      source?.message ||
      e?.debugMessage ||
      e?.nativeMessage ||
      e?.message ||
      "Google Play Billing could not complete the operation",
  );

  const numericCandidates = [
    source?.responseCode,
    source?.billingResponseCode,
    source?.code,
    e?.responseCode,
    e?.billingResponseCode,
    e?.nativeCode,
  ];
  let parsedResponseCode = numericCandidates.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      /^-?\\d+$/.test(String(value).trim()),
  );
  if (parsedResponseCode === undefined) parsedResponseCode = null;

  if (parsedResponseCode === null) {
    const embedded = rawMessage.match(
      /BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i,
    );
    if (embedded) parsedResponseCode = Number(embedded[1]);
  }

  const code =
    parsedResponseCode ??
    source?.code ??
    e?.code ??
    fallbackCode;

  const err = new Error(rawMessage);
  err.code = String(code);
  err.responseCode = parsedResponseCode;
  err.nativeCode =
    source?.code ??
    source?.responseCode ??
    source?.billingResponseCode ??
    e?.nativeCode ??
    parsedResponseCode ??
    null;
  err.nativeMessage =
    source?.debugMessage ||
    source?.nativeMessage ||
    e?.nativeMessage ||
    e?.debugMessage ||
    null;
  err.billingResponseCodeName = billingResponseName(
    parsedResponseCode ?? code,
  );
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
  err.raw = e;
  return err;
}

function normalizeSkuDetails'''

billing2, billing_count = billing_pattern.subn(billing_replacement, billing, count=1)
if billing_count != 1:
    raise SystemExit(
        f"billing.js: expected exactly one billingError block before normalizeSkuDetails, found {billing_count}"
    )
billing = billing2

# Ensure the launch exception diagnostics preserve nativeCode when responseCode
# was not exposed directly by the bridge.
billing = billing.replace(
    'responseCode: launchMapped.responseCode,\n        responseName: launchMapped.billingResponseCodeName,',
    'responseCode: launchMapped.responseCode ?? launchMapped.nativeCode ?? null,\n        responseName: launchMapped.billingResponseCodeName,',
    1,
)
billing = billing.replace(
    'message: launchMapped.message,\n        nativeCode: launchMapped.nativeCode || null,',
    'message: launchMapped.nativeMessage || launchMapped.message,\n        nativeCode: launchMapped.nativeCode || null,',
    1,
)

# ---------------------------------------------------------------------------
# App.jsx: diagnostics must beat generic bridge fallback messages. Otherwise
# a generic message can hide the actual BillingResult debugMessage/code.
# ---------------------------------------------------------------------------
app = app.replace(
    'const diagnosticCode = billingErr.responseCode ?? diagnostics.responseCode ?? null;',
    '''const diagnosticCode =
          billingErr.responseCode ??
          diagnostics.responseCode ??
          billingErr.nativeCode ??
          diagnostics.nativeCode ??
          diagnostics.code ??
          null;''',
    1,
)

app = app.replace(
    'const diagnosticName = diagnostics.responseName || billingErr.billingResponseCodeName || null;',
    '''const diagnosticName =
          diagnostics.responseName ||
          billingErr.billingResponseCodeName ||
          (diagnosticCode != null
            ? ({
                "0": "OK",
                "1": "USER_CANCELED",
                "2": "SERVICE_UNAVAILABLE",
                "3": "BILLING_UNAVAILABLE",
                "4": "ITEM_UNAVAILABLE",
                "5": "DEVELOPER_ERROR",
                "6": "ERROR",
                "7": "ITEM_ALREADY_OWNED",
                "8": "ITEM_NOT_OWNED",
                "-1": "SERVICE_DISCONNECTED",
                "-2": "FEATURE_NOT_SUPPORTED",
              }[String(diagnosticCode)] || null)
            : null);''',
    1,
)

app = app.replace(
    'const diagnosticMessage = billingErr.nativeMessage || diagnostics.debugMessage || diagnostics.message || null;',
    '''const diagnosticMessage =
          billingErr.nativeMessage ||
          diagnostics.debugMessage ||
          diagnostics.nativeMessage ||
          diagnostics.message ||
          null;''',
    1,
)

app = app.replace(
    '''const billingMessage = String(
          billingErr.message ||
          diagnosticMessage ||
          (result?.pending
            ? "Google Play returned a pending purchase"
            : "Google Play did not complete the purchase"),
        );''',
    '''const billingMessage = String(
          diagnosticMessage ||
          billingErr.message ||
          (result?.pending
            ? "Google Play returned a pending purchase"
            : "Google Play did not complete the purchase"),
        );''',
    1,
)

# Outer catch path: also consult the shared diagnostics object.
app = app.replace(
    '''const billingCode = String(
        e?.code || e?.responseCode || e?.nativeCode || "billing_flow_failed",
      );
      const billingMessage = String(
        e?.debugMessage ||
          e?.nativeMessage ||
          e?.message ||
          "Google Play did not complete the purchase",
      );''',
    '''const catchDiagnostics =
        typeof window !== "undefined"
          ? window.__fiftyFitBillingDiagnostics || {}
          : {};
      const billingCode = String(
        e?.responseCode ??
          e?.code ??
          e?.nativeCode ??
          catchDiagnostics.responseCode ??
          catchDiagnostics.nativeCode ??
          catchDiagnostics.code ??
          "billing_flow_failed",
      );
      const billingMessage = String(
        e?.nativeMessage ||
          e?.debugMessage ||
          catchDiagnostics.nativeMessage ||
          catchDiagnostics.debugMessage ||
          e?.message ||
          catchDiagnostics.message ||
          "Google Play did not complete the purchase",
      );''',
    1,
)

# We require the exact contract in the transformed source. A silent no-op is
# unacceptable because it would recreate the old generic message.
required_app = [
    'const shouldUnlock = result?.success === true;',
    'billingErr.nativeCode',
    'diagnostics.nativeCode',
    'diagnostics.code',
    'diagnosticMessage ||',
]
missing_app = [needle for needle in required_app if needle not in app]
if missing_app:
    raise SystemExit("App.jsx billing diagnostics transformation incomplete: " + ", ".join(missing_app))

required_billing = [
    'const rawMessage = String(',
    'const embedded = rawMessage.match(',
    'err.responseCode = parsedResponseCode;',
]
missing_billing = [needle for needle in required_billing if needle not in billing]
if missing_billing:
    raise SystemExit("billing.js diagnostic normalization incomplete: " + ", ".join(missing_billing))

APP.write_text(app, encoding="utf-8")
BILLING.write_text(billing, encoding="utf-8")
print("Authoritative billing diagnostics applied")
