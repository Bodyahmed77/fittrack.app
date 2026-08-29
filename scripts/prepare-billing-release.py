#!/usr/bin/env python3
"""Apply and verify the release-only Google Play purchase-result + acknowledge fix.

1) Capture and return purchaseResult from purchase() so App.jsx can continue.
2) After a purchase token is received, call native sendAck immediately so
   Google does not auto-cancel unacknowledged test purchases (~3 minutes).
"""
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


billing_path = Path("src/billing.js")
billing = billing_path.read_text(encoding="utf-8")

wrapper_marker = "const purchaseResult = await withPurchaseTimeout((async () => {"
outer_return = "    return purchaseResult;"

if wrapper_marker not in billing:
    billing = replace_once(
        billing,
        "    await withPurchaseTimeout((async () => {",
        f"    {wrapper_marker}",
        "billing purchase wrapper",
    )

if outer_return not in billing:
    billing = replace_once(
        billing,
        "    })());\n  } catch (e) {",
        "    })());\n    return purchaseResult;\n  } catch (e) {",
        "billing purchase return",
    )

# --- Native acknowledge helper (idempotent) ---
ACK_HELPER = '''
async function acknowledgePurchaseToken(billing, token) {
  if (!token || !billing || typeof billing.sendAck !== "function") {
    return { acknowledged: false, skipped: true };
  }
  try {
    const ack = await billing.sendAck({ purchaseToken: token });
    const code = ack?.responseCode ?? ack?.billingResponseCode ?? ack?.code;
    const ok =
      ack?.success === true ||
      code === 0 ||
      code === "0";
    writeBillingDiagnostics({
      stage: ok ? "purchase_acknowledged_native" : "purchase_acknowledge_failed",
      responseCode: code ?? null,
      purchaseTokenPresent: true,
    });
    return { acknowledged: !!ok, result: ack };
  } catch (e) {
    writeBillingDiagnostics({
      stage: "purchase_acknowledge_exception",
      message: e?.message || String(e),
      purchaseTokenPresent: true,
    });
    return { acknowledged: false, error: e };
  }
}

'''

if "async function acknowledgePurchaseToken" not in billing:
    needle = "function isPurchased(purchase) {"
    if needle not in billing:
        raise SystemExit("isPurchased helper missing — cannot inject acknowledgePurchaseToken")
    billing = billing.replace(needle, ACK_HELPER + needle, 1)

# Replace deferred-ack success return with native ack + success
OLD_SUCCESS = """      writeBillingDiagnostics({ stage: \"purchase_token_received\", productId, purchaseTokenPresent: true });
      return {
        success: true,
        preview: false,
        verified: false,
        nativeAcknowledged: false,
        acknowledgementDeferred: true,
        productId: purchaseProducts(result)[0] || productId,
        result,
      };"""

NEW_SUCCESS = """      writeBillingDiagnostics({ stage: \"purchase_token_received\", productId, purchaseTokenPresent: true });

      // Acknowledge immediately on-device so Google does not auto-cancel test
      // purchases (~3 min) while server verification / Supabase grant runs.
      const ack = await acknowledgePurchaseToken(plugin, token);
      const nativeAcknowledged = !!ack?.acknowledged;

      return {
        success: true,
        preview: false,
        verified: false,
        nativeAcknowledged,
        acknowledgementDeferred: !nativeAcknowledged,
        purchaseToken: token,
        productId: purchaseProducts(result)[0] || productId,
        result,
      };"""

if "await acknowledgePurchaseToken(plugin, token)" not in billing:
    if OLD_SUCCESS not in billing:
        if "nativeAcknowledged: false" in billing and "acknowledgementDeferred: true" in billing:
            raise SystemExit("purchase success block present but pattern mismatch for ack inject")
        print("WARN: success return already has native ack or unexpected shape")
    else:
        billing = billing.replace(OLD_SUCCESS, NEW_SUCCESS, 1)

billing_path.write_text(billing, encoding="utf-8")

billing = billing_path.read_text(encoding="utf-8")
assert wrapper_marker in billing, "purchase wrapper result capture is missing"
assert outer_return in billing, "purchase result is not returned from outer purchase()"
assert "acknowledgePurchaseToken" in billing, "native acknowledge helper missing"
assert "sendAck" in billing, "sendAck call missing"
assert "await acknowledgePurchaseToken(plugin, token)" in billing, "native ack not invoked after token"

print("Fifty Fit billing purchase-result + native acknowledge verified.")
