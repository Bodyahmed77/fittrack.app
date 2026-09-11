#!/usr/bin/env python3
"""Build-time web-demo adapter.

Production/native builds are a strict no-op. Demo builds inject a local synthetic
session so the public web demo never touches real Firebase accounts, Play Billing,
or production entitlements.
"""
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"
TIKTOK = ROOT / "src" / "tiktokWebView.js"
MARKER = "FIFTYFIT_WEB_DEMO_V5"


def enabled():
    return os.environ.get("VITE_WEB_DEMO") == "1"


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    demo_block = '''/* FIFTYFIT_WEB_DEMO_V5 */
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
  const key = "fiftyfit:web-demo:v5";
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
    window.__FIFTYFIT_DEMO_INITIAL__ = raw ? JSON.parse(raw) : seed;
  } catch (_) {
    window.__FIFTYFIT_DEMO_INITIAL__ = seed;
  }
}

'''
    app_import = 'const App = React.lazy(() => import("./App.jsx"));'
    if app_import not in s:
        raise SystemExit("web-demo-v5: App import marker not found")
    s = s.replace(app_import, demo_block + app_import, 1)
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    auth_marker = 'function useFirebaseSession() {'
    auth_replacement = '''function useFirebaseSession() {
  if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
    return { uid: "web-demo", email: "demo@fiftyfit.app", isWebDemo: true, providerData: [] };
  }'''
    if auth_marker not in s:
        raise SystemExit("web-demo-v5: session marker not found")
    s = s.replace(auth_marker, auth_replacement, 1)

    # Demo still reuses the canonical Firestore hook, but short-circuits before
    # any listener/network call and persists only to browser localStorage.
    data_ref = 'function useAppData(uid) {'
    if data_ref not in s:
        raise SystemExit("web-demo-v5: app data marker not found")
    start = s.index(data_ref)
    effect = s.find('\n  useEffect(() => {', start)
    if effect < 0:
        raise SystemExit("web-demo-v5: app data effect not found")
    demo_prelude = '''function useAppData(uid) {
  const demoMode = typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;
  const [data, setDataRaw] = useState(() => {
    if (!demoMode) return freshState();
    try {
      const raw = localStorage.getItem("fiftyfit:web-demo:v5");
      const seed = raw ? JSON.parse(raw) : (window.__FIFTYFIT_DEMO_INITIAL__ || freshState());
      const base = freshState();
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
        raise SystemExit("web-demo-v5: app data effect gate not found")
    s = s.replace(gate, gate2, 1)
    s = s.replace('  }, [uid]);\n\n  const setVerifiedEntitlements', '  }, [uid, demoMode]);\n\n  const setVerifiedEntitlements', 1)

    setdata = '    async (next) => {\n      if (!uid) return true;\n      const previous = data;'
    setdata2 = '''    async (next) => {
      if (demoMode) {
        const clean = { ...next, isWebDemoSeed: true, updatedAt: new Date().toISOString() };
        setDataRaw(clean);
        try { localStorage.setItem("fiftyfit:web-demo:v5", JSON.stringify(clean)); } catch (_) {}
        return true;
      }
      if (!uid) return true;
      const previous = data;'''
    if setdata not in s:
        raise SystemExit("web-demo-v5: setData marker not found")
    s = s.replace(setdata, setdata2, 1)
    s = s.replace('    [uid, data],\n  );', '    [uid, data, demoMode],\n  );', 1)

    billing_gate = '    if (!firebaseUser || !loaded) return undefined;\n    let cancelled = false;'
    billing_gate2 = '    if (!firebaseUser || !loaded || (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__)) return undefined;\n    let cancelled = false;'
    if billing_gate in s:
        s = s.replace(billing_gate, billing_gate2, 1)

    purchase_anchor = '''    setBusy(true);\n    try {\n      // 1) Try real Google Play Billing.'''
    purchase_demo = '''    setBusy(true);
    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
      try {
        const next = clone(data);
        next.entitlements = { ...(next.entitlements || {}) };
        if (planId === "training" || planId === "both") next.entitlements.trainingPro = true;
        if (planId === "nutrition" || planId === "both") next.entitlements.nutritionPro = true;
        if (planId === "ai" || planId === "both") next.entitlements.aiCoachPro = true;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        next.entitlements.proExpiresAt = expiry.toISOString();
        await setData(next);
        setSuccessModal({ kind: "demo", plan: planId, duration: durationId });
      } catch (error) {
        console.error("[Fifty Fit Demo] simulated purchase failed", error);
        showToast(ar ? "حصل خطأ في تجربة الـDemo" : "Demo action failed");
      } finally { setBusy(false); }
      return;
    }
    try {
      // 1) Try real Google Play Billing.'''
    if purchase_anchor in s:
        s = s.replace(purchase_anchor, purchase_demo, 1)

    ai_anchor = '''    setBusy(true);\n    try {\n      const result = await generateCoachReply({'''
    ai_demo = '''    setBusy(true);
    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
      try {
        const currentCount = data?.aiUsage?.date === today ? Number(data?.aiUsage?.count || 0) : 0;
        const limit = data?.entitlements?.aiCoachPro ? 50 : 3;
        if (currentCount >= limit) {
          showToast(ar ? `خلصت ${limit} رسائل الـDemo لليوم` : `Demo limit reached (${limit} messages today)`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        const q = textMsg.toLowerCase();
        const reply = /(protein|بروتين|muscle|عضل|عضلات)/i.test(q)
          ? (ar ? "لبناء العضلات، ركّز على بروتين كافٍ وتمرين مقاومة منتظم ونوم جيد. وزّع البروتين على وجباتك وسجّل تقدمك أسبوعيًا." : "For muscle gain, prioritize adequate protein, consistent resistance training, and good sleep. Spread protein across meals and track your weekly progress.")
          : /(weight|وزن|calorie|سعرات|تنشيف|cut)/i.test(q)
          ? (ar ? "لخسارة الدهون، استخدم عجز سعرات معتدل وتابع متوسط وزنك أسبوعيًا، مع الحفاظ على تمارين المقاومة والبروتين." : "For fat loss, use a moderate calorie deficit and judge progress from your weekly weight trend while keeping resistance training and adequate protein.")
          : (ar ? "أنا Demo Coach في Fifty Fit. اسألني عن التمرين، التغذية، البروتين، السعرات، أو زيادة العضلات." : "I’m the Fifty Fit Demo Coach. Ask me about training, nutrition, protein, calories, or muscle gain.");
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        const next = clone(data);
        next.aiUsage = { date: today, count: currentCount + 1 };
        await setData(next);
      } catch (error) {
        console.error("[Fifty Fit Demo] AI simulation failed", error);
        showToast(ar ? "تعذر تشغيل Demo Coach" : "Demo Coach failed to respond");
      } finally { setBusy(false); }
      return;
    }
    try {
      const result = await generateCoachReply({'''
    if ai_anchor not in s:
        raise SystemExit("web-demo-v5: AI anchor not found")
    s = s.replace(ai_anchor, ai_demo, 1)

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
    print("web demo v5 applied")

if __name__ == "__main__":
    main()
