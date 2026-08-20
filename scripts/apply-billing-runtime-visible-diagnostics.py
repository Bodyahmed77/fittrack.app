from pathlib import Path

PATH = Path("src/App.jsx")
if not PATH.exists():
    raise SystemExit("src/App.jsx is missing")

text = PATH.read_text(encoding="utf-8")

# The entitlement gate must not require client-side `verified`; verification is
# performed by registerServerEntitlement against Google Play on the backend.
old_gate = "const shouldUnlock = result?.success === true && result?.verified === true;"
new_gate = "const shouldUnlock = result?.success === true;"
if old_gate in text:
    text = text.replace(old_gate, new_gate, 1)

# Replace the generic billing failure fallback with the complete structured
# diagnostics captured by billing.js/native. This is intentionally fail-closed:
# no diagnostic means the literal fallback remains visible, but never silently.
old_message = '''        const billingMessage = String(\n          billingErr.message ||\n          (result?.pending\n            ? "Google Play returned a pending purchase"\n            : "Google Play did not complete the purchase"),\n        );'''
new_message = '''        const diagnostics =\n          typeof window !== "undefined"\n            ? window.__fiftyFitBillingDiagnostics || {}\n            : {};\n        const diagnosticCode =\n          billingErr.responseCode ??\n          diagnostics.responseCode ??\n          null;\n        const diagnosticName =\n          diagnostics.responseName ||\n          billingErr.billingResponseCodeName ||\n          null;\n        const diagnosticMessage =\n          billingErr.nativeMessage ||\n          diagnostics.debugMessage ||\n          diagnostics.message ||\n          null;\n        const billingMessage = String(\n          billingErr.message ||\n          diagnosticMessage ||\n          (result?.pending\n            ? "Google Play returned a pending purchase"\n            : "Google Play did not complete the purchase"),\n        );'''
if old_message in text:
    text = text.replace(old_message, new_message, 1)

old_diag = '''            subResponseCode: billingErr.subResponseCode || null,\n            updatedAt: new Date().toISOString(),'''
new_diag = '''            subResponseCode:\n              billingErr.subResponseCode ||\n              diagnostics.subResponseCode ||\n              null,\n            responseName: diagnosticName,\n            nativeMessage: diagnosticMessage,\n            stage: diagnostics.stage || null,\n            basePlanId:\n              diagnostics.selectedBasePlanId ||\n              diagnostics.basePlanId ||\n              null,\n            offerId:\n              diagnostics.selectedOfferId ||\n              diagnostics.offerId ||\n              null,\n            offerTokenPresent:\n              diagnostics.offerTokenPresent ??\n              null,\n            debugMessage: diagnostics.debugMessage || null,\n            updatedAt: new Date().toISOString(),'''
if old_diag in text:
    text = text.replace(old_diag, new_diag, 1)

old_toast = '''        showToast(\n          ar\n            ? `فشل الدفع — كود Google Play: ${billingCode} — ${billingMessage}`\n            : `Purchase failed — Google Play code: ${billingCode} — ${billingMessage}`,\n        );'''
new_toast = '''        const visibleCode = diagnosticCode ?? billingCode;\n        const visibleName = diagnosticName ? ` (${diagnosticName})` : "";\n        const visibleStage = diagnostics.stage ? ` — stage: ${diagnostics.stage}` : "";\n        showToast(\n          ar\n            ? `فشل الدفع — كود Google Play: ${visibleCode}${visibleName} — ${billingMessage}${visibleStage}`\n            : `Purchase failed — Google Play code: ${visibleCode}${visibleName} — ${billingMessage}${visibleStage}`,\n          10000,\n        );'''
if old_toast in text:
    text = text.replace(old_toast, new_toast, 1)

PATH.write_text(text, encoding="utf-8")
print("Billing runtime visible diagnostics applied")
