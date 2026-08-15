from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Android keyboard: make the AI Coach drawer follow the visual viewport,
# rather than trusting the native keyboard height directly. The main entry
# point already publishes --ff-keyboard-height from visualViewport.
# ---------------------------------------------------------------------------
chat_start = text.find("function ChatDrawer(")
chat_end = text.find("function ", chat_start + 1) if chat_start >= 0 else -1
if chat_start >= 0 and chat_end > chat_start:
    chat = text[chat_start:chat_end]
    pattern = re.compile(
        r'''\n  useEffect\(\(\) => \{\n    if \(!open\) return undefined;\n    let cancelled = false;\n    let handles = \[\];\n    import\("@capacitor/keyboard"\).*?\n  \}, \[open\]\);\n''',
        re.S,
    )
    replacement = '''\n  useEffect(() => {\n    if (!open) return undefined;\n    let frame = 0;\n    const syncViewport = () => {\n      cancelAnimationFrame(frame);\n      frame = requestAnimationFrame(() => {\n        const vv = window.visualViewport;\n        const inset = vv\n          ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)\n          : 0;\n        setKeyboardInset(inset);\n\n        const active = document.activeElement;\n        if (!active || (!["INPUT", "TEXTAREA"].includes(active.tagName) && !active.isContentEditable)) return;\n        const rect = active.getBoundingClientRect();\n        const visibleBottom = (vv?.height || window.innerHeight) - 14;\n        if (rect.bottom > visibleBottom) {\n          window.scrollBy({ top: rect.bottom - visibleBottom + 24, behavior: "smooth" });\n        }\n      });\n    };\n\n    const focusHandler = () => {\n      window.setTimeout(syncViewport, 120);\n      window.setTimeout(syncViewport, 320);\n    };\n\n    window.addEventListener("resize", syncViewport, { passive: true });\n    window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });\n    window.visualViewport?.addEventListener("scroll", syncViewport, { passive: true });\n    document.addEventListener("focusin", focusHandler, true);\n    syncViewport();\n\n    return () => {\n      cancelAnimationFrame(frame);\n      window.removeEventListener("resize", syncViewport);\n      window.visualViewport?.removeEventListener("resize", syncViewport);\n      window.visualViewport?.removeEventListener("scroll", syncViewport);\n      document.removeEventListener("focusin", focusHandler, true);\n      setKeyboardInset(0);\n    };\n  }, [open]);\n'''
    match = pattern.search(chat)
    if match:
        chat = chat[:match.start()] + replacement + chat[match.end():]
        text = text[:chat_start] + chat + text[chat_end:]

# ---------------------------------------------------------------------------
# Completed-day labels: keep the weekday label white on a completed green day.
# ---------------------------------------------------------------------------
day_label_old = '''isDone ? C.positive\n                        : isMissed ? C.danger\n                        : isToday ? C.green'''
day_label_new = '''isDone ? "#fff"\n                        : isMissed ? C.danger\n                        : isToday ? C.green'''
if day_label_old in text:
    text = text.replace(day_label_old, day_label_new, 1)

# ---------------------------------------------------------------------------
# Notification history: add an explicit "clear all" control. It only removes
# the in-app Firestore notification history; scheduled reminders remain intact.
# ---------------------------------------------------------------------------
ns = text.find("function NotificationsScreen(")
ne = text.find("function ", ns + 1) if ns >= 0 else -1
if ns >= 0 and ne > ns:
    notifications = text[ns:ne]
    if "const clearAllNotifications = async" not in notifications:
        marker = '''  const openNotification = async (notification) => {'''
        handler = '''  const clearAllNotifications = async () => {\n    const uid = auth.currentUser?.uid;\n    if (!uid || !rows.length) return;\n    try {\n      await Promise.all(\n        rows.map((notification) =>\n          deleteDoc(doc(db, "users", uid, "notifications", notification.id)),\n        ),\n      );\n    } catch {}\n  };\n\n'''
        if marker in notifications:
            notifications = notifications.replace(marker, handler + marker, 1)
    if "مسح جميع الإشعارات" not in notifications and "Clear all notifications" not in notifications:
        topbar = '''      <TopBar title={ar ? "الإشعارات" : "Notifications"} onBack={back} />'''
        controls = '''      <div style={{ padding: "0 18px", marginTop: -2, marginBottom: 2, display: "flex", justifyContent: ar ? "flex-start" : "flex-start" }}>\n        <button\n          type="button"\n          onClick={clearAllNotifications}\n          disabled={!rows.length}\n          style={{\n            border: `1px solid ${C.border}`,\n            background: "transparent",\n            color: rows.length ? C.danger : C.sub2,\n            borderRadius: 10,\n            padding: "7px 10px",\n            fontSize: 12,\n            fontWeight: 700,\n            cursor: rows.length ? "pointer" : "default",\n            display: "flex",\n            alignItems: "center",\n            gap: 6,\n            opacity: rows.length ? 1 : 0.55,\n          }}\n        >\n          <Trash2 size={14} />\n          {ar ? "مسح جميع الإشعارات" : "Clear all notifications"}\n        </button>\n      </div>'''
        if topbar in notifications:
            notifications = notifications.replace(topbar, topbar + "\n" + controls, 1)
    text = text[:ns] + notifications + text[ne:]

