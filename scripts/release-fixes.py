"""Idempotent release-source hardening for the current Fifty Fit codebase."""
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")
text = APP.read_text(encoding="utf-8")


def replace_once_or_already(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"release-fixes: target not unique for {label}: {count}")
    text = text.replace(old, new, 1)


def function_block(source: str, signature: str, next_signature: str):
    start = source.find(signature)
    if start < 0:
        raise SystemExit(f"release-fixes: {signature} not found")
    end = source.find(next_signature, start + len(signature))
    if end < 0:
        raise SystemExit(f"release-fixes: {next_signature} not found after {signature}")
    return start, end

# Keep the rolling 7-day strip anchored to real calendar dates.
replace_once_or_already(
    'const iso = addDays(mondayOf(dateKey(0)), i);',
    'const iso = addDays(dateKey(0), i - 3);',
    "workout day strip anchor",
)
replace_once_or_already(
    'const isToday = offset === 0;',
    'const isToday = iso === today;',
    "workout today detection",
)

# Android/WebView: ensure the selected/completed day labels never inherit a
# transparent/disabled button state. This is visibility hardening only.
text = text.replace(
    '                  position: "relative",\n',
    '                  position: "relative",\n                  opacity: 1,\n                  visibility: "visible",\n',
    1,
)

# The native keyboard resizes the Capacitor viewport; do not double-subtract it.
text = text.replace('          bottom: keyboardInset,', '          bottom: 0,', 1)
text = text.replace(
    '          transition: keyboardInset ? "bottom 0.15s ease-out" : "none",\n',
    '          transition: "none",\n',
    1,
)

# ---------------------------------------------------------------------------
# Training plan authority
# ---------------------------------------------------------------------------
helper_marker = '/* ============================== EXERCISE MERGE HELPERS ============================== */'
helper = '''function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive !== false;\n}\n\n'''
if 'function isCustomTrainingPlanActive(data)' not in text:
    pos = text.find(helper_marker)
    if pos < 0:
        raise SystemExit("release-fixes: exercise merge helper marker not found")
    text = text[:pos] + helper + text[pos:]

text = text.replace(
    'const customTrainingDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)];',
    'const customTrainingDay = isCustomTrainingPlanActive(data)\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(day)]\n    : null;',
)
text = text.replace(
    'const assignedCustomDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)];',
    'const assignedCustomDay = isCustomTrainingPlanActive(data)\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]\n    : null;',
)

# Persist the selector flag through the default state and Firestore hydration.
replace_once_or_already(
    '    customTrainingPlan: null,\n    customNutritionPlan: null,',
    '    customTrainingPlan: null,\n    customTrainingPlanActive: false,\n    customNutritionPlan: null,',
    "fresh training-plan active flag",
)
replace_once_or_already(
    '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,',
    '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customTrainingPlanActive: parsed.customTrainingPlanActive !== false,\n          customNutritionPlan: parsed.customNutritionPlan || null,',
    "Firestore training-plan active flag",
)

# Choosing a built-in plan explicitly disables the personalized override.
ps, pe = function_block(text, 'function PlanDetailScreen(', '\n/* ============================== PAYWALL ============================== */')
plan_detail = text[ps:pe]
if 'next.customTrainingPlanActive = false;' not in plan_detail:
    plan_detail = plan_detail.replace(
        '    next.activePlanId = planId;\n',
        '    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n',
        1,
    )
text = text[:ps] + plan_detail + text[pe:]

# The personalized plan card becomes the actual activation control instead of
# always jumping into Workout while the old source remains active.
ps, pe = function_block(text, 'function PlansScreen(', '\nfunction PlanDetailScreen(')
plans = text[ps:pe]
if 'const customTrainingActive = isCustomTrainingPlanActive(data);' not in plans:
    plans = plans.replace(
        '  const pro = data.entitlements.trainingPro;\n',
        '  const pro = data.entitlements.trainingPro;\n  const customTrainingActive = isCustomTrainingPlanActive(data);\n',
        1,
    )
plans = plans.replace(
    '            onClick={() => go("workout")}',
    '''            onClick={() => {\n              if (customTrainingActive) {\n                go("workout");\n                return;\n              }\n              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              setData(next);\n              showToast(ar ? "تم تفعيل خطة التدريب المخصصة" : "Personalized training plan activated");\n            }}''',
    1,
)
plans = plans.replace(
    '              {ar ? "فتح خطة التدريب ←" : "Open Training Plan →"}',
    '              {customTrainingActive ? (ar ? "فتح خطة التدريب ←" : "Open Training Plan →") : (ar ? "استخدم الخطة دي" : "Use This Plan")}',
    1,
)
text = text[:ps] + plans + text[pe:]

APP.write_text(text, encoding="utf-8")

# Assertions protect against regressions without relying on one legacy source block.
final = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
required = [
    'const iso = addDays(dateKey(0), i - 3);',
    'const isToday = iso === today;',
    'bottom: 0,',
    'function isCustomTrainingPlanActive(data)',
    'next.customTrainingPlanActive = false;',
    'const customTrainingActive = isCustomTrainingPlanActive(data);',
    'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";',
    'await persist(true, null, 35);',
]
for marker in required:
    if marker not in final:
        raise SystemExit(f"release-fixes: invariant missing: {marker}")
if re.search(r'\boembed\b', final, re.I):
    raise SystemExit("release-fixes: oEmbed dependency remains in App.jsx")
if 'appendChild' in final:
    raise SystemExit("release-fixes: DOM plan injection remains in App.jsx")
if 'https://www.tiktok.com/player/v1/' in final:
    raise SystemExit("release-fixes: TikTok player URL must not be manufactured in App.jsx")
if final.count('function FullScreenVideoViewer(') != 1:
    raise SystemExit("release-fixes: FullScreenVideoViewer is not canonical")
if final.count('function VideoPlayer(') != 1:
    raise SystemExit("release-fixes: VideoPlayer is not canonical")
if 'function StartupGate' not in main_text:
    raise SystemExit("release-fixes: StartupGate missing")
if 'setTimeout(() => setMinimumTimeElapsed(true), 1600)' not in main_text:
    raise SystemExit("release-fixes: startup minimum duration missing")

print("release-fixes: source hardening complete")
print("release-fixes: rolling day strip + Android visibility hardening applied")
print("release-fixes: built-in/custom training plan selection is authoritative")
print("release-fixes: TikTok URLs remain owned by EXERCISE_VIDEOS and native viewer")
print("release-fixes: cardio never resurrects an old timer")
