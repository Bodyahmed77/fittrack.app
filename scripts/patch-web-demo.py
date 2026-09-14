#!/usr/bin/env python3
"""Build-time web-demo adapter.

Production/native builds are a strict no-op. Demo builds inject a local
synthetic session, replace browser-incompatible native side-effect modules with
safe web shims, and expose a deterministic DOM readiness marker so CI can prove
that the real GymApp rendered instead of merely the startup shell.
"""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"
TIKTOK = ROOT / "src" / "tiktokWebView.js"
SHIM_DIR = ROOT / "src" / ".web-demo"
MARKER = "FIFTYFIT_WEB_DEMO_V8"


def enabled():
    return os.environ.get("VITE_WEB_DEMO") == "1"


SHIMS = {
    "capacitor-core.js": '''// Web-demo shim: never touches Capacitor native runtime.\nexport const Capacitor = {\n  isNativePlatform: () => false,\n  getPlatform: () => "web",\n  isPluginAvailable: () => false,\n};\n\nexport const CapacitorHttp = {\n  request: async () => {\n    throw new Error("CapacitorHttp is unavailable in the web demo");\n  },\n};\n\nexport function registerPlugin(name) {\n  return new Proxy({}, {\n    get(_target, property) {\n      if (property === "addListener") {\n        return async () => ({ remove() {} });\n      }\n      if (property === "removeAllListeners") {\n        return async () => {};\n      }\n      if (property === "exitApp") {\n        return async () => {};\n      }\n      return async () => ({ plugin: name, method: String(property) });\n    },\n  });\n}\n''',
    "capacitor-app.js": '''// Web-demo shim for @capacitor/app\nexport const App = {\n  addListener: async () => ({ remove() {} }),\n  exitApp: async () => {},\n};\n''',
    "capacitor-keyboard.js": '''// Web-demo shim for @capacitor/keyboard\nexport const Keyboard = {\n  addListener: async () => ({ remove() {} }),\n  removeAllListeners: async () => {},\n};\n''',
    "capacitor-local-notifications.js": '''// Web-demo shim for @capacitor/local-notifications\nexport const LocalNotifications = {\n  cancel: async () => {},\n  schedule: async () => {},\n  createChannel: async () => {},\n  checkPermissions: async () => ({ display: "denied" }),\n  requestPermissions: async () => ({ display: "denied" }),\n  addListener: async () => ({ remove() {} }),\n};\n''',
    "billing.js": '''// Web-demo billing adapter. Real Google Play Billing is Android-only.\nexport async function queryProducts() {\n  return { preview: true, unsupported: true, products: [] };\n}\n\nexport async function purchase() {\n  const error = new Error("Google Play Billing is available in the Android app only");\n  error.code = "web_demo_billing_unsupported";\n  return { success: false, preview: true, unsupported: true, error };\n}\n\nexport async function restorePurchases() {\n  return { restoredPlans: [], purchases: [], preview: true, unsupported: true };\n}\n''',
    "registerPurchase.js": '''// Web-demo entitlement adapter: no production account or purchase is touched.\nexport async function registerServerEntitlement() {\n  return { ok: true, preview: true, verified: false };\n}\n''',
    "review.js": '''// Web-demo adapter for native in-app review.\nexport async function requestReview() { return { ok: true, preview: true }; }\nexport async function maybeRequestReview() { return { ok: true, preview: true }; }\nexport function recordMeaningfulWorkout() {}\n''',
    "googleAuth.js": '''// Web-demo adapter: the demo is already signed in with a synthetic user.\nexport function subscribeGoogleAuthSettled() { return () => {}; }\nexport async function signInWithGoogleFlow() {\n  const error = new Error("Google Sign-In is disabled in the public web demo");\n  error.code = "web_demo_auth_disabled";\n  throw error;\n}\nexport async function reauthenticateWithGoogleFlow() {\n  const error = new Error("Google re-authentication is disabled in the public web demo");\n  error.code = "web_demo_auth_disabled";\n  throw error;\n}\n''',
    "aiCoach.js": '''// Web-demo AI adapter: keep the real UI usable without a real Firebase user or backend call.\nconst FREE_LIMIT = 5;\nconst PRO_LIMIT = 30;\n\nexport function aiUsageToday(data, todayISO) {\n  const hasPro = !!data?.entitlements?.aiCoachPro;\n  const limit = hasPro ? PRO_LIMIT : FREE_LIMIT;\n  const usage = data?.aiUsage || {};\n  const used = usage.date === todayISO && Number.isFinite(Number(usage.count)) ? Number(usage.count) : 0;\n  return { used, limit, remaining: Math.max(0, limit - used), date: todayISO, hasPro };\n}\n\nexport function aiDailyLimit(hasAiPro) {\n  return hasAiPro ? PRO_LIMIT : FREE_LIMIT;\n}\n\nexport async function generateCoachReply({ messages, lang, localDate, hasAiPro }) {\n  const reply = lang === "ar"\n    ? "أنا وضع تجريبي لـ Fifty Fit. جرّب التنقل بين التمرين، التغذية، التقدم والبروفايل — كل التغييرات محفوظة داخل المتصفح فقط."\n    : "I’m the Fifty Fit demo coach. Explore Workouts, Nutrition, Progress, and Profile — changes stay inside this browser only.";\n  const used = Math.max(0, Array.isArray(messages) ? messages.filter((m) => m?.role === "user").length : 0);\n  const limit = hasAiPro ? PRO_LIMIT : FREE_LIMIT;\n  return {\n    reply,\n    usage: { date: localDate || new Date().toISOString().slice(0, 10), used: Math.min(used + 1, limit), limit, remaining: Math.max(0, limit - used - 1), hasPro: !!hasAiPro },\n  };\n}\n''',
    "deleteAccount.js": '''// Web-demo adapter: never deletes a real Firebase account.\nexport async function deleteAccountServerData() {\n  return { success: true, preview: true };\n}\n''',
}


