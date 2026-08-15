from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

required_markers = (
    "function isCustomTrainingPlanActive",
    "customTrainingPlanActive",
    "customNutritionPlan",
    "workoutStartDate",
)
missing = [marker for marker in required_markers if marker not in text]
if missing:
    raise SystemExit(
        "weekly-cycle: current training-plan state markers missing: "
        + ", ".join(missing)
    )

# Published nutrition plans are browseable. Future days may be inspected
# without changing today's cycle index or completion state.
start = text.find("function NutritionPlanScreen(")
if start < 0:
    raise SystemExit("weekly-cycle: NutritionPlanScreen not found")
end = text.find("function ", start + 1)
if end < 0:
    end = len(text)
nutrition = text[start:end]

button_pattern = re.compile(r"<button\b[^>]*setSelectedDayIndex\(i\)[^>]*>", re.S)
buttons = button_pattern.findall(nutrition)
if not buttons:
    raise SystemExit("weekly-cycle: published nutrition day selector button not found")

for old in buttons:
    new = re.sub(r"\s+disabled=\{(?:[^{}]|\{[^{}]*\})*\}", "", old)
    new = re.sub(r"\s+aria-disabled=\{(?:[^{}]|\{[^{}]*\})*\}", "", new)
    new = re.sub(
        r"onClick=\{(?:[^{}]|\{[^{}]*\})*setSelectedDayIndex\(i\)(?:[^{}]|\{[^{}]*\})*\}",
        'onClick={() => setSelectedDayIndex(i)}',
        new,
    )
    new = re.sub(r"pointerEvents\s*:\s*[^,}]+,?", "", new)
    nutrition = nutrition.replace(old, new, 1)

for button in re.findall(r"<button\b[^>]*setSelectedDayIndex\(i\)[^>]*>", nutrition, re.S):
    if "disabled=" in button or "aria-disabled=" in button:
        raise SystemExit("weekly-cycle: a future published nutrition day is still disabled")

text = text[:start] + nutrition + text[end:]
APP.write_text(text, encoding="utf-8")
print(f"weekly-cycle: published nutrition days are browseable ({len(buttons)} day tab(s)); completion state remains date/cycle based")
