from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")


def replace_once(old, new, source=None):
    global text
    target = text if source is None else source
    if old in target:
        updated = target.replace(old, new, 1)
        if source is None:
            text = updated
        return updated, True
    return target, False

# Keyboard: main.jsx owns field scrolling; ChatDrawer only mirrors viewport inset.
keyboard_pattern = re.compile(
    r'\n  useEffect\(\(\) => \{\n    if \(!open\) return undefined;.*?\n  \}, \[open\]\);\n',
    re.S,
)
chat_start = text.find("function ChatDrawer(")
if chat_start >= 0:
    chat_end = text.find("function ", chat_start + 1)
    if chat_end < 0:
        chat_end = len(text)
    chat = text[chat_start:chat_end]
    matches = list(keyboard_pattern.finditer(chat))
    candidate = next((m for m in matches if "setKeyboardInset" in m.group(0)), None)
    if candidate:
        replacement = '''\n  useEffect(() => {\n    if (!open) return undefined;\n    let frame = 0;\n    const syncInset = () => {\n      cancelAnimationFrame(frame);\n      frame = requestAnimationFrame(() => {\n        const vv = window.visualViewport;\n        const inset = vv\n          ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)\n          : 0;\n        setKeyboardInset(inset);\n      });\n    };\n    window.visualViewport?.addEventListener("resize", syncInset, { passive: true });\n    window.visualViewport?.addEventListener("scroll", syncInset, { passive: true });\n    window.addEventListener("resize", syncInset, { passive: true });\n    syncInset();\n    return () => {\n      cancelAnimationFrame(frame);\n      window.visualViewport?.removeEventListener("resize", syncInset);\n      window.visualViewport?.removeEventListener("scroll", syncInset);\n      window.removeEventListener("resize", syncInset);\n      setKeyboardInset(0);\n    };\n  }, [open]);\n'''
        chat = chat[:candidate.start()] + replacement + chat[candidate.end():]
        text = text[:chat_start] + chat + text[chat_end:]

# Nutrition Pro is a billing entitlement boundary, not a published-plan boundary.
text = text.replace('!customNutritionPlan && !pro', '!pro')

# Completed day weekday label stays visible on a green completed card.
text = text.replace(
    '''isDone ? C.positive\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
    '''isDone ? "#fff"\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
    1,
)

# Notification history clear-all control.
ns = text.find("function NotificationsScreen(")
if ns >= 0:
    ne = text.find("function ", ns + 1)
    if ne < 0:
        ne = len(text)
    notifications = text[ns:ne]
    if "const clearAllNotifications = async" not in notifications:
        marker = '''  const openNotification = async (notification) => {'''
        handler = '''  const clearAllNotifications = async () => {\n    const uid = auth.currentUser?.uid;\n    if (!uid || !rows.length) return;\n    try {\n      await Promise.all(\n        rows.map((notification) =>\n          deleteDoc(doc(db, "users", uid, "notifications", notification.id)),\n        ),\n      );\n    } catch {}\n  };\n\n'''
        if marker in notifications:
            notifications = notifications.replace(marker, handler + marker, 1)
    if "مسح جميع الإشعارات" not in notifications and "Clear all notifications" not in notifications:
        topbar = '''      <TopBar title={ar ? "الإشعارات" : "Notifications"} onBack={back} />'''
        controls = '''      <div style={{ padding: "0 18px", marginTop: -2, marginBottom: 2 }}>\n        <button type="button" onClick={clearAllNotifications} disabled={!rows.length} style={{ border: `1px solid ${C.border}`, background: "transparent", color: rows.length ? C.danger : C.sub2, borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: rows.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, opacity: rows.length ? 1 : 0.55 }}>\n          <Trash2 size={14} />\n          {ar ? "مسح جميع الإشعارات" : "Clear all notifications"}\n        </button>\n      </div>'''
        if topbar in notifications:
            notifications = notifications.replace(topbar, topbar + "\n" + controls, 1)
    text = text[:ns] + notifications + text[ne:]

