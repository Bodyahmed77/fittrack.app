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

# ---------------------------------------------------------------------------
# Keyboard: the app entry point owns the actual viewport/keyboard scrolling.
# ChatDrawer must only mirror the measured inset and must never start a second
# animated scroll loop. Two independent smooth-scroll loops were the source of
# the Android up/down keyboard glitch.
# ---------------------------------------------------------------------------
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
    candidate = next(
        (m for m in matches if "setKeyboardInset" in m.group(0)),
        None,
    )
    if candidate:
        replacement = '''\n  useEffect(() => {\n    if (!open) return undefined;\n\n    let frame = 0;\n    const syncInset = () => {\n      cancelAnimationFrame(frame);\n      frame = requestAnimationFrame(() => {\n        const vv = window.visualViewport;\n        const inset = vv\n          ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)\n          : 0;\n        setKeyboardInset(inset);\n      });\n    };\n\n    window.visualViewport?.addEventListener("resize", syncInset, { passive: true });\n    window.visualViewport?.addEventListener("scroll", syncInset, { passive: true });\n    window.addEventListener("resize", syncInset, { passive: true });\n    syncInset();\n\n    return () => {\n      cancelAnimationFrame(frame);\n      window.visualViewport?.removeEventListener("resize", syncInset);\n      window.visualViewport?.removeEventListener("scroll", syncInset);\n      window.removeEventListener("resize", syncInset);\n      setKeyboardInset(0);\n    };\n  }, [open]);\n'''
        chat = chat[:candidate.start()] + replacement + chat[candidate.end():]
        text = text[:chat_start] + chat + text[chat_end:]

# ---------------------------------------------------------------------------
# Nutrition entitlement boundary: publishing/assigning a custom nutrition plan
# must never unlock the Pro-only calorie/macro dashboard. Billing entitlement is
# the only gate for that dashboard.
# ---------------------------------------------------------------------------
replace_once('!customNutritionPlan && !pro', '!pro')

# ---------------------------------------------------------------------------
# Completed-day labels: a green completed card still shows a readable weekday.
# ---------------------------------------------------------------------------
replace_once(
    '''isDone ? C.positive\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
    '''isDone ? "#fff"\n                        : isMissed ? C.danger\n                        : isToday ? C.green''',
)

# ---------------------------------------------------------------------------
# Notification history: explicit clear-all for the in-app Firestore history.
# Scheduled local reminders are intentionally untouched.
# ---------------------------------------------------------------------------
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
        controls = '''      <div style={{ padding: "0 18px", marginTop: -2, marginBottom: 2 }}>\n        <button\n          type="button"\n          onClick={clearAllNotifications}\n          disabled={!rows.length}\n          style={{\n            border: `1px solid ${C.border}`,\n            background: "transparent",\n            color: rows.length ? C.danger : C.sub2,\n            borderRadius: 10,\n            padding: "7px 10px",\n            fontSize: 12,\n            fontWeight: 700,\n            cursor: rows.length ? "pointer" : "default",\n            display: "flex",\n            alignItems: "center",\n            gap: 6,\n            opacity: rows.length ? 1 : 0.55,\n          }}\n        >\n          <Trash2 size={14} />\n          {ar ? "مسح جميع الإشعارات" : "Clear all notifications"}\n        </button>\n      </div>'''
        if topbar in notifications:
            notifications = notifications.replace(topbar, topbar + "\n" + controls, 1)
    text = text[:ns] + notifications + text[ne:]

# ---------------------------------------------------------------------------
# Training-plan source of truth.
# Exactly one source can be active:
#   customTrainingPlanActive === true  -> published/admin plan
#   customTrainingPlanActive === false -> built-in PLAN_TEMPLATES[data.activePlanId]
# ---------------------------------------------------------------------------
replace_once(
    'customTrainingPlanActive: parsed.customTrainingPlanActive !== false,',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true,',
)
replace_once(
    '  const isActive = data.activePlanId === planId;',
    '  const isActive = !isCustomTrainingPlanActive(data) && data.activePlanId === planId;',
)
replace_once(
    '          const isActive = data.activePlanId === p.id;',
    '          const isActive = !customTrainingPlanActive && data.activePlanId === p.id;',
)

custom_activate_marker = '''              const next = clone(data);\n              next.customTrainingPlanActive = true;'''
custom_activate_replacement = '''              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              next.activePlanId = null;\n              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);'''
replace_once(custom_activate_marker, custom_activate_replacement)

builtin_use_marker = '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    // Switching to a Pro plan starts that plan from Day 1 today.'''
builtin_use_replacement = '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    next.workoutStartDate = dateKey(0);\n    // Switching to any built-in plan starts that plan from Day 1 today.'''
replace_once(builtin_use_marker, builtin_use_replacement)

# ---------------------------------------------------------------------------
# Calendar strip: today + 2 previous + 4 upcoming.
# ---------------------------------------------------------------------------
replace_once(
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 3);''',
    '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 2);''',
)

# Published plan title must follow the same active source as its exercises.
home_title_old = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const dayTitle = ar\n    ? activePlan.schedule[dayName].titleAr\n    : activePlan.schedule[dayName].title;'''
home_title_new = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const customDay = customActive\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(dayName)]\n    : null;\n  const dayTitle = ar\n    ? (customDay?.titleAr || customDay?.title || activePlan.schedule[dayName].titleAr)\n    : (customDay?.title || activePlan.schedule[dayName].title);\n  const planDisplayName = ar\n    ? (data.customTrainingPlan?.nameAr || data.customTrainingPlan?.name || activePlan.nameAr)\n    : (data.customTrainingPlan?.name || activePlan.name);'''
replace_once(home_title_old, home_title_new)
replace_once(
    '              : `${exercises.length} Exercises · ${activePlan.name}`}',
    '              : `${exercises.length} Exercises · ${customActive ? planDisplayName : activePlan.name}`}',
)
replace_once(
    '              ? `${exercises.length} تمارين · ${activePlan.nameAr}`',
    '              ? `${exercises.length} تمارين · ${customActive ? planDisplayName : activePlan.nameAr}`',
)

workout_header_old = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const assignedCustomDay = isCustomTrainingPlanActive(data)'''
workout_header_new = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const assignedCustomDay = customActive'''
replace_once(workout_header_old, workout_header_new)

# ---------------------------------------------------------------------------
# Keep the published plan isolated from built-in plan badges.
# ---------------------------------------------------------------------------
if "const isActive = !customTrainingPlanActive && data.activePlanId === p.id;" not in text:
    raise SystemExit("final-release-ui-fixes: built-in plan badge still has no custom-plan guard")
if "customTrainingPlanActive: parsed.customTrainingPlanActive === true" not in text:
    raise SystemExit("final-release-ui-fixes: custom plan hydration guard missing")
if "const iso = addDays(dateKey(0), i - 2);" not in text:
    raise SystemExit("final-release-ui-fixes: day strip window was not updated")
if "if (!customNutritionPlan && !pro)" in text:
    raise SystemExit("final-release-ui-fixes: nutrition plan can bypass the Pro gate")
if "behavior: \"smooth\"" in text[text.find("function ChatDrawer("):text.find("function ChatDrawer(") + 25000]:
    raise SystemExit("final-release-ui-fixes: ChatDrawer still contains smooth keyboard scrolling")

APP.write_text(text, encoding="utf-8")
print("final-release-ui-fixes: keyboard/nutrition/plan/calendar/notification hardening applied")
