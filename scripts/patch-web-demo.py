#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"
TIKTOK = ROOT / "src" / "tiktokWebView.js"


def demo_enabled():
    # The web-demo build sets VITE_WEB_DEMO=1. The public URL also keeps
    # ?demo=1 so the same deployed artifact is harmless when opened normally.
    import os
    return os.environ.get("VITE_WEB_DEMO") == "1"


def patch_main():
    if not demo_enabled():
        return
    s = MAIN.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_DEMO_RUNTIME_V2" in s:
        return

    marker = 'setupKeyboardInsets();\n\nconst App = React.lazy(() => import("./App.jsx"));'
    replacement = '''setupKeyboardInsets();\n\n/* FIFTYFIT_WEB_DEMO_RUNTIME_V2 */\nconst FIFTYFIT_WEB_DEMO_V2 = typeof window !== "undefined" &&\n  (import.meta.env?.VITE_WEB_DEMO === "1" || new URLSearchParams(window.location.search).get("demo") === "1");\nif (FIFTYFIT_WEB_DEMO_V2) {\n  window.__FIFTYFIT_DEMO_MODE__ = true;\n  try { document.documentElement.classList.add("fiftyfit-web-demo"); } catch (_) {}\n}\n\nconst App = React.lazy(() => import("./App.jsx"));'''
    if marker not in s:
        raise SystemExit("web-demo-v2: main marker not found")
    s = s.replace(marker, replacement, 1)
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    if not demo_enabled():
        return
    s = APP.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_DEMO_APP_V2" in s:
        return

    # Demo uses a local synthetic session: no shared demo password, no Firebase
    # writes, and no cross-user contamination.
    auth_marker = '''function useFirebaseSession() {\n  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = not checked yet, null = signed out\n  useEffect(\n    () => onAuthStateChanged(auth, (u) => setFirebaseUser(u || null)),\n    [],\n  );\n  return firebaseUser;\n}'''
    auth_replacement = '''function useFirebaseSession() {\n  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__;\n  const demoUser = demoMode\n    ? {\n        uid: "fiftyfit-web-demo",\n        email: "demo@fiftyfit.app",\n        displayName: "Demo Athlete",\n        providerData: [],\n      }\n    : null;\n  const [firebaseUser, setFirebaseUser] = useState(demoMode ? demoUser : undefined);\n  useEffect(() => {\n    if (demoMode) {\n      setFirebaseUser(demoUser);\n      return undefined;\n    }\n    return onAuthStateChanged(auth, (u) => setFirebaseUser(u || null));\n  }, [demoMode]);\n  return firebaseUser;\n}'''
    if auth_marker not in s:
        raise SystemExit("web-demo-v2: auth marker not found")
    s = s.replace(auth_marker, auth_replacement, 1)

    # Insert the local demo data layer immediately before useAppData.
    data_marker = 'function useAppData(uid) {'
    demo_helpers = '''/* FIFTYFIT_WEB_DEMO_APP_V2 */\nconst WEB_DEMO_STORAGE_KEY = "fiftyfit:web-demo-state:v2";\nfunction buildWebDemoSeed() {\n  const seed = freshState();\n  const today = dateKey(0);\n  seed.onboarded = true;\n  seed.workoutStartDate = today;\n  seed.account = {\n    ...seed.account,\n    name: "Demo Athlete",\n    email: "demo@fiftyfit.app",\n    phone: "",\n    gender: "Male",\n    age: 24,\n    height: 174,\n    weight: 72,\n    goal: "muscle",\n    daysPerWeek: 5,\n    activityLevel: "moderate",\n  };\n  seed.settings = { ...seed.settings, language: "en", notifications: false, reminderTime: "18:00" };\n  seed.bodyWeight = [{ id: `${today}-08:00-72`, weight: 72, date: today, time: "08:00" }];\n  seed.dailyTargets = { kcal: 3000, protein: 150, carbs: 412.5, fat: 83.3, macroMode: "custom" };\n  seed.activePlanId = "five_day";\n  seed.aiUsage = { date: today, count: 0 };\n  return seed;\n}\nfunction readWebDemoState() {\n  try {\n    const raw = localStorage.getItem(WEB_DEMO_STORAGE_KEY);\n    if (!raw) return buildWebDemoSeed();\n    const parsed = JSON.parse(raw);\n    const base = buildWebDemoSeed();\n    return {\n      ...base,\n      ...parsed,\n      account: { ...base.account, ...(parsed.account || {}) },\n      settings: { ...base.settings, ...(parsed.settings || {}) },\n      profile: { ...base.profile, ...(parsed.profile || {}) },\n      entitlements: { ...base.entitlements, ...(parsed.entitlements || {}) },\n    };\n  } catch (_) {\n    return buildWebDemoSeed();\n  }\n}\nfunction writeWebDemoState(next) {\n  try { localStorage.setItem(WEB_DEMO_STORAGE_KEY, JSON.stringify(next)); } catch (_) {}\n}\n\nfunction useAppData(uid) {'''
    if data_marker not in s:
        raise SystemExit("web-demo-v2: useAppData marker not found")
    s = s.replace(data_marker, demo_helpers, 1)

    # Start useAppData from the local seed in demo mode.
    old_state = '  const [data, setDataRaw] = useState(freshState());'
    new_state = '  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__;\n  const [data, setDataRaw] = useState(() => (demoMode ? readWebDemoState() : freshState()));'
    if old_state not in s:
        raise SystemExit("web-demo-v2: appdata state marker not found")
    s = s.replace(old_state, new_state, 1)

    # Bypass Firestore and notifications listeners entirely for the demo.
    old_effect = '''  useEffect(() => {\n    if (!uid) {\n      setLoaded(false);'''
    new_effect = '''  useEffect(() => {\n    if (demoMode) {\n      setDataRaw(readWebDemoState());\n      setLoaded(true);\n      setNotifications([]);\n      setSaveError(null);\n      setWritePending(false);\n      return undefined;\n    }\n    if (!uid) {\n      setLoaded(false);'''
    if old_effect not in s:
        raise SystemExit("web-demo-v2: appdata effect marker not found")
    s = s.replace(old_effect, new_effect, 1)

    # Add demoMode to useAppData effect dependencies.
    s = s.replace('  }, [uid]);\n\n  const setVerifiedEntitlements', '  }, [uid, demoMode]);\n\n  const setVerifiedEntitlements', 1)

    # Demo setData is local-only and works with every existing screen.
    old_setdata = '''    async (next) => {\n      if (!uid) return true;\n      const previous = data;'''
    new_setdata = '''    async (next) => {\n      if (demoMode) {\n        const updatedAt = new Date().toISOString();\n        const persisted = { ...next, updatedAt };\n        setWritePending(true);\n        setDataRaw(persisted);\n        writeWebDemoState(persisted);\n        setWritePending(false);\n        return true;\n      }\n      if (!uid) return true;\n      const previous = data;'''
    if old_setdata not in s:
        raise SystemExit("web-demo-v2: setData marker not found")
    s = s.replace(old_setdata, new_setdata, 1)
    s = s.replace('    [uid, data],\n  );', '    [uid, data, demoMode],\n  );', 1)

    # Never run live Play restore or admin lookup in demo mode.
    s = s.replace('    if (!firebaseUser || !loaded) return undefined;\n    let cancelled = false;', '    if (!firebaseUser || !loaded || (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__)) return undefined;\n    let cancelled = false;', 1)
    s = s.replace('    if (!firebaseUser) {\n      setIsAdmin(false);', '    if (!firebaseUser || (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__)) {\n      setIsAdmin(false);', 1)

    # Demo phase is always ready once the local seed is loaded.
    old_phase = '''    if (!loaded || writePending) return;\n    if (saveError) return;'''
    new_phase = '''    if (!loaded || writePending) return;\n    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {\n      setPhase("app");\n      return;\n    }\n    if (saveError) return;'''
    if old_phase in s:
        s = s.replace(old_phase, new_phase, 1)

    # Local AI Coach inside the demo so advertisements never depend on backend state.
    ai_anchor = '      const result = await generateCoachReply({'
    ai_insert = '''      if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {\n        const nextCount = (Number(data.aiUsage?.count || 0) + 1);\n        const reply = ar\n          ? "أنا AI Coach التجريبي في Fifty Fit. أقدر أساعدك في التمرين، التغذية، والسعرات. جرّب مثلاً: إزاي أزود البروتين أو أحسن تمرين الصدر؟"\n          : "I’m the Fifty Fit demo AI Coach. I can help with workouts, nutrition, calories, and progress. Try: How can I increase protein or improve my chest workout?";\n        const next = clone(data);\n        next.aiUsage = { date: today, count: nextCount };\n        setData(next);\n        setMessages((m) => [...m, { role: "assistant", content: reply }]);\n        setBusy(false);\n        return;\n      }\n      const result = await generateCoachReply({'''
    if ai_anchor not in s:
        raise SystemExit("web-demo-v2: AI anchor not found")
    s = s.replace(ai_anchor, ai_insert, 1)

    APP.write_text(s, encoding="utf-8")


def patch_tiktok():
    if not demo_enabled():
        return
    s = TIKTOK.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_TIKTOK_V2" in s:
        return
    # Keep the existing native/browser player implementation; only tag this build
    # once so the patch stays idempotent.
    s = s + "\nexport const FIFTYFIT_WEB_TIKTOK_V2 = true;\n"
    TIKTOK.write_text(s, encoding="utf-8")


def main():
    if not demo_enabled():
        print("web demo patch skipped (VITE_WEB_DEMO != 1)")
        return
    patch_main()
    patch_app()
    patch_tiktok()
    print("web demo runtime v2 applied")


if __name__ == "__main__":
    main()