# Canonical training-plan source: exactly one of custom or built-in can be active.
text = text.replace(
    'customTrainingPlanActive: parsed.customTrainingPlanActive !== false,',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true,',
    1,
)
text = text.replace(
    'function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive !== false;\n}',
    'function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive === true;\n}',
    1,
)
text = text.replace(
    '  const isActive = data.activePlanId === planId;',
    '  const isActive = !isCustomTrainingPlanActive(data) && data.activePlanId === planId;',
    1,
)
# Runtime crash fix: PlansScreen declares customTrainingActive and must use that same identifier.
text = text.replace(
    '          const isActive = !customTrainingPlanActive && data.activePlanId === p.id;',
    '          const isActive = !customTrainingActive && data.activePlanId === p.id;',
    1,
)
# Defensive fallback in case an earlier transform left the bare old expression.
text = text.replace(
    'const isActive = !customTrainingPlanActive && data.activePlanId === p.id;',
    'const isActive = !customTrainingActive && data.activePlanId === p.id;',
    1,
)
text = text.replace(
    '''              const next = clone(data);\n              next.customTrainingPlanActive = true;''',
    '''              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              next.activePlanId = null;''',
    1,
)
# Remove an accidental duplicate start-date assignment if a previous hardener left one.
double_start = '''              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);\n              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);'''
text = text.replace(
    double_start,
    '''              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);''',
    1,
)
text = text.replace(
    '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    // Switching to a Pro plan starts that plan from Day 1 today.''',
    '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    next.workoutStartDate = dateKey(0);\n    // Switching to any built-in plan starts that plan from Day 1 today.''',
    1,
)
# Any explicit built-in plan choice must deactivate the published plan.
text = text.replace(
    'next.activePlanId = chosen.planId;\n',
    'next.activePlanId = chosen.planId;\n      next.customTrainingPlanActive = false;\n',
    1,
)
text = text.replace(
    'next.activePlanId = personalizedPlan.workoutPlanId;\n',
    'next.activePlanId = personalizedPlan.workoutPlanId;\n      next.customTrainingPlanActive = false;\n',
    1,
)

# Calendar strip: today + 2 previous + 4 upcoming.
text = text.replace(
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 3);''',
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 2);''',
    1,
)

# Make Home/Workout titles use the same plan source as their exercises.
text = text.replace(
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const dayTitle = ar\n    ? activePlan.schedule[dayName].titleAr\n    : activePlan.schedule[dayName].title;''',
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const customDay = customActive\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(dayName)]\n    : null;\n  const dayTitle = ar\n    ? (customDay?.titleAr || customDay?.title || activePlan.schedule[dayName].titleAr)\n    : (customDay?.title || activePlan.schedule[dayName].title);\n  const planDisplayName = ar\n    ? (data.customTrainingPlan?.nameAr || data.customTrainingPlan?.name || activePlan.nameAr)\n    : (data.customTrainingPlan?.name || activePlan.name);''',
    1,
)
text = text.replace(
    '              : `${exercises.length} Exercises · ${activePlan.name}`}\n',
    '              : `${exercises.length} Exercises · ${customActive ? planDisplayName : activePlan.name}`}\n',
    1,
)
text = text.replace(
    '              ? `${exercises.length} تمارين · ${activePlan.nameAr}`',
    '              ? `${exercises.length} تمارين · ${customActive ? planDisplayName : activePlan.nameAr}`',
    1,
)
text = text.replace(
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const assignedCustomDay = isCustomTrainingPlanActive(data)''',
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const assignedCustomDay = customActive''',
    1,
)

# Unify duplicated exercise resolution. getUsableExercises is now the only
# entitlement/cap resolver and delegates all base-plan selection to getMergedExercises.
exercise_pattern = re.compile(
    r'function getUsableExercises\(data, day\) \{.*?\n\}\n\n/\* ============================== SHARED UI',
    re.S,
)
exercise_replacement = '''function getUsableExercises(data, day) {\n  const base = getMergedExercises(data, day);\n  const pro = !!data.entitlements.trainingPro;\n  const customActive = isCustomTrainingPlanActive(data);\n  const freeBase = customActive || pro\n    ? base\n    : base.slice(0, FREE_EXERCISE_CAP);\n  const lockedCount = customActive || pro\n    ? 0\n    : Math.max(0, base.length - FREE_EXERCISE_CAP);\n  return {\n    list: freeBase,\n    lockedCount,\n  };\n}\n\n/* ============================== SHARED UI'''
match = exercise_pattern.search(text)
if match:
    text = text[:match.start()] + exercise_replacement + text[match.end():]

# Shared calendar-cycle resolver for admin-published nutrition plans.
cycle_helper_marker = 'function isCustomTrainingPlanActive(data) {'
cycle_helper = '''function nutritionCycleState(plan, todayIso = dateKey(0)) {\n  const length = Array.isArray(plan?.days) && plan.days.length ? plan.days.length : 7;\n  const startIso = plan?.startDate || todayIso;\n  const startMs = new Date(`${startIso}T00:00:00`).getTime();\n  const todayMs = new Date(`${todayIso}T00:00:00`).getTime();\n  const elapsed = Number.isFinite(startMs) && Number.isFinite(todayMs)\n    ? Math.max(0, Math.floor((todayMs - startMs) / 86400000))\n    : 0;\n  const cycleNumber = Math.floor(elapsed / length);\n  const dayIndex = elapsed % length;\n  const cycleStartIso = addDays(startIso, cycleNumber * length);\n  return { length, cycleNumber, dayIndex, cycleStartIso };\n}\n\n'''
if cycle_helper not in text:
    text = text.replace(cycle_helper_marker, cycle_helper + cycle_helper_marker, 1)

