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

# Android/WebView: ensure day buttons remain visible. This is visibility
# hardening only; it does not alter the selected/completed colors.
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
helper = '''function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive === true;\n}\n\n'''
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

# Persist the explicit selector flag through default state and Firestore hydration.
# These are optional compatibility additions: if the current state already
# contains them, leave it untouched instead of forcing a legacy text block.
if 'customTrainingPlanActive: false,' not in text:
    text = text.replace(
        '    customTrainingPlan: null,\n    customNutritionPlan: null,',
        '    customTrainingPlan: null,\n    customTrainingPlanActive: false,\n    customNutritionPlan: null,',
        1,
    )
if 'customTrainingPlanActive: parsed.customTrainingPlanActive === true,' not in text:
    hydration_old = '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,'
    hydration_new = '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customTrainingPlanActive: parsed.customTrainingPlanActive === true,\n          customNutritionPlan: parsed.customNutritionPlan || null,'
    if hydration_old in text:
        text = text.replace(hydration_old, hydration_new, 1)

# Choosing a built-in plan explicitly disables the personalized override.
ps, pe = function_block(text, 'function PlanDetailScreen(', '/* ============================== PAYWALL ============================== */')
plan_detail = text[ps:pe]
if 'next.customTrainingPlanActive = false;' not in plan_detail:
    plan_detail = plan_detail.replace(
        '    next.activePlanId = planId;\n',
        '    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n',
        1,
    )
text = text[:ps] + plan_detail + text[pe:]

# The personalized plan card becomes the actual activation control.
ps, pe = function_block(text, 'function PlansScreen(', 'function PlanDetailScreen(')
plans = text[ps:pe]
if 'const customTrainingActive = isCustomTrainingPlanActive(data);' not in plans:
    plans = plans.replace(
        '  const pro = data.entitlements.trainingPro;\n',
        '  const pro = data.entitlements.trainingPro;\n  const customTrainingActive = isCustomTrainingPlanActive(data);\n',
        1,
    )
old_card_handler = '            onClick={() => go("workout")}\n'
if old_card_handler in plans:
    plans = plans.replace(
        old_card_handler,
        '''            onClick={() => {\n              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              next.activePlanId = "custom";\n              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);\n              setData(next);\n              go("workout");\n            }}\n''',
        1,
    )
plans = plans.replace(
    '{ar ? "فتح خطة التدريب ←" : "Open Training Plan →"}',
    '{customTrainingActive\n              ? (ar ? "الخطة دي مستخدمة — فتح التدريب ←" : "This plan is in use — Open Workout →")\n              : (ar ? "استخدم الخطة دي ←" : "Use This Plan →")}',
    1,
)
text = text[:ps] + plans + text[pe:]

# ---------------------------------------------------------------------------
# Cardio state authority
# ---------------------------------------------------------------------------
# Do not assume a specific old timer snippet exists. Instead, inspect only the
# current CardioExerciseView block and remove stale-resume declarations if
# they still exist. Already-fixed code passes through unchanged.
cps, cpe = function_block(
    text,
    'function CardioExerciseView(',
    '/* ============================== EXERCISE DETAIL SCREEN ============================== */',
)
cardio = text[cps:cpe]
cardio = re.sub(r'^\s*const existingStartedAt = .*?\n', '', cardio, flags=re.M)
cardio = re.sub(r'^\s*const existingElapsed = .*?\n', '', cardio, flags=re.M)
cardio = re.sub(r'^\s*const resumableStartedAt = .*?\n', '', cardio, flags=re.M)
cardio = cardio.replace('useState(resumableStartedAt)', 'useState(null)')
text = text[:cps] + cardio + text[cpe:]

APP.write_text(text, encoding="utf-8")

# ---------------------------------------------------------------------------
# Final source assertions
# ---------------------------------------------------------------------------
final = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
required_markers = [
    'const iso = addDays(dateKey(0), i - 3);',
    'const isToday = iso === today;',
    'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";',
    'await persist(true, null, 35);',
    'function isCustomTrainingPlanActive(data)',
    'customTrainingPlanActive: false,',
    'next.customTrainingPlanActive = false;',
    'next.customTrainingPlanActive = true;',
    'next.activePlanId = "custom";',
]
for marker in required_markers:
    if marker not in final:
        raise SystemExit(f"release-fixes: required current-source invariant missing: {marker}")

if 'resumableStartedAt' in final:
    raise SystemExit("release-fixes: cardio timer still contains stale-resume state")
if re.search(r'\boembed\b', final, re.I):
    raise SystemExit("release-fixes: TikTok oEmbed dependency remains in App.jsx")
if 'appendChild' in final:
    raise SystemExit("release-fixes: DOM appendChild renderer remains in App.jsx")
if final.count('function FullScreenVideoViewer(') != 1:
    raise SystemExit("release-fixes: FullScreenVideoViewer is not canonical")
if final.count('function VideoPlayer(') != 1:
    raise SystemExit("release-fixes: VideoPlayer is not canonical")
if 'function StartupGate' not in main_text:
    raise SystemExit("release-fixes: StartupGate is missing")
if 'setTimeout(() => setMinimumTimeElapsed(true), 1600)' not in main_text:
    raise SystemExit("release-fixes: startup minimum duration is not 1600ms")
if 'animation: "fiftyLogoIn 1.15s' not in main_text:
    raise SystemExit("release-fixes: startup animation is missing")

print("release-fixes: current source hardened and validated")
print("release-fixes: workout strip uses rolling calendar dates and visible day buttons")
print("release-fixes: built-in/custom training plan authority is explicit")
print("release-fixes: cardio state cannot resurrect an old timer")
print("release-fixes: no oEmbed or DOM plan-card injection remains")
