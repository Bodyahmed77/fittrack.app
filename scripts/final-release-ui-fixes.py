from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")


def replace_once(old, new):
    global text
    if old in text:
        text = text.replace(old, new, 1)
        return True
    return False

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
replace_once('!customNutritionPlan && !pro', '!pro')

# Completed day weekday label stays visible on a green completed card.
replace_once(
    '''isDone ? C.positive\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
    '''isDone ? "#fff"\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
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
replace_once(
    'customTrainingPlanActive: parsed.customTrainingPlanActive !== false,',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true,',
)
replace_once(
    '  const isCustomTrainingPlanActive(data)',
    '  const isCustomTrainingPlanActive(data)',
)
replace_once(
    'function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive !== false;\n}',
    'function isCustomTrainingPlanActive(data) {\n  return !!data?.customTrainingPlan && data.customTrainingPlanActive === true;\n}',
)
replace_once(
    '  const isActive = data.activePlanId === planId;',
    '  const isActive = !isCustomTrainingPlanActive(data) && data.activePlanId === planId;',
)
replace_once(
    '          const isActive = data.activePlanId === p.id;',
    '          const isActive = !customTrainingPlanActive && data.activePlanId === p.id;',
)
replace_once(
    '''              const next = clone(data);\n              next.customTrainingPlanActive = true;''',
    '''              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              next.activePlanId = null;\n              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);''',
)
replace_once(
    '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    // Switching to a Pro plan starts that plan from Day 1 today.''',
    '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    next.workoutStartDate = dateKey(0);\n    // Switching to any built-in plan starts that plan from Day 1 today.''',
)

# Calendar strip: today + 2 previous + 4 upcoming.
replace_once(
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 3);''',
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 2);''',
)

# Make Home/Workout titles use the same plan source as their exercises.
replace_once(
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const dayTitle = ar\n    ? activePlan.schedule[dayName].titleAr\n    : activePlan.schedule[dayName].title;''',
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const customDay = customActive\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(dayName)]\n    : null;\n  const dayTitle = ar\n    ? (customDay?.titleAr || customDay?.title || activePlan.schedule[dayName].titleAr)\n    : (customDay?.title || activePlan.schedule[dayName].title);\n  const planDisplayName = ar\n    ? (data.customTrainingPlan?.nameAr || data.customTrainingPlan?.name || activePlan.nameAr)\n    : (data.customTrainingPlan?.name || activePlan.name);''',
)
replace_once(
    '              : `${exercises.length} Exercises · ${activePlan.name}`}',
    '              : `${exercises.length} Exercises · ${customActive ? planDisplayName : activePlan.name}`}',
)
replace_once(
    '              ? `${exercises.length} تمارين · ${activePlan.nameAr}`',
    '              ? `${exercises.length} تمارين · ${customActive ? planDisplayName : activePlan.nameAr}`',
)
replace_once(
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const assignedCustomDay = isCustomTrainingPlanActive(data)''',
    '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const assignedCustomDay = customActive''',
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

# Guard against regressions in the release transform itself.
required = [
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true',
    'const isActive = !customTrainingPlanActive && data.activePlanId === p.id;',
    'const iso = addDays(dateKey(0), i - 2);',
    'const base = getMergedExercises(data, day);',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f"final-release-ui-fixes: required invariant missing: {marker}")
if 'if (!customNutritionPlan && !pro)' in text:
    raise SystemExit("final-release-ui-fixes: nutrition plan can bypass the Pro gate")
chat_slice = text[text.find("function ChatDrawer("):text.find("function ChatDrawer(") + 25000]
if 'behavior: "smooth"' in chat_slice:
    raise SystemExit("final-release-ui-fixes: ChatDrawer still contains smooth keyboard scrolling")

APP.write_text(text, encoding="utf-8")
print("final-release-ui-fixes: keyboard/nutrition/plan/calendar/exercise-resolver hardening applied")
