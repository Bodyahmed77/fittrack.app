from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")
original = text

# ---------------------------------------------------------------------------
# Nutrition-plan canonicalization.
# ---------------------------------------------------------------------------
start = text.find("function NutritionPlanScreen(")
if start < 0:
    raise SystemExit("normalizer: NutritionPlanScreen not found")
end = text.find("\nfunction ", start + 1)
if end < 0:
    end = len(text)

nutrition = text[start:end]

block_re = re.compile(
    r"\n\s*const dayCompleted\s*=.*?;\s*\n\s*const getDayStatus\s*=\(i\)\s*=>\s*\{.*?\n\s*\};",
    re.S,
)
blocks = list(block_re.finditer(nutrition))
if len(blocks) > 1:
    first = blocks[0]
    rebuilt = nutrition[:first.end()]
    cursor = first.end()
    for block in blocks[1:]:
        rebuilt += nutrition[cursor:block.start()]
        cursor = block.end()
    rebuilt += nutrition[cursor:]
    nutrition = rebuilt

nutrition = nutrition.replace(
    'const disabled=status.date>today;',
    'const disabled=false;',
)
nutrition = nutrition.replace(
    'onClick={()=>!disabled&&setSelectedDayIndex(i)} disabled={disabled}',
    'onClick={()=>setSelectedDayIndex(i)}',
)
text = text[:start] + nutrition + text[end:]

# ---------------------------------------------------------------------------
# Firestore write/read race guard.
#
# Every client write already includes updatedAt. The listener must not allow a
# cached/older snapshot to overwrite a newer local write while that write is
# being committed. This is the real cause behind the onboarding loop seen on
# device: the form could save, then an older snapshot could flip onboarded back
# to false before the root phase switched to the app.
# ---------------------------------------------------------------------------
store_start = text.find("function useAppData(")
store_end = text.find("\nfunction nutritionCycleState", store_start)
if store_start < 0 or store_end < 0:
    raise SystemExit("normalizer: useAppData scope not found")
store = text[store_start:store_end]

if "const latestLocalWriteAtRef = useRef(null);" not in store:
    store = store.replace(
        "  const verifiedEntitlementsRef = useRef(null);",
        "  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);",
        1,
    )

snapshot_guard = '''        const snapUpdatedAt = String(parsed.updatedAt || "");
        const latestLocalWriteAt = String(latestLocalWriteAtRef.current || "");
        if (
          latestLocalWriteAt &&
          snapUpdatedAt &&
          snapUpdatedAt < latestLocalWriteAt
        ) {
          return;
        }
'''
if "const snapUpdatedAt = String(parsed.updatedAt || \"\");" not in store:
    anchor = "        const merged = {\n"
    if anchor not in store:
        raise SystemExit("normalizer: Firestore snapshot merge anchor not found")
    store = store.replace(anchor, snapshot_guard + anchor, 1)

# Make the timestamp part of the exact write that is tracked by the listener.
old_write = '''      try {
        const persisted = Object.fromEntries(
          Object.entries(next).filter(
            ([key]) =>
              key !== "entitlements" &&
              key !== "customTrainingPlan" &&
              key !== "customNutritionPlan",
          ),
        );
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        return true;
      } catch (e) {
        console.error("save failed", e);
        return false;
      }
'''
new_write = '''      try {
        const persisted = Object.fromEntries(
          Object.entries(next).filter(
            ([key]) =>
              key !== "entitlements" &&
              key !== "customTrainingPlan" &&
              key !== "customNutritionPlan",
          ),
        );
        const updatedAt = new Date().toISOString();
        latestLocalWriteAtRef.current = updatedAt;
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt },
          { merge: true },
        );
        return true;
      } catch (e) {
        console.error("save failed", e);
        return false;
      }
'''
if "const updatedAt = new Date().toISOString();" not in store:
    if old_write not in store:
        raise SystemExit("normalizer: setData Firestore write block not found")
    store = store.replace(old_write, new_write, 1)

text = text[:store_start] + store + text[store_end:]

# ---------------------------------------------------------------------------
# Onboarding: preserve the user's selected language in the exact document that
# is submitted, so a stale/empty settings.language cannot revert the UI.
# ---------------------------------------------------------------------------
onboarding_start = text.find("function OnboardingScreen(")
onboarding_end = text.find("\nfunction HomeScreen(", onboarding_start)
if onboarding_start < 0 or onboarding_end < 0:
    raise SystemExit("normalizer: OnboardingScreen scope not found")
onboarding = text[onboarding_start:onboarding_end]

