#!/usr/bin/env python3
"""Release-time source hardening for Fifty Fit billing.

This script is intentionally deterministic and idempotent. It fixes the
purchase-result propagation bug that caused a real Google Play success
(purchase token received) to be returned as undefined to App.jsx, and keeps
Restore Purchases reachable even when the local Firestore entitlement is false.
"""
from pathlib import Path

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

billing = Path("src/billing.js")
text = billing.read_text(encoding="utf-8")

if "const purchaseResult = await withPurchaseTimeout((async () => {" not in text:
    text = replace_once(
        text,
        "    await withPurchaseTimeout((async () => {",
        "    const purchaseResult = await withPurchaseTimeout((async () => {",
        "billing purchase wrapper",
    )
    text = replace_once(
        text,
        "    })());\n  } catch (e) {",
        "    })());\n    return purchaseResult;\n  } catch (e) {",
        "billing purchase return",
    )
billing.write_text(text, encoding="utf-8")

app = Path("src/App.jsx")
text = app.read_text(encoding="utf-8")

if "onClick={restore}" in text:
    restore_pos = text.index("onClick={restore}")
    guard = (
        "        {(data.entitlements.trainingPro ||\n"
        "          data.entitlements.nutritionPro ||\n"
        "          data.entitlements.aiCoachPro) && ("
    )
    guard_start = text.rfind(guard, 0, restore_pos)
    if guard_start != -1:
        text = text[:guard_start] + "        {true && (" + text[guard_start + len(guard):]

old = "Your meal plan is now available inside the app — find it in the Nutrition Plan tab. Need help anytime, chat with us on WhatsApp."
new = "Your personalized meal plan will be prepared and sent to you within 12 hours. We'll notify you when it's ready."
if old in text:
    text = text.replace(old, new, 1)

old_ar = "خطة الأكل الخاصة بك أصبحت متاحة داخل التطبيق — هتلاقيها في تبويب الخطة الغذائية. احتجت مساعدة، كلمنا على واتساب في أي وقت."
new_ar = "هنجهز لك خطة الأكل المخصصة ونرسلها لك خلال 12 ساعة. هنبلغك أول ما تكون جاهزة."
if old_ar in text:
    text = text.replace(old_ar, new_ar, 1)

app.write_text(text, encoding="utf-8")

billing = billing.read_text(encoding="utf-8")
assert "const purchaseResult = await withPurchaseTimeout((async () => {" in billing
assert "    return purchaseResult;" in billing

app = app.read_text(encoding="utf-8")
assert "onClick={restore}" in app
restore_pos = app.index("onClick={restore}")
guard = (
    "        {(data.entitlements.trainingPro ||\n"
    "          data.entitlements.nutritionPro ||\n"
    "          data.entitlements.aiCoachPro) && ("
)
assert app.rfind(guard, 0, restore_pos) == -1, "Restore Purchases is still hidden behind local entitlement state"

print("Fifty Fit billing release hardening applied and verified.")
