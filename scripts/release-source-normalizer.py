from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")
original = text

# Work only inside NutritionPlanScreen so unrelated code cannot be changed.
start = text.find("function NutritionPlanScreen(")
if start < 0:
    raise SystemExit("normalizer: NutritionPlanScreen not found")
end = text.find("\nfunction ", start + 1)
if end < 0:
    end = len(text)

nutrition = text[start:end]

# The current source may already contain the nutrition completion declarations.
# Keep exactly one declaration block; never inject a second copy.
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

# Future published-plan days must remain viewable. Completion state is separate
# from navigation, so disabling a future date is not allowed.
nutrition = nutrition.replace(
    'const disabled=status.date>today;',
    'const disabled=false;',
)

# Do not allow a legacy future-day disable to remain in the selector handler.
nutrition = nutrition.replace(
    'onClick={()=>!disabled&&setSelectedDayIndex(i)} disabled={disabled}',
    'onClick={()=>setSelectedDayIndex(i)}',
)

text = text[:start] + nutrition + text[end:]

# Source invariants only. These must already be represented by the canonical app source.
required = [
    'function nutritionCycleState(plan, todayIso = dateKey(0))',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true',
    'const customTodayPlanIndex = customNutritionPlan?.days?.length',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f"normalizer: required invariant missing: {marker}")

if 'if (!customNutritionPlan && !pro)' in text:
    raise SystemExit('normalizer: nutrition targets can bypass the Pro entitlement gate')

if re.search(r'\bconst\s+isActive\s*=\s*!customTrainingPlanActive\b', text):
    raise SystemExit('normalizer: undefined customTrainingPlanActive remains in PlansScreen')

if text != original:
    APP.write_text(text, encoding='utf-8')
    print('release-source-normalizer: source normalized and persisted in workspace')
else:
    print('release-source-normalizer: source already canonical; no changes needed')