if 'next.settings.language = next.settings.language || localLang' not in onboarding:
    onboarding = onboarding.replace(
        "    next.onboarded = true;\n",
        '    next.settings = { ...next.settings, language: next.settings.language || ar && "ar" || "en" };\n    next.onboarded = true;\n',
        1,
    )
text = text[:onboarding_start] + onboarding + text[onboarding_end:]

# ---------------------------------------------------------------------------
# Billing: never swallow the native BillingResult. The previous .catch(() =>
# ({ success:false })) erased the real responseCode and debugMessage before the
# Paywall code could display them.
# ---------------------------------------------------------------------------
pay_start = text.find("function PaywallScreen(")
pay_end = text.find("\nfunction ", pay_start + 1)
if pay_start < 0 or pay_end < 0:
    raise SystemExit("normalizer: PaywallScreen scope not found")
paywall = text[pay_start:pay_end]

paywall = paywall.replace(
    '''      const result = await billingPurchase(planId, durationId).catch(() => ({
        success: false,
        preview: true,
      }));''',
    '''      const result = await billingPurchase(planId, durationId);''',
    1,
)

old_outer_catch = '''    } catch (e) {
      showToast(
        ar
          ? "حصل خطأ في عملية الشراء — حاول تاني"
          : "Purchase failed — please try again",
      );
    } finally {'''
new_outer_catch = '''    } catch (e) {
      const billingCode = String(
        e?.code || e?.responseCode || e?.nativeCode || "billing_flow_failed",
      );
      const billingMessage = String(
        e?.debugMessage || e?.nativeMessage || e?.message || "Google Play did not complete the purchase",
      );
      try {
        window.__fiftyFitLastBillingError = {
          ...(window.__fiftyFitLastBillingError || {}),
          code: billingCode,
          message: billingMessage,
          responseCode: e?.responseCode ?? null,
          updatedAt: new Date().toISOString(),
        };
      } catch (_) {}
      showToast(
        ar
          ? `فشل الدفع — كود Google Play: ${billingCode} — ${billingMessage}`
          : `Purchase failed — Google Play code: ${billingCode} — ${billingMessage}`,
        8000,
      );
    } finally {'''
if "const billingCode = String(\n        e?.code || e?.responseCode" not in paywall:
    if old_outer_catch not in paywall:
        raise SystemExit("normalizer: PaywallScreen outer catch block not found")
    paywall = paywall.replace(old_outer_catch, new_outer_catch, 1)

# Remove a duplicated no-op assignment that had crept into the training unlock path.
paywall = paywall.replace(
    "      next.customTrainingPlanActive = false;\n      next.customTrainingPlanActive = false;",
    "      next.customTrainingPlanActive = false;",
    1,
)
text = text[:pay_start] + paywall + text[pay_end:]

# ---------------------------------------------------------------------------
# Safety invariants.
# ---------------------------------------------------------------------------
required = [
    'function nutritionCycleState(plan, todayIso = dateKey(0))',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true',
    'const customTodayPlanIndex = customNutritionPlan?.days?.length',
    'const latestLocalWriteAtRef = useRef(null);',
    'const snapUpdatedAt = String(parsed.updatedAt || "");',
    'const updatedAt = new Date().toISOString();',
    'next.settings = { ...next.settings, language: next.settings.language || ar && "ar" || "en" };',
    'const result = await billingPurchase(planId, durationId);',
    'e?.responseCode || e?.nativeCode || "billing_flow_failed"',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f"normalizer: required invariant missing: {marker}")

if '.catch(() => ({\n        success: false,\n        preview: true,\n      }))' in text:
    raise SystemExit('normalizer: billingPurchase error swallowing remains')
if 'if (!customNutritionPlan && !pro)' in text:
    raise SystemExit('normalizer: nutrition targets can bypass the Pro entitlement gate')
if re.search(r'\bconst\s+isActive\s*=\s*!customTrainingPlanActive\b', text):
    raise SystemExit('normalizer: undefined customTrainingPlanActive remains in PlansScreen')
if 'appendChild(' in text:
    raise SystemExit('normalizer: legacy DOM injector appendChild remains')
if re.search(r'https://www\.tiktok\.com/oembed', text, re.I):
    raise SystemExit('normalizer: TikTok oEmbed dependency remains')

if text != original:
    APP.write_text(text, encoding='utf-8')
    print('release-source-normalizer: onboarding persistence, language, and billing diagnostics normalized')
else:
    print('release-source-normalizer: source already canonical; no changes needed')