# ---------------------------------------------------------------------------
# Plan source is a first-class state. Built-in plans must never appear active
# while a published custom plan is active, and an old/missing flag must default
# to the built-in plan rather than unexpectedly activating the published one.
# ---------------------------------------------------------------------------
text = text.replace(
    'customTrainingPlanActive: parsed.customTrainingPlanActive !== false,',
    'customTrainingPlanActive: parsed.customTrainingPlanActive === true,',
    1,
)
text = text.replace(
    '  const isActive = data.activePlanId === planId;',
    '  const isActive = !isCustomTrainingPlanActive(data) && data.activePlanId === planId;',
    1,
)

# Published plan activation: start its Day-1 timeline from its own published
# startDate (or today), so the weekday strip and day completion logic use the
# same source of truth as the published plan itself.
custom_activate_marker = '''              const next = clone(data);\n              next.customTrainingPlanActive = true;'''
custom_activate_replacement = '''              const next = clone(data);\n              next.customTrainingPlanActive = true;\n              next.workoutStartDate = data.customTrainingPlan.startDate || dateKey(0);'''
if custom_activate_marker in text:
    text = text.replace(custom_activate_marker, custom_activate_replacement, 1)

# Built-in plan activation: explicitly turn off published-plan mode and restart
# the selected built-in plan from today. This prevents stale custom mode from
# leaking into the standard/pro plan workout screen.
builtin_use_marker = '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    // Switching to a Pro plan starts that plan from Day 1 today.'''
builtin_use_replacement = '''    next.activePlanId = planId;\n    next.customTrainingPlanActive = false;\n    next.workoutStartDate = dateKey(0);\n    // Switching to any built-in plan starts that plan from Day 1 today.'''
if builtin_use_marker in text:
    text = text.replace(builtin_use_marker, builtin_use_replacement, 1)

# Day strip: today + 2 previous days + 4 upcoming days = 7 calendar days.
old_window = '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 3);'''
new_window = '''{Array.from({ length: 7 }, (_, i) => {\n            const iso = addDays(dateKey(0), i - 2);'''
if old_window in text:
    text = text.replace(old_window, new_window, 1)

# Use the active plan source consistently in Home and Workout labels. A custom
# published plan should never show the built-in plan name/title while its
# exercises are coming from the custom plan.
home_title_old = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const dayTitle = ar\n    ? activePlan.schedule[dayName].titleAr\n    : activePlan.schedule[dayName].title;'''
home_title_new = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const customDay = customActive\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(dayName)]\n    : null;\n  const dayTitle = ar\n    ? (customDay?.titleAr || customDay?.title || activePlan.schedule[dayName].titleAr)\n    : (customDay?.title || activePlan.schedule[dayName].title);\n  const planDisplayName = ar\n    ? (data.customTrainingPlan?.nameAr || data.customTrainingPlan?.name || activePlan.nameAr)\n    : (data.customTrainingPlan?.name || activePlan.name);'''
if home_title_old in text:
    text = text.replace(home_title_old, home_title_new, 1)
text = text.replace(
    '              : `${exercises.length} Exercises · ${activePlan.name}`}',
    '              : `${exercises.length} Exercises · ${customActive ? planDisplayName : activePlan.name}`}',
    1,
)
text = text.replace(
    '              ? `${exercises.length} تمارين · ${activePlan.nameAr}`',
    '              ? `${exercises.length} تمارين · ${customActive ? planDisplayName : activePlan.nameAr}`',
    1,
)

workout_header_old = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const assignedCustomDay = isCustomTrainingPlanActive(data)'''
workout_header_new = '''  const activePlan =\n    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;\n  const customActive = isCustomTrainingPlanActive(data);\n  const assignedCustomDay = customActive'''
if workout_header_old in text:
    text = text.replace(workout_header_old, workout_header_new, 1)
text = text.replace(
    '            ? `${exercises.length} تمارين · ${activePlan.nameAr}`\n            : `${exercises.length} Exercises · ${activePlan.name}`',
    '            ? `${exercises.length} تمارين · ${customActive ? (data.customTrainingPlan?.nameAr || data.customTrainingPlan?.name || activePlan.nameAr) : activePlan.nameAr}`\n            : `${exercises.length} Exercises · ${customActive ? (data.customTrainingPlan?.name || activePlan.name) : activePlan.name}`',
    1,
)

APP.write_text(text, encoding="utf-8")

final = APP.read_text(encoding="utf-8")
if "clearAllNotifications" not in final:
    raise SystemExit("final-release-ui-fixes: notification clear handler missing")
if "مسح جميع الإشعارات" not in final:
    raise SystemExit("final-release-ui-fixes: notification clear label missing")
if day_label_old in final:
    raise SystemExit("final-release-ui-fixes: completed day label is still green-on-green")
if "customTrainingPlanActive: parsed.customTrainingPlanActive === true" not in final:
    raise SystemExit("final-release-ui-fixes: custom plan hydration guard missing")
if "const iso = addDays(dateKey(0), i - 2);" not in final:
    raise SystemExit("final-release-ui-fixes: day strip window was not updated")
if "const isActive = !isCustomTrainingPlanActive(data) && data.activePlanId === planId;" not in final:
    raise SystemExit("final-release-ui-fixes: built-in plan active-state isolation missing")
print("final-release-ui-fixes: keyboard/day-label/notification/plan/calendar fixes applied")
