from pathlib import Path
import re

# Start from the already-verified deterministic v4 patch set.
exec(Path('scripts/release-fixes-v4.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v4__'})

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

# 1) Cardio completion must be durable before leaving the screen. The previous
#    patch cleared the timer timestamp, but finish() still navigated away before
#    the async Firestore write had completed. That creates the exact race where
#    the workout says "saved" but the list immediately shows it as incomplete,
#    and reopening resumes the old timer from a stale snapshot.
old = '''  const persist = useCallback((finished, cardioStartedAt = startedAt) => {\n    const next = clone(data);\n    if (!next.logs[logDate]) next.logs[logDate] = {};\n    next.logs[logDate][exerciseId] = {\n      sets: [{ weight: 0, reps: "15 min", done: finished }],\n      finished,\n      cardioStartedAt: finished ? null : (cardioStartedAt || null),\n      cardioCompletedAt: finished ? Date.now() : null,\n    };\n    setData(next);\n  }, [data, exerciseId, logDate, setData, startedAt]);'''
new = '''  const persist = useCallback(async (finished, cardioStartedAt = startedAt) => {\n    const next = clone(data);\n    if (!next.logs[logDate]) next.logs[logDate] = {};\n    next.logs[logDate][exerciseId] = {\n      sets: [{ weight: 0, reps: "15 min", done: finished }],\n      finished,\n      cardioStartedAt: finished ? null : (cardioStartedAt || null),\n      cardioCompletedAt: finished ? Date.now() : null,\n    };\n    await setData(next);\n  }, [data, exerciseId, logDate, setData, startedAt]);'''
if old not in text:
    raise SystemExit('v5: expected cardio persist block not found')
text = text.replace(old, new, 1)

old = '''  const finish = useCallback((reason) => {\n    if (saving) return;\n    setSaving(true);\n    persist(true, null);\n    setStartedAt(null);\n    setNow(Date.now());\n    try { awardXp(35); } catch {}\n    showToast(\n      reason === "timer"\n        ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")\n        : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"),\n    );\n    back();\n  }, [ar, awardXp, back, persist, saving, showToast, startedAt]);'''
new = '''  const finish = useCallback(async (reason) => {\n    if (saving) return;\n    setSaving(true);\n    try {\n      // Wait for the Firestore write before navigating away.\n      await persist(true, null);\n      setStartedAt(null);\n      setNow(Date.now());\n      try { awardXp(35); } catch {}\n      showToast(\n        reason === "timer"\n          ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")\n          : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"),\n      );\n      back();\n    } finally {\n      setSaving(false);\n    }\n  }, [ar, awardXp, back, persist, saving, showToast]);'''
if old not in text:
    raise SystemExit('v5: expected cardio finish block not found')
text = text.replace(old, new, 1)

# 2) Admin-assigned plans are assignments, not billing entitlements. Keep the
#    source correct instead of relying on a build-only regex for these guards.
text = text.replace(
    'data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]',
)
text = text.replace(
    'data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]',
)
text = re.sub(
    r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(day\)\]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]',
    text,
)
text = re.sub(
    r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(selectedDay\)\]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]',
    text,
)
text = text.replace('data.customTrainingPlan && data.entitlements.trainingPro && (', 'data.customTrainingPlan && (')
text = text.replace('data.customNutritionPlan && data.entitlements.nutritionPro && (', 'data.customNutritionPlan && (')

# Nutrition screen: a published custom nutrition plan must render even for a
# non-Pro user. If there is no custom plan, preserve the existing Pro plan/fallback.
marker = '        {pro ? (\n          <Card\n            onClick={() => go("nutritionPlan")}'
replacement = '        {customNutritionPlan ? (\n          <Card\n            onClick={() => go("nutritionPlan")}'
if marker not in text:
    raise SystemExit('v5: nutrition plan conditional marker not found')
text = text.replace(marker, replacement, 1)

