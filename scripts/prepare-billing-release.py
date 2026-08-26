#!/usr/bin/env python3
"""Apply and verify the release-only Google Play purchase-result fix.

The native bridge can successfully return a purchase token, but the wrapper
must return that result from its outer purchase() function so App.jsx can
continue into server verification. This script applies that minimal fix at
build time and refuses to continue unless the source contains both halves of
that contract.
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

billing_path.write_text(billing, encoding="utf-8")

billing = billing_path.read_text(encoding="utf-8")
assert wrapper_marker in billing, "purchase wrapper result capture is missing"
assert outer_return in billing, "purchase result is not returned from outer purchase()"

print("Fifty Fit billing purchase-result propagation verified.")
