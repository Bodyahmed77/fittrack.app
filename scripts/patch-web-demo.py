#!/usr/bin/env python3
"""Build-time web-demo adapter.

Production/native builds are a strict no-op. Demo builds inject a local synthetic
session so the public web demo never touches real Firebase accounts, Play Billing,
or production entitlements.
"""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"
TIKTOK = ROOT / "src" / "tiktokWebView.js"
MARKER = "FIFTYFIT_WEB_DEMO_V7"


def enabled():
    return os.environ.get("VITE_WEB_DEMO") == "1"


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    demo_block = '''/* FIFTYFIT_WEB_DEMO_V7 */
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
  // v7 intentionally isolates the public demo from every previous demo-state
  // schema. A bad/stale browser value must never be able to crash the app on boot.
  const key = "fiftyfit:web-demo:v7";
  try {
    for (const oldKey of ["fiftyfit:web-demo:v3", "fiftyfit:web-demo:v4", "fiftyfit:web-demo:v5", "fiftyfit:web-demo:v6"]) {
      localStorage.removeItem(oldKey);
    }
  } catch (_) {}
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
    dailyTargets: { calories: 3000, kcal: 3000, protein: 150, carbs: 412.5, fat: 83.3333333333, macroMode: "custom" },
    activePlanId: "hypertrophy", customPlan: {}, customTrainingPlan: null, customTrainingPlanActive: false, customNutritionPlan: null,
    bodyWeight: [{ id: `${todayDate}-morning-72`, weight: 72, date: todayDate, time: "08:00" }],
    aiUsage: { date: todayDate, count: 0 }, logs: {}, meals: {}, isWebDemoSeed: true,
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    window.__FIFTYFIT_DEMO_INITIAL__ = parsed && typeof parsed === "object" && parsed.account && parsed.entitlements
      ? parsed
      : seed;
  } catch (_) {
    window.__FIFTYFIT_DEMO_INITIAL__ = seed;
  }
}

'''
    app_import = 'const App = React.lazy(() => import("./App.jsx"));'
    if app_import not in s:
        raise SystemExit("web-demo-v7: App import marker not found")
    s = s.replace(app_import, demo_block + app_import, 1)
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    auth_marker = 'function useFirebaseSession() {'
    auth_replacement = '''function useFirebaseSession() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
    // Keep a synthetic signed-in identity so the real app can render all of
    // its normal in-app surfaces (including AI Coach), but never expose it to
    // auth/Firestore/native side effects below.
    return { uid: "web-demo", email: "demo@fiftyfit.app", isWebDemo: true, providerData: [] };
  }'''
    if auth_marker not in s:
        raise SystemExit("web-demo-v7: session marker not found")
    s = s.replace(auth_marker, auth_replacement, 1)

    data_ref = 'function useAppData(uid) {'
    if data_ref not in s:
        raise SystemExit("web-demo-v7: app data marker not found")
    start = s.index(data_ref)
    effect = s.find('\n  useEffect(() => {', start)
    if effect < 0:
        raise SystemExit("web-demo-v7: app data effect not found")
    demo_prelude = '''function useAppData(uid) {
  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;
  const [data, setDataRaw] = useState(() => {
    if (!demoMode) return freshState();
    try {
      const raw = localStorage.getItem("fiftyfit:web-demo:v7");
      const seed = raw ? JSON.parse(raw) : (window.__FIFTYFIT_DEMO_INITIAL__ || freshState());
      const base = freshState();
      if (!seed || typeof seed !== "object") return window.__FIFTYFIT_DEMO_INITIAL__ || base;
      return {
        ...base, ...seed,
        account: { ...base.account, ...(seed.account || {}) },
        settings: { ...base.settings, ...(seed.settings || {}) },
        profile: { ...base.profile, ...(seed.profile || {}) },
        entitlements: { ...base.entitlements, ...(seed.entitlements || {}) },
      };
    } catch (_) {
      return window.__FIFTYFIT_DEMO_INITIAL__ || freshState();
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(!!demoMode);
  const [writePending, setWritePending] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const verifiedEntitlementsRef = useRef(null);
  const latestLocalWriteAtRef = useRef(null);

'''
    s = s[:start] + demo_prelude + s[effect + 1:]

    gate = '  useEffect(() => {\n    if (!uid) {'
    gate2 = '''  useEffect(() => {
    if (demoMode) {
      setLoaded(true);
      setNotifications([]);
      setSaveError(null);
      setWritePending(false);
      return undefined;
    }
    if (!uid) {'''
    if gate not in s:
        raise SystemExit("web-demo-v7: app data effect gate not found")
    s = s.replace(gate, gate2, 1)
    s = s.replace('  }, [uid]);\n\n  const setVerifiedEntitlements', '  }, [uid, demoMode]);\n\n  const setVerifiedEntitlements', 1)

    setdata = '    async (next) => {\n      if (!uid) return true;\n      const previous = data;'
    setdata2 = '''    async (next) => {
      if (demoMode) {
        const clean = { ...next, isWebDemoSeed: true, updatedAt: new Date().toISOString() };
        setDataRaw(clean);
        try { localStorage.setItem("fiftyfit:web-demo:v7", JSON.stringify(clean)); } catch (_) {}
        return true;
      }
      if (!uid) return true;
      const previous = data;'''
    if setdata not in s:
        raise SystemExit("web-demo-v7: setData marker not found")
    s = s.replace(setdata, setdata2, 1)
    s = s.replace('    [uid, data],\n  );', '    [uid, data, demoMode],\n  );', 1)

    billing_gate = '    if (!firebaseUser || !loaded) return undefined;\n    let cancelled = false;'
    billing_gate2 = '    if (demoMode || !firebaseUser || !loaded) return undefined;\n    let cancelled = false;'
    if billing_gate in s:
        s = s.replace(billing_gate, billing_gate2, 1)

    root_marker = 'export default function GymApp() {\n  const [online, setOnline] = useNetworkStatus();'
    root_replacement = '''export default function GymApp() {
  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;
  const [online, setOnline] = useNetworkStatus();'''
    if root_marker not in s:
        raise SystemExit("web-demo-v7: root marker not found")
    s = s.replace(root_marker, root_replacement, 1)

    admin_gate = '''  useEffect(() => {
    if (!firebaseUser) {'''
    admin_gate2 = '''  useEffect(() => {
    if (demoMode || !firebaseUser) {'''
    if admin_gate not in s:
        raise SystemExit("web-demo-v7: admin effect marker not found")
    s = s.replace(admin_gate, admin_gate2, 1)
    s = s.replace('  }, [firebaseUser]);\n\n  useEffect(() => {\n    if (demoMode || !firebaseUser || !loaded)', '  }, [firebaseUser, demoMode]);\n\n  useEffect(() => {\n    if (demoMode || !firebaseUser || !loaded)', 1)

    phase_marker = '''  useEffect(() => {
    if (!localLang && !savedLanguage) {'''
    phase_replacement = '''  useEffect(() => {
    if (demoMode) {
      setPhase("app");
      return;
    }
    if (!localLang && !savedLanguage) {'''
    if phase_marker not in s:
        raise SystemExit("web-demo-v7: phase effect marker not found")
    s = s.replace(phase_marker, phase_replacement, 1)
    s = s.replace('  }, [firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]);', '  }, [demoMode, firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]);', 1)

    back_marker = '''  useEffect(() => {
    let listenerHandle;
    CapApp.addListener("backButton", () => {'''
    back_replacement = '''  useEffect(() => {
    if (demoMode) return undefined;
    let listenerHandle;
    CapApp.addListener("backButton", () => {'''
    if back_marker not in s:
        raise SystemExit("web-demo-v7: back-button effect marker not found")
    s = s.replace(back_marker, back_replacement, 1)
    s = s.replace('  }, [phase, screen, navHistory, confirmLogoutOpen, aiDrawerOpen]); // eslint-disable-line', '  }, [demoMode, phase, screen, navHistory, confirmLogoutOpen, aiDrawerOpen]); // eslint-disable-line', 1)

    logout_marker = '''  const doLogout = async () => {
    try {
      await signOut(auth);'''
    logout_replacement = '''  const doLogout = async () => {
    if (demoMode) {
      setConfirmLogoutOpen(false);
      setToast("");
      showToast(lang === "ar" ? "الوضع التجريبي لا يسجل خروجًا" : "Web Demo stays signed in");
      return;
    }
    try {
      await signOut(auth);'''
    if logout_marker in s:
        s = s.replace(logout_marker, logout_replacement, 1)

    s = f"/* {MARKER} */\n" + s
    APP.write_text(s, encoding="utf-8")


def patch_tiktok():
    if TIKTOK.exists():
        s = TIKTOK.read_text(encoding="utf-8")
        if MARKER not in s:
            TIKTOK.write_text(s + f"\n/* {MARKER} */\n", encoding="utf-8")


def main():
    if not enabled():
        print("web demo patch skipped (VITE_WEB_DEMO != 1)")
        return
    patch_main()
    patch_app()
    patch_tiktok()
    print("web demo v7 applied")

if __name__ == "__main__":
    main()