# MealsScreen: today's targets follow the same 7-day nutrition cycle instead of clamping on day 7 forever.
text = text.replace(
    '''  const customTodayPlanIndex = customNutritionPlan?.days?.length\n    ? Math.max(0, Math.min(customNutritionPlan.days.length - 1, (() => {\n        const start = customNutritionPlan.startDate || today;\n        const diff = Math.max(0, Math.floor((new Date(today + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86400000));\n        return Number.isFinite(diff) ? diff : 0;\n      })()))\n    : 0;''',
    '''  const customTodayPlanIndex = customNutritionPlan?.days?.length\n    ? nutritionCycleState(customNutritionPlan, today).dayIndex\n    : 0;''',
    1,
)

# NutritionPlanScreen: replace the clamped index with the calendar cycle index and use cycle-scoped logs.
ns = text.find("function NutritionPlanScreen(")
if ns >= 0:
    ne = text.find("function ", ns + 1)
    if ne < 0:
        ne = len(text)
    nutrition = text[ns:ne]
    nutrition = nutrition.replace(
        '''  const computedTodayDayIndex = plan?.days?.length\n    ? Math.max(0, Math.min(plan.days.length - 1, (() => {\n        const start = plan.startDate || today;\n        const diff = Math.max(0, Math.floor((new Date(today + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86400000));\n        return Number.isFinite(diff) ? diff : 0;\n      })()))\n    : 0;''',
        '''  const cycle = nutritionCycleState(plan, today);\n  const computedTodayDayIndex = cycle.dayIndex;''',
        1,
    )
    nutrition = nutrition.replace(
        '''  const [selectedDayIndex, setSelectedDayIndex] = useState(0);''',
        '''  const [selectedDayIndex, setSelectedDayIndex] = useState(0);''',
        1,
    )
    nutrition = nutrition.replace(
        '''  const dayIndex=Math.max(0,Math.min((plan.days?.length || 1)-1,selectedDayIndex)); const day=plan.days?.[dayIndex] || plan.days?.[0] || {meals:[]}; const logKey=`${plan.startDate || today}:day-${dayIndex}`; const checked=log[logKey] || (dayIndex===computedTodayDayIndex ? (log[today] || {}) : {}); const meals=day.meals || [];''',
        '''  const dayIndex=((selectedDayIndex % cycle.length) + cycle.length) % cycle.length;\n  const day=plan.days?.[dayIndex] || plan.days?.[0] || {meals:[]};\n  const selectedCycleDate=addDays(cycle.cycleStartIso, dayIndex);\n  const selectedDateLabel=new Date(selectedCycleDate + "T00:00:00").toLocaleDateString(ar ? "ar-EG" : "en-US", {weekday:"long", day:"numeric", month:"long"});\n  const logKey=`${cycle.cycleStartIso}:day-${dayIndex}`;\n  const legacyLogKey=`${plan.startDate || today}:day-${dayIndex}`;\n  const checked=log[logKey] || (cycle.cycleNumber===0 ? (log[legacyLogKey] || log[today] || {}) : {});\n  const meals=day.meals || [];''',
        1,
    )
    nutrition = nutrition.replace(
        '''  const foods=meals.flatMap(m=>parseItems(m.items,m.id));''',
        '''  const foods=meals.flatMap(m=>parseItems(m.items,m.id));\n  const dayCompleted=foods.length>0 && foods.every(f=>!!checked[f.id]);\n  const getDayStatus=(i)=>{\n    const date=addDays(cycle.cycleStartIso,i);\n    const d=plan.days?.[i] || {meals:[]};\n    const dayFoods=(d.meals||[]).flatMap(m=>parseItems(m.items,m.id));\n    const dayChecked=log[`${cycle.cycleStartIso}:day-${i}`] || (cycle.cycleNumber===0 ? (log[`${plan.startDate || today}:day-${i}`] || {}) : {});\n    const complete=dayFoods.length>0 && dayFoods.every(f=>!!dayChecked[f.id]);\n    return {date,complete,missed:date<today&&!complete};\n  };''',
        1,
    )
    # Replace the day-selector buttons: real weekday/date, completion state, no future-day jumping.
    day_buttons_old = '''<div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8}}>{(plan.days||[]).map((d,i)=><button key={i} type="button" onClick={()=>setSelectedDayIndex(i)} style={{minWidth:72,padding:'9px 7px',borderRadius:11,background:i===dayIndex?C.green:C.card2,color:i===dayIndex?C.onAccent:C.sub,textAlign:'center',fontSize:11,fontWeight:800,border:'none',cursor:'pointer',flexShrink:0}}>{ar?(d.titleAr||`اليوم ${i+1}`):(d.title||`Day ${i+1}`)}</button>)}</div>'''
    day_buttons_new = '''<div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8}}>{(plan.days||[]).map((d,i)=>{const status=getDayStatus(i);const wd=weekdayOf(status.date);const dateNum=new Date(status.date+"T00:00:00").getDate();const disabled=status.date>today;return <button key={i} type="button" onClick={()=>!disabled&&setSelectedDayIndex(i)} disabled={disabled} style={{minWidth:76,padding:'8px 7px',borderRadius:11,background:status.complete?C.positive:(status.missed?C.dangerSoft:(i===dayIndex?C.green:C.card2)),color:status.complete?'#fff':(status.missed?C.danger:(i===dayIndex?C.onAccent:C.sub)),textAlign:'center',fontSize:10.5,fontWeight:800,border:`1px solid ${status.complete?C.positive:(status.missed?C.danger+'66':C.border)}`,cursor:disabled?'default':'pointer',flexShrink:0,opacity:disabled?0.55:1}}><div>{ar?DAY_LABELS_AR[DAYS[wd]]:new Date(status.date+"T00:00:00").toLocaleDateString('en-US',{weekday:'short'})}</div><div style={{fontSize:14,fontWeight:900,marginTop:2}}>{dateNum}</div><div style={{fontSize:10,marginTop:2}}>{status.complete?'✓':status.missed?'!':status.date===today?(ar?'اليوم':'Today'):''}</div></button>})}</div><div style={{color:C.sub,fontSize:12,fontWeight:800,marginBottom:10}}>{selectedDateLabel}</div>'''
    nutrition = nutrition.replace(day_buttons_old, day_buttons_new, 1)
    # Add localized completion/restart messages immediately before the meal list.
    nutrition = nutrition.replace(
        '''</div>{meals.map(meal=>{''',
        '''</div>{dayCompleted&&<div style={{marginBottom:10,padding:"10px 12px",borderRadius:12,background:C.greenSoft,border:`1px solid ${C.green}55`,color:C.text,fontSize:12.5,fontWeight:800,textAlign:'center'}}>{cycle.dayIndex===cycle.length-1?(ar?'تم إكمال اليوم السابع ✅ بكرة الخطة هتبدأ من اليوم الأول.':'Day 7 completed ✅ Tomorrow the plan restarts from day 1.'):(ar?'تم إكمال اليوم ✅ بكرة هتبدأ اليوم التالي.':'Day completed ✅ Tomorrow the next day starts automatically.')}</div>}{meals.map(meal=>{''',
        1,
    )
    text = text[:ns] + nutrition + text[ne:]

