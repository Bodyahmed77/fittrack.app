from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Weekly plan calendar: both built-in and admin-published 7-day plans are
# cyclic. The plan's start date is the beginning of cycle 0; every subsequent
# calendar date maps to day index (elapsed_days % plan_length).
# ---------------------------------------------------------------------------
cycle_fn = '''\ndef planDayForDate(data, iso):\n  active_custom = isCustomTrainingPlanActive(data)\n  if active_custom:\n    length = len((data.get("customTrainingPlan") or {}).get("days") or []) or 7\n    start = ((data.get("customTrainingPlan") or {}).get("startDate") or\n             data.get("workoutStartDate") or dateKey(0))\n  else:\n    length = 7\n    start = data.get("workoutStartDate") or dateKey(0)\n  try:\n    diff = math.floor((datetime.date.fromisoformat(iso) - datetime.date.fromisoformat(start)).days)\n  except Exception:\n    diff = 0\n  return DAYS[diff % length]\n'''

# Accept the common current helper shape and replace the whole function body.
pattern = re.compile(r'function planDayForDate\(data, iso\) \{.*?\n\}', re.S)
if pattern.search(text):
    replacement = '''function planDayForDate(data, iso) {\n  const customActive = isCustomTrainingPlanActive(data);\n  const customDays = data.customTrainingPlan?.days || [];\n  const length = customActive ? (customDays.length || 7) : 7;\n  const start = customActive\n    ? (data.customTrainingPlan?.startDate || data.workoutStartDate || dateKey(0))\n    : (data.workoutStartDate || dateKey(0));\n  const startMs = new Date(`${start}T00:00:00`).getTime();\n  const targetMs = new Date(`${iso}T00:00:00`).getTime();\n  const diff = Number.isFinite(startMs) && Number.isFinite(targetMs)\n    ? Math.floor((targetMs - startMs) / 86400000)\n    : 0;\n  const index = ((diff % length) + length) % length;\n  return DAYS[index % DAYS.length];\n}'''
    text = pattern.sub(replacement, text, count=1)
else:
    raise SystemExit("weekly-cycle: planDayForDate helper not found")

# ---------------------------------------------------------------------------
# Nutrition weekly cycle: completion history is scoped to the cycle start so
# week 2 does not inherit the checkmarks from week 1. The seven-day plan is
# never replaced or re-published; it automatically restarts on the next date.
# ---------------------------------------------------------------------------
ns = text.find("function NutritionPlanScreen(")
if ns < 0:
    raise SystemExit("weekly-cycle: NutritionPlanScreen not found")
ne = text.find("function ", ns + 1)
if ne < 0:
    ne = len(text)
nut = text[ns:ne]

# Replace the clamped day-index calculation with a modulo cycle calculation.
nut = re.sub(
    r'const computedTodayDayIndex = plan\?\.days\?\.length\s*\n\s*\?\s*Math\.max\(0, Math\.min\(plan\.days\.length - 1, \(\(\) => \{.*?return Number\.isFinite\(diff\) \? diff : 0;\s*\}\)\)\)\s*\n\s*:\s*0;',
    '''const cycleLength = plan?.days?.length || 7;\n  const start = plan?.startDate || today;\n  const startMs = new Date(start + "T00:00:00").getTime();\n  const todayMs = new Date(today + "T00:00:00").getTime();\n  const elapsedDays = Number.isFinite(startMs) && Number.isFinite(todayMs)\n    ? Math.floor((todayMs - startMs) / 86400000)\n    : 0;\n  const cycleNumber = Math.max(0, Math.floor(elapsedDays / cycleLength));\n  const computedTodayDayIndex = ((elapsedDays % cycleLength) + cycleLength) % cycleLength;\n  const cycleStart = new Date(start + "T00:00:00");\n  cycleStart.setDate(cycleStart.getDate() + cycleNumber * cycleLength);\n  const cycleStartIso = toLocalISODate(cycleStart);''',
    nut,
    count=1,
    flags=re.S,
)

# Replace the permanent log key with a cycle-scoped key.
nut = nut.replace(
    'const dayIndex=Math.max(0,Math.min((plan.days?.length || 1)-1,selectedDayIndex)); const day=plan.days?.[dayIndex] || plan.days?.[0] || {meals:[]}; const logKey=`${plan.startDate || today}:day-${dayIndex}`;',
    'const dayIndex=((selectedDayIndex % (plan.days?.length || 7)) + (plan.days?.length || 7)) % (plan.days?.length || 7); const day=plan.days?.[dayIndex] || plan.days?.[0] || {meals:[]}; const selectedCycleStart=new Date(cycleStartIso + "T00:00:00"); selectedCycleStart.setDate(selectedCycleStart.getDate() + dayIndex); const selectedCycleDate=toLocalISODate(selectedCycleStart); const logKey=`${cycleStartIso}:day-${dayIndex}`;',
    1,
)

# Make the nutrition plan calendar show the real date + weekday, not "Day 1".
needle = 'const meals=day.meals || [];\n  const foods=meals.flatMap(m=>parseItems(m.items,m.id));'
replacement = 'const meals=day.meals || [];\n  const selectedDateLabel=new Date(selectedCycleDate + "T00:00:00").toLocaleDateString(ar ? "ar-EG" : "en-US", { weekday:"long", day:"numeric", month:"long" });\n  const foods=meals.flatMap(m=>parseItems(m.items,m.id));'
if needle in nut:
    nut = nut.replace(needle, replacement, 1)

# Add the end-of-week restart status directly before the meals list.
status_anchor = '<div style={{color:C.sub,fontSize:12,marginTop:5}}>{ar?\'خطة مخصصة لك من فريق Fifty Fit\':\'A plan prepared for you by the Fifty Fit team\'}</div>'
status_insert = status_anchor + '\n<div style={{color:C.text,fontSize:12.5,fontWeight:800,marginTop:9}}>{selectedDateLabel}</div>\n{dayIndex === (cycleLength - 1) && foods.length > 0 && foods.every(f => checked[f.id]) && (<div style={{marginTop:10,padding:"10px 12px",borderRadius:12,background:C.greenSoft,border:`1px solid ${C.green}55`,color:C.text,fontSize:12.5,fontWeight:800}}>{ar ? "تم اكتمال الأسبوع ✅ بكرة الخطة هتبدأ من اليوم الأول تلقائيًا." : "Week complete ✅ Tomorrow your 7-day plan restarts automatically from day one."}</div>)}'
if status_anchor in nut:
    nut = nut.replace(status_anchor, status_insert, 1)

text = text[:ns] + nut + text[ne:]
APP.write_text(text, encoding="utf-8")
print("weekly-cycle: 7-day training and nutrition plans now repeat by calendar cycle")
