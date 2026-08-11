from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
app = root / "src/App.jsx"
text = app.read_text(encoding="utf-8")

old_import = '''import {\n  purchase as billingPurchase,\n  restorePurchases as billingRestore,\n} from "./billing";'''
new_import = '''import {\n  purchase as billingPurchase,\n  queryProducts as billingQueryProducts,\n  restorePurchases as billingRestore,\n} from "./billing";'''
if old_import not in text:
    raise SystemExit("billing import block not found")
text = text.replace(old_import, new_import, 1)

needle = '  const [restoring, setRestoring] = useState(false);'
insert = '''  const [restoring, setRestoring] = useState(false);\n  const [storeProducts, setStoreProducts] = useState([]);\n\n  // Launch policy: expose only a real monthly subscription until the native\n  // billing bridge supports selecting Google Play base-plan offer tokens.\n  // This prevents the UI from showing four prices that all purchase the same\n  // underlying product/base plan. Longer periods can be enabled later without\n  // changing the entitlement model.\n  const availableDurations = DURATIONS.filter((d) => d.id === "monthly");\n\n  useEffect(() => {\n    let alive = true;\n    billingQueryProducts("monthly")\n      .then((result) => {\n        if (alive) setStoreProducts(Array.isArray(result?.products) ? result.products : []);\n      })\n      .catch(() => {\n        if (alive) setStoreProducts([]);\n      });\n    return () => {\n      alive = false;\n    };\n  }, [selectedPlan]);'''
if needle not in text:
    raise SystemExit("Paywall restoring state not found")
text = text.replace(needle, insert, 1)

needle = '  const displayPrice = planPrice[selectedDuration] ?? price;'
replacement = '''  const storeProduct = storeProducts.find(\n    (p) => p?.productId === BILLING_PRODUCTS[selectedPlan],\n  );\n  const storePrice =\n    storeProduct?.price ||\n    storeProduct?.formattedPrice ||\n    storeProduct?.priceString ||\n    null;\n  const displayPrice = storePrice || planPrice[selectedDuration] || price;'''
if needle not in text:
    raise SystemExit("Paywall display price line not found")
text = text.replace(needle, replacement, 1)

text = text.replace('{DURATIONS.map((d) => (', '{availableDurations.map((d) => (', 1)

needle = '''          <GreenButton\n            onClick={() => purchase(selectedPlan, selectedDuration)}'''
replacement = '''          <div\n            style={{\n              color: C.sub,\n              fontSize: 11.5,\n              textAlign: "center",\n              lineHeight: 1.5,\n              margin: "2px 8px 10px",\n            }}\n          >\n            {ar\n              ? "اشتراك شهري يتجدد تلقائيًا حتى الإلغاء من Google Play."\n              : "Monthly subscription. Renews automatically until canceled in Google Play."}\n          </div>\n          <GreenButton\n            onClick={() => purchase(selectedPlan, selectedDuration)}'''
if needle not in text:
    raise SystemExit("Paywall purchase button not found")
text = text.replace(needle, replacement, 1)

app.write_text(text, encoding="utf-8")

# Update the config comment so future maintenance does not accidentally treat
# the four display-only durations as currently purchasable.
config = root / "src/config.js"
ct = config.read_text(encoding="utf-8")
ct = ct.replace('// Duration tiers: month / 3mo / 6mo / year', '// Duration catalog for future Google Play base-plan support; launch enables monthly only.')
config.write_text(ct, encoding="utf-8")

workflow = root / ".github/workflows/harden-launch-paywall.yml"
if workflow.exists(): workflow.unlink()
Path(__file__).unlink()
subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", "-A"], cwd=root, check=True)
subprocess.run(["git", "commit", "-m", "fix: make launch paywall billing-safe"], cwd=root, check=True)
subprocess.run(["git", "push", "origin", "HEAD:fix/play-readiness-p0-p1"], cwd=root, check=True)