# Hardening invariants.
required = [
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true',
    'const isActive = !customTrainingActive && data.activePlanId === p.id;',
    'const iso = addDays(dateKey(0), i - 2);',
    'const base = getMergedExercises(data, day);',
    'function nutritionCycleState(plan, todayIso = dateKey(0))',
    'const customTodayPlanIndex = customNutritionPlan?.days?.length\n    ? nutritionCycleState(customNutritionPlan, today).dayIndex',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f"final-release-ui-fixes: required invariant missing: {marker}")
if 'if (!customNutritionPlan && !pro)' in text:
    raise SystemExit("final-release-ui-fixes: nutrition plan can bypass the Pro gate")
if re.search(r'\bconst\s+isActive\s*=\s*!customTrainingPlanActive\b', text):
    raise SystemExit("final-release-ui-fixes: undefined customTrainingPlanActive remains in PlansScreen")
chat_index = text.find("function ChatDrawer(")
if chat_index >= 0:
    chat_slice = text[chat_index:chat_index + 25000]
    if 'behavior: "smooth"' in chat_slice:
        raise SystemExit("final-release-ui-fixes: ChatDrawer still contains smooth keyboard scrolling")

APP.write_text(text, encoding="utf-8")
print("final-release-ui-fixes: plan reference, nutrition 7-day cycle, keyboard and plan-source hardening applied")
