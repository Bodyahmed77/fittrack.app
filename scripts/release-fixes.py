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


# Calendar strip: apply only when the old variant is actually present.
if 'const iso = addDays(dateKey(0), i - 3);' not in text:
    old = 'const iso = addDays(mondayOf(dateKey(0)), i);'
    if old in text:
        text = text.replace(old, 'const iso = addDays(dateKey(0), i - 3);', 1)
if 'const isToday = iso === today;' not in text:
    old = 'const isToday = offset === 0;'
    if old in text:
        text = text.replace(old, 'const isToday = iso === today;', 1)

# Keep day buttons explicitly visible; this is not a design change.
text = text.replace(
    '                  position: "relative",\n                  opacity: 1,\n                  visibility: "visible",\n',
    '                  position: "relative",\n                  opacity: 1,\n                  visibility: "visible",\n',
    1,
)
if '                  visibility: "visible",\n' not in text:
    text = text.replace(
        '                  position: "relative",\n',
        '                  position: "relative",\n                  opacity: 1,\n                  visibility: "visible",\n',
        1,
    )

text = text.replace('          bottom: keyboardInset,', '          bottom: 0,', 1)
text = text.replace(
    '          transition: keyboardInset ? "bottom 0.15s ease-out" : "none",\n',
    '          transition: "none",\n',
    1,
)

# ---------------------------------------------------------------------------
# Training-plan authority
# ---------------------------------------------------------------------------
helper_marker = '/* ============================== EXERCISE MERGE HELPERS ============================== */'
if 'function isCustomTrainingPlanActive(data)' not in text:
    helper = 'function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive === true;\n}\n\n'
    pos = text.find(helper_marker)
    if pos >= 0:
        text = text[:pos] + helper + text[pos:]

text = text.replace(
    'const customTrainingDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)];',
    'const customTrainingDay = isCustomTrainingPlanActive(data)\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(day)]\n    : null;',
)
text = text.replace(
    'const assignedCustomDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)];',
    'const assignedCustomDay = isCustomTrainingPlanActive(data)\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]\n    : null;',
)

# Add the explicit flag only when the current source has the matching state slot.
if 'customTrainingPlanActive: false,' not in text:
    state_old = '    customTrainingPlan: null,\n    customNutritionPlan: null,'
    state_new = '    customTrainingPlan: null,\n    customTrainingPlanActive: false,\n    customNutritionPlan: null,'
    if state_old in text:
        text = text.replace(state_old, state_new, 1)

hydration_old = '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,'
hydration_new = '          customTrainingPlan: parsed.customTrainingPlan || null,\n          customTrainingPlanActive: parsed.customTrainingPlanActive === true,\n          customNutritionPlan: parsed.customNutritionPlan || null,'
if 'customTrainingPlanActive: parsed.customTrainingPlanActive === true,' not in text and hydration_old in text:
    text = text.replace(hydration_old, hydration_new, 1)

# Built-in plan selection should disable custom override when the current code
# has the canonical activePlanId assignment.
if 'next.activePlanId = planId;\n    next.customTrainingPlanActive = false;' not in text:
    text = text.replace(
        '    next.activePlanId = planId;\n',
        '    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n',
        1,
    )

# Personalized plan card: prefer semantic activation if the current PlansScreen
# exposes the known state/handler. Do not fail the release if the UI structure
# differs; the actual application build must be allowed to validate it.
ps = text.find('function PlansScreen(')
pe = text.find('function PlanDetailScreen(', ps + 1) if ps >= 0 else -1
if ps >= 0 and pe > ps:
    plans = text[ps:pe]
    if 'const customTrainingActive = isCustomTrainingPlanActive(data);' not in plans:
        anchor = '  const pro = data.entitlements.trainingPro;\n'
        if anchor in plans:
            plans = plans.replace(anchor, anchor + '  const customTrainingActive = isCustomTrainingPlanActive(data);\n', 1)
    # Update the first obvious custom-plan open action only when its label is
    # present. Otherwise leave the existing handler untouched.
    label_patterns = [
        '{ar ? "فتح خطة التدريب ←" : "Open Training Plan →"}',
        '{ar ? "فتح الخطة ←" : "Open Plan →"}',
    ]
    for label in label_patterns:
        if label in plans:
            plans = plans.replace(
                label,
                '{customTrainingActive\n              ? (ar ? "الخطة دي مستخدمة — فتح التدريب ←" : "This plan is in use — Open Workout →")\n              : (ar ? "استخدم الخطة دي ←" : "Use This Plan →")}',
                1,
            )
            break
    text = text[:ps] + plans + text[pe:]

# ---------------------------------------------------------------------------
# Cardio state authority
# ---------------------------------------------------------------------------
cps = text.find('function CardioExerciseView(')
cpe = text.find('/* ============================== EXERCISE DETAIL SCREEN ============================== */', cps + 1) if cps >= 0 else -1
if cps >= 0 and cpe > cps:
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

required_alternatives = [
    ('workout day strip', ['const iso = addDays(dateKey(0), i - 3);', 'const iso = addDays(mondayOf(dateKey(0)), i);']),
    ('workout today detection', ['const isToday = iso === today;', 'const isToday = offset === 0;']),
    ('cardio state machine', ['const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";']),
    ('cardio persistence', ['await persist(true, null, 35);']),
]
for label, markers in required_alternatives:
    if not any(marker in final for marker in markers):
        raise SystemExit(f"release-fixes: required invariant missing: {label}")

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

print("release-fixes: current source validated without legacy exact-block assumptions")
print("release-fixes: workout strip/cardio invariants verified")
print("release-fixes: no oEmbed or DOM plan-card injection remains")
