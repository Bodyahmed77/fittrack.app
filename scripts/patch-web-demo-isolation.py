#!/usr/bin/env python3
from pathlib import Path
import os
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")
MARKER = "FIFTYFIT_WEB_DEMO_ISOLATION_V1"


def demo_enabled():
    return os.environ.get("VITE_WEB_DEMO") == "1"


def patch_main():
    if not demo_enabled():
        return
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return
    pattern = re.compile(
        r"/\* FIFTYFIT_WEB_DEMO_V[123] \*/.*?(?=const App = React\.lazy\(\(\) => import\(\"\./App\.jsx\"\)\);)",
        re.S,
    )
    replacement = '''/* FIFTYFIT_WEB_DEMO_V3 */
const FIFTYFIT_WEB_DEMO_MODE = typeof window !== "undefined" &&
  (import.meta.env?.VITE_WEB_DEMO === "1" || new URLSearchParams(window.location.search).get("demo") === "1");
if (FIFTYFIT_WEB_DEMO_MODE) {
  window.__FIFTYFIT_DEMO_MODE__ = true;
  document.documentElement.classList.add("fiftyfit-web-demo");
  document.documentElement.style.overflowX = "hidden";
  if (document.body) {
    document.body.style.overflowX = "hidden";
    document.body.style.width = "100%";
  }
  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const key = "fiftyfit:web-demo:v1";
  const seed = {
    onboarded: true,
    workoutStartDate: todayDate,
    account: {
      name: "Demo Athlete", email: "demo@fiftyfit.app", phone: "+20 100 000 0000",
      gender: "Male", age: 25, height: 175, weight: 72, goal: "muscle",
      daysPerWeek: 4, trainingDays: 4, activityLevel: "moderate", photo: "",
    },
    settings: { theme: "dark", notifications: false, reminderTime: "18:00", language: "en" },
    profile: { level: 3, xp: 260, xpMax: 500 },
    entitlements: { nutritionPro: false, trainingPro: false, aiCoachPro: false, proExpiresAt: null },
    dailyTargets: { calories: 3000, kcal: 3000, protein: 150, carbs: 412.5, fat: 83.3, macroMode: "custom" },
    activePlanId: "five_day", customPlan: {}, customTrainingPlan: null,
    customTrainingPlanActive: false, customNutritionPlan: null,
    bodyWeight: [{ id: `${todayDate}-morning-72`, weight: 72, date: todayDate, time: "08:00" }],
    aiUsage: { date: todayDate, count: 0 }, logs: {}, meals: {},
    isWebDemoSeed: true, updatedAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(key);
    window.__FIFTYFIT_DEMO_INITIAL__ = raw ? JSON.parse(raw) : seed;
  } catch (_) {
    window.__FIFTYFIT_DEMO_INITIAL__ = seed;
  }
}

'''
    if not pattern.search(s):
        raise SystemExit("web-demo-isolation: expected demo main block not found")
    s = pattern.sub(replacement, s, count=1)
    s = re.sub(
        r'\nconst renderApplication = .*?\nrenderApplication\(\);',
        '''
const renderApplication = () => createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <StartupGate>
      <Suspense fallback={<StartupShell />}>
        <App />
      </Suspense>
    </StartupGate>
  </ErrorBoundary>
);

renderApplication();''',
        s,
        flags=re.S,
    )
    s = s.replace('import { bootstrapDemoSession } from "./demoBootstrap";\n', '', 1)
    s = f"/* {MARKER} */\n" + s
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    if not demo_enabled():
        return
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return
    auth_marker = 'function useFirebaseSession() {'
    demo_auth = '''function useFirebaseSession() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
    return { uid: "web-demo", email: "demo@fiftyfit.app", isWebDemo: true };
  }'''
    if auth_marker not in s:
        raise SystemExit("web-demo-isolation: useFirebaseSession anchor missing")
    s = s.replace(auth_marker, demo_auth, 1)
    s = s.replace(
        '  const latestLocalWriteAtRef = useRef(null);',
        '  const latestLocalWriteAtRef = useRef(null);\n  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;',
        1,
    )
    ref_anchor = '    const ref = doc(db, "users", uid);'
    ref_replacement = '''    if (demoMode) {
      const key = "fiftyfit:web-demo:v1";
      try {
        const raw = localStorage.getItem(key);
        const seeded = raw ? JSON.parse(raw) : (window.__FIFTYFIT_DEMO_INITIAL__ || freshState());
        const base = freshState();
        const merged = {
          ...base, ...seeded,
          account: { ...base.account, ...(seeded.account || {}) },
          settings: { ...base.settings, ...(seeded.settings || {}) },
          profile: { ...base.profile, ...(seeded.profile || {}) },
          entitlements: { ...base.entitlements, ...(seeded.entitlements || {}) },
        };
        setDataRaw(merged);
        setLoaded(true);
        setNotifications([]);
        setSaveError(null);
        setWritePending(false);
        try { localStorage.setItem(key, JSON.stringify(merged)); } catch (_) {}
      } catch (error) {
        console.error("[Fifty Fit Demo] local data hydration failed", error);
        setDataRaw(window.__FIFTYFIT_DEMO_INITIAL__ || freshState());
        setLoaded(true);
        setNotifications([]);
        setSaveError(null);
        setWritePending(false);
      }
      return undefined;
    }

    const ref = doc(db, "users", uid);'''
    if ref_anchor not in s:
        raise SystemExit("web-demo-isolation: Firestore listener anchor missing")
    s = s.replace(ref_anchor, ref_replacement, 1)
    setdata_anchor = '    async (next) => {\n      if (!uid) return true;'
    setdata_replacement = '''    async (next) => {
      if (demoMode) {
        const clean = { ...next, isWebDemoSeed: true, updatedAt: new Date().toISOString() };
        setDataRaw(clean);
        try { localStorage.setItem("fiftyfit:web-demo:v1", JSON.stringify(clean)); } catch (_) {}
        return true;
      }
      if (!uid) return true;'''
    if setdata_anchor not in s:
        raise SystemExit("web-demo-isolation: setData anchor missing")
    s = s.replace(setdata_anchor, setdata_replacement, 1)
    s = f"/* {MARKER} */\n" + s
    APP.write_text(s, encoding="utf-8")


def main():
    if not demo_enabled():
        print("web demo isolation skipped (VITE_WEB_DEMO != 1)")
        return
    patch_main()
    patch_app()
    print("web demo isolation patch applied")

if __name__ == "__main__":
    main()
