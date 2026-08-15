from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

start = text.find("function NutritionPlanScreen(")
if start < 0:
    raise SystemExit("open-nutrition-days: NutritionPlanScreen not found")
end = text.find("function ", start + 1)
if end < 0:
    end = len(text)
nutrition = text[start:end]

# Published nutrition plans are browseable: every day button can open its meals.
# Remove any disabled/conditional click gate that only allows today's day.
button_pattern = re.compile(r"<button\\b[^>]*setSelectedDayIndex\\(i\\)[^>]*>", re.S)
buttons = button_pattern.findall(nutrition)
if not buttons:
    raise SystemExit("open-nutrition-days: nutrition day selector button not found")

updated_buttons = []
for button in buttons:
    updated = re.sub(r"\\s+disabled=\\{(?:[^{}]|\\{[^{}]*\\})*\\}", "", button)
    updated = re.sub(r"\\s+aria-disabled=\\{(?:[^{}]|\\{[^{}]*\\})*\\}", "", updated)
    # Normalize any conditional click handler into an unconditional selector.
    updated = re.sub(
        r"onClick=\\{(?:[^{}]|\\{[^{}]*\\})*setSelectedDayIndex\\(i\\)(?:[^{}]|\\{[^{}]*\\})*\\}",
        'onClick={() => setSelectedDayIndex(i)}',
        updated,
    )
    # Remove a pointer-events gate if one was attached to the day tab itself.
    updated = re.sub(r"pointerEvents\\s*:\s*[^,}]+,?", "", updated)
    updated_buttons.append(updated)

for old, new in zip(buttons, updated_buttons):
    nutrition = nutrition.replace(old, new, 1)

# Guardrail: future-day tabs must not remain disabled in the nutrition screen.
for button in re.findall(r"<button\\b[^>]*setSelectedDayIndex\\(i\\)[^>]*>", nutrition, re.S):
    if "disabled=" in button or "aria-disabled=" in button:
        raise SystemExit("open-nutrition-days: a published nutrition day is still disabled")

text = text[:start] + nutrition + text[end:]
APP.write_text(text, encoding="utf-8")
print(f"open-nutrition-days: enabled {len(buttons)} published nutrition day tab(s) for browsing")
