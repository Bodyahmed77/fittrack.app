export function normalizeBillingError(error, fallbackCode = "billing_flow_failed") {
  const candidates = [
    error,
    error?.error,
    error?.response,
    error?.result,
    error?.details,
  ].filter(Boolean);

  let code = null;
  let message = null;
  let debugMessage = null;
  for (const source of candidates) {
    if (code == null) {
      code = source?.responseCode ?? source?.billingResponseCode ?? source?.nativeCode ?? source?.code ?? null;
    }
    if (!message) {
      message = source?.debugMessage ?? source?.message ?? null;
    }
    if (!debugMessage) {
      debugMessage = source?.debugMessage ?? null;
    }
  }

  const normalizedCode = code == null || String(code).trim() === "" ? fallbackCode : String(code);
  const normalizedMessage = message ? String(message) : "Google Play did not complete the purchase";

  try {
    window.__fiftyFitBillingDiagnostics = {
      ...(window.__fiftyFitBillingDiagnostics || {}),
      lastPurchaseError: {
        code: normalizedCode,
        message: normalizedMessage,
        debugMessage: debugMessage ? String(debugMessage) : null,
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (_) {}

  return Object.assign(new Error(normalizedMessage), {
    code: normalizedCode,
    debugMessage: debugMessage ? String(debugMessage) : null,
    nativeCode: code == null ? null : String(code),
  });
}
