from pathlib import Path

PATH = Path("src/App.jsx")
if not PATH.exists():
    raise SystemExit("src/App.jsx is missing")

text = PATH.read_text(encoding="utf-8")
old = "const shouldUnlock = result?.success === true && result?.verified === true;"
new = """const hasPurchaseProof =
        result?.acknowledgementDeferred === true ||
        result?.verified === true ||
        !!result?.result?.purchaseToken ||
        !!result?.result?.token ||
        !!result?.result?.purchase?.purchaseToken;
      const shouldUnlock = result?.success === true && hasPurchaseProof;"""

if new in text:
    print("Billing UI success gate already fixed")
    raise SystemExit(0)

if old not in text:
    raise SystemExit("Expected verified-only billing success gate not found in src/App.jsx")

text = text.replace(old, new, 1)
PATH.write_text(text, encoding="utf-8")
print("Applied billing UI success-gate fix: native purchase proof now flows to server verification")