def write_shims():
    SHIM_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in SHIMS.items():
        (SHIM_DIR / name).write_text(content, encoding="utf-8")


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    # Replace native keyboard import before any executable code runs.
    s = s.replace(
        'import { Keyboard } from "@capacitor/keyboard";',
        'import { Keyboard } from "./.web-demo/capacitor-keyboard.js";',
        1,
    )

    demo_block = '''/* FIFTYFIT_WEB_DEMO_V8 */
const FIFTYFIT_WEB_DEMO_MODE = typeof window !== "undefined" &&
  (import.meta.env?.VITE_WEB_DEMO === "1" || new URLSearchParams(window.location.search).get("demo") === "1");
if (FIFTYFIT_WEB_DEMO_MODE) {
  window.__FIFTYFIT_DEMO_MODE__ = true;
  document.documentElement.classList.add("fiftyfit-web-demo");
  document.documentElement.setAttribute("data-fiftyfit-demo-mode", "1");
  document.documentElement.style.overflowX = "hidden";
  if (document.body) {
    document.body.style.overflowX = "hidden";
    document.body.style.width = "100%";
  }
  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const key = "fiftyfit:web-demo:v8";
  try {
    for (const oldKey of ["fiftyfit:web-demo:v3", "fiftyfit:web-demo:v4", "fiftyfit:web-demo:v5", "fiftyfit:web-demo:v6", "fiftyfit:web-demo:v7"]) {
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
    anchor = 'async function applySystemBarColors(dark = true) {'
    if anchor not in s:
        raise SystemExit("web-demo-v8: main anchor not found")
    s = s.replace(anchor, demo_block + anchor, 1)

    # No native status bar work is needed in a browser.
    s = s.replace(
        'async function applySystemBarColors(dark = true) {\n  try {',
        'async function applySystemBarColors(dark = true) {\n  if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) return;\n  try {',
        1,
    )

    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    # Browser-only adapters. The React UI itself remains untouched.
    replacements = {
        'import { registerPlugin } from "@capacitor/core";': 'import { registerPlugin } from "./.web-demo/capacitor-core.js";',
        'import { App as CapApp } from "@capacitor/app";': 'import { App as CapApp } from "./.web-demo/capacitor-app.js";',
        'import { LocalNotifications } from "@capacitor/local-notifications";': 'import { LocalNotifications } from "./.web-demo/capacitor-local-notifications.js";',
        'from "./billing";': 'from "./.web-demo/billing.js";',
        'from "./registerPurchase";': 'from "./.web-demo/registerPurchase.js";',
        'from "./review";': 'from "./.web-demo/review.js";',
        'from "./googleAuth";': 'from "./.web-demo/googleAuth.js";',
        'from "./aiCoach";': 'from "./.web-demo/aiCoach.js";',
        'from "./deleteAccount";': 'from "./.web-demo/deleteAccount.js";',
    }
    for old, new in replacements.items():
        if old in s:
            s = s.replace(old, new, 1)

    auth_marker = 'function useFirebaseSession() {'
    auth_replacement = '''function useFirebaseSession() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
    return { uid: "web-demo", email: "demo@fiftyfit.app", isWebDemo: true, providerData: [] };
  }'''
    if auth_marker not in s:
        raise SystemExit("web-demo-v8: session marker not found")
    s = s.replace(auth_marker, auth_replacement, 1)

    data_ref = 'function useAppData(uid) {'
    if data_ref not in s:
        raise SystemExit("web-demo-v8: app data marker not found")
    start = s.index(data_ref)
    effect = s.find('\n  useEffect(() => {', start)
    if effect < 0:
        raise SystemExit("web-demo-v8: app data effect not found")
    demo_prelude = '''function useAppData(uid) {
  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;
  const [data, setDataRaw] = useState(() => {
    if (!demoMode) return freshState();
    try {
      const raw = localStorage.getItem("fiftyfit:web-demo:v8");
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
        raise SystemExit("web-demo-v8: app data effect gate not found")
    s = s.replace(gate, gate2, 1)
    s = s.replace('  }, [uid]);\n\n  const setVerifiedEntitlements', '  }, [uid, demoMode]);\n\n  const setVerifiedEntitlements', 1)

    setdata = '    async (next) => {\n      if (!uid) return true;\n      const previous = data;'
    setdata2 = '''    async (next) => {
      if (demoMode) {
        const clean = { ...next, isWebDemoSeed: true, updatedAt: new Date().toISOString() };
        setDataRaw(clean);
        try { localStorage.setItem("fiftyfit:web-demo:v8", JSON.stringify(clean)); } catch (_) {}
        return true;
      }
      if (!uid) return true;
      const previous = data;'''
    if setdata not in s:
        raise SystemExit("web-demo-v8: setData marker not found")
    s = s.replace(setdata, setdata2, 1)
    s = s.replace('    [uid, data],\n  );', '    [uid, data, demoMode],\n  );', 1)

    billing_gate = '    if (!firebaseUser || !loaded) return undefined;\n    let cancelled = false;'
    if billing_gate in s:
        s = s.replace(billing_gate, '    if (demoMode || !firebaseUser || !loaded) return undefined;\n    let cancelled = false;', 1)

    root_marker = 'export default function GymApp() {\n  const [online, setOnline] = useNetworkStatus();'
    root_replacement = '''export default function GymApp() {
  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;
  const [online, setOnline] = useNetworkStatus();'''
    if root_marker not in s:
        raise SystemExit("web-demo-v8: root marker not found")
    s = s.replace(root_marker, root_replacement, 1)

    admin_gate = '''  useEffect(() => {
    if (!firebaseUser) {'''
    if admin_gate not in s:
        raise SystemExit("web-demo-v8: admin effect marker not found")
    s = s.replace(admin_gate, '''  useEffect(() => {
    if (demoMode || !firebaseUser) {''', 1)
    s = s.replace('  }, [firebaseUser]);\n\n  useEffect(() => {\n    if (demoMode || !firebaseUser || !loaded)', '  }, [firebaseUser, demoMode]);\n\n  useEffect(() => {\n    if (demoMode || !firebaseUser || !loaded)', 1)

    phase_marker = '''  useEffect(() => {
    if (!localLang && !savedLanguage) {'''
    if phase_marker not in s:
        raise SystemExit("web-demo-v8: phase effect marker not found")
    s = s.replace(phase_marker, '''  useEffect(() => {
    if (demoMode) {
      setPhase("app");
      return;
    }
    if (!localLang && !savedLanguage) {''', 1)
    s = s.replace('  }, [firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]);', '  }, [demoMode, firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]);', 1)

    # This is the key CI/browser readiness signal. StartupShell and Suspense do NOT set it.
    marker_anchor = '  const [localLang, setLocalLang] = useState(readStoredLanguage);\n'
    marker_insert = '''  const [localLang, setLocalLang] = useState(readStoredLanguage);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (demoMode && phase === "app") {
      document.documentElement.setAttribute("data-fiftyfit-demo-ready", "1");
    } else {
      document.documentElement.removeAttribute("data-fiftyfit-demo-ready");
    }
    return () => document.documentElement.removeAttribute("data-fiftyfit-demo-ready");
  }, [demoMode, phase]);
'''
    if marker_anchor not in s:
        raise SystemExit("web-demo-v8: readiness anchor not found")
    s = s.replace(marker_anchor, marker_insert, 1)

    back_marker = '''  useEffect(() => {
    let listenerHandle;
    CapApp.addListener("backButton", () => {'''
    if back_marker in s:
        s = s.replace(back_marker, '''  useEffect(() => {
    if (demoMode) return undefined;
    let listenerHandle;
    CapApp.addListener("backButton", () => {''', 1)
    s = s.replace('  }, [phase, screen, navHistory, confirmLogoutOpen, aiDrawerOpen]); // eslint-disable-line', '  }, [demoMode, phase, screen, navHistory, confirmLogoutOpen, aiDrawerOpen]); // eslint-disable-line', 1)

    logout_marker = '''  const doLogout = async () => {
    try {
      await signOut(auth);'''
    if logout_marker in s:
        s = s.replace(logout_marker, '''  const doLogout = async () => {
    if (demoMode) {
      setConfirmLogoutOpen(false);
      showToast(lang === "ar" ? "الوضع التجريبي لا يسجل خروجًا" : "Web Demo stays signed in");
      return;
    }
    try {
      await signOut(auth);''', 1)

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
    write_shims()
    patch_main()
    patch_app()
    patch_tiktok()
    print("web demo v8 applied")


if __name__ == "__main__":
    main()