# Keep the Vite hardening check consistent with the intentional non-Pro custom
# nutrition-plan behavior. The hardening plugin is itself run after this script.
VITE = Path('vite.config.js')
v = VITE.read_text(encoding='utf-8')
v_old = 'const guardedNutritionBranch = `{pro && customNutritionPlan ? (\\n          <Card\\n            onClick={() => go("nutritionPlan")}`;'
v_new = 'const guardedNutritionBranch = `{customNutritionPlan ? (\\n          <Card\\n            onClick={() => go("nutritionPlan")}`;'
if v_old not in v:
    raise SystemExit('v5: Vite nutrition hardening target not found')
v = v.replace(v_old, v_new, 1)
v_old = 'out.includes("{pro && customNutritionPlan ? (")'
v_new = 'out.includes("{customNutritionPlan ? (")'
if v_old not in v:
    raise SystemExit('v5: Vite nutrition hardening assertion not found')
v = v.replace(v_old, v_new, 1)
VITE.write_text(v, encoding='utf-8')

# 3) Prevent duplicate native notifications. planNotifications.js is the
#    dedicated bridge for published training/nutrition plans; the generic data
#    listener must not schedule the same Firestore event a second time.
notif_old = '''        const n = change.doc.data() || {};\n        const createdAtMs = Date.parse(String(n.createdAt || ""));\n        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;\n        LocalNotifications.schedule({ notifications: [{'''
notif_new = '''        const n = change.doc.data() || {};\n        const createdAtMs = Date.parse(String(n.createdAt || ""));\n        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;\n        // Plan notifications are handled by planNotifications.js so they are\n        // shown exactly once with the dedicated Android notification channel.\n        if (["nutrition_plan_ready", "training_plan_ready"].includes(String(n.type || ""))) return;\n        LocalNotifications.schedule({ notifications: [{'''
if notif_old not in text:
    raise SystemExit('v5: notification scheduling block not found')
text = text.replace(notif_old, notif_new, 1)

# The old DOM-level published-plan bridge was responsible for injecting plan
# cards by scanning arbitrary text on the page. It could mistake the Home/Plans
# navigation label for the Plans screen and prepend duplicate cards at the top
# of Home. The React screens now own these cards, so stop booting that bridge.
INDEX = Path('index.html')
index_text = INDEX.read_text(encoding='utf-8')
old_bridge = '      import { startPublishedPlansUx } from "/src/publishedPlansUx.js";\n      startPlanNotificationBridge();\n      startPublishedPlansUx();'
new_bridge = '      startPlanNotificationBridge();'
if old_bridge not in index_text:
    raise SystemExit('v5: published plan bridge bootstrap not found')
index_text = index_text.replace(old_bridge, new_bridge, 1)
INDEX.write_text(index_text, encoding='utf-8')

APP.write_text(text, encoding='utf-8')

# 4) Build-time assertions: never silently ship the old cardio race or a billing
#    gate around admin-assigned plans, and never re-enable the duplicate DOM bridge.
text = APP.read_text(encoding='utf-8')
index_text = INDEX.read_text(encoding='utf-8')
v = VITE.read_text(encoding='utf-8')
assert 'const persist = useCallback(async (finished' in text
assert 'await persist(true, null)' in text
assert 'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]' in text
assert 'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]' in text
assert 'data.customTrainingPlan && data.entitlements.trainingPro && (' not in text
assert 'data.customNutritionPlan && data.entitlements.nutritionPro && (' not in text
assert 'startPublishedPlansUx' not in index_text
assert 'const guardedNutritionBranch = `{customNutritionPlan ? (' in v
print('Release fixes v5 applied successfully')
print('Cardio completion now waits for persistence before navigation')
print('Admin-assigned custom plans are not gated by billing')
print('Duplicate plan notifications from the generic listener are disabled')
print('Legacy DOM plan-card injector is disabled to prevent duplicate Home cards')
