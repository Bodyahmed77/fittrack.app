#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
AUTH = ROOT / "src" / "googleAuth.js"
MARKER = "// FIFTYFIT_RELEASE_REPAIR_V2"


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def repair_app():
    text = APP.read_text(encoding="utf-8")
    if MARKER in text:
        return

    helpers = r"""// FIFTYFIT_RELEASE_REPAIR_V2
const WRITE_WATERMARK_PREFIX = "fiftyfit:write-watermark:";
function writeWatermarkKey(uid) { return `${WRITE_WATERMARK_PREFIX}${uid}`; }
function readWriteWatermark(uid) {
  try { return localStorage.getItem(writeWatermarkKey(uid)) || ""; } catch (_) { return ""; }
}
function persistWriteWatermark(uid, iso) {
  try { localStorage.setItem(writeWatermarkKey(uid), iso); } catch (_) {}
}
function newerIso(a, b) { if (!a) return b || ""; if (!b) return a; return a >= b ? a : b; }

"""
    text = once(text, "function useAppData(uid) {", helpers + "function useAppData(uid) {", "insert watermark helpers")

    text = once(
        text,
        "  const [loaded, setLoaded] = useState(false);\n  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);",
        "  const [loaded, setLoaded] = useState(false);\n  const [writePending, setWritePending] = useState(false);\n  const [saveError, setSaveError] = useState(null);\n  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);",
        "add write state",
    )

    text = once(
        text,
        "    setLoaded(false);\n    const ref = doc(db, \"users\", uid);",
        "    setLoaded(false);\n    setSaveError(null);\n    latestLocalWriteAtRef.current = readWriteWatermark(uid) || null;\n    const ref = doc(db, \"users\", uid);",
        "seed watermark",
    )

    old_guard = """        const snapUpdatedAt = String(parsed.updatedAt || "");
        const latestLocalWriteAt = String(latestLocalWriteAtRef.current || "");
        if (latestLocalWriteAt) {
          // A snapshot without updatedAt is the cached/initial Firestore
          // document and must never overwrite a newer local write.
          if (!snapUpdatedAt || snapUpdatedAt < latestLocalWriteAt) return;
          // This snapshot contains our write (or something newer), so the
          // pending-write guard can be cleared safely.
          latestLocalWriteAtRef.current = null;
        }
"""
    new_guard = """        const snapUpdatedAt = String(parsed.updatedAt || "");
        const latestLocalWriteAt = String(latestLocalWriteAtRef.current || "");
        if (latestLocalWriteAt && (!snapUpdatedAt || snapUpdatedAt < latestLocalWriteAt)) {
          console.warn("[firestore] rejected stale/undated user snapshot", {
            uid,
            snapUpdatedAt: snapUpdatedAt || null,
            watermark: latestLocalWriteAt,
          });
          return;
        }
        if (snapUpdatedAt) {
          const newest = newerIso(latestLocalWriteAt, snapUpdatedAt);
          latestLocalWriteAtRef.current = newest || null;
          if (newest) persistWriteWatermark(uid, newest);
        }
"""
    text = once(text, old_guard, new_guard, "snapshot guard")

    old_setdata = """  const setData = useCallback(
    async (next) => {
      verifiedEntitlementsRef.current = next.entitlements;
      setDataRaw(next);
      if (!uid) return true;
      try {
        const persisted = Object.fromEntries(
          Object.entries(next).filter(
            ([key]) =>
              key !== "entitlements" &&
              key !== "customTrainingPlan" &&
              key !== "customNutritionPlan",
          ),
        );
        const updatedAt = new Date().toISOString();
        latestLocalWriteAtRef.current = updatedAt;
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt },
          { merge: true },
        );
        return true;
      } catch (e) {
        console.error("save failed", e);
        return false;
      }
    },
    [uid],
  );
"""
    new_setdata = """  const setData = useCallback(
    async (next) => {
      if (!uid) return true;
      const previous = data;
      const updatedAt = new Date().toISOString();
      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "entitlements" &&
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );
      verifiedEntitlementsRef.current = next.entitlements;
      setSaveError(null);
      setWritePending(true);
      setDataRaw({ ...next, updatedAt });
      latestLocalWriteAtRef.current = newerIso(latestLocalWriteAtRef.current, updatedAt);
      persistWriteWatermark(uid, latestLocalWriteAtRef.current);
      try {
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt },
          { merge: true },
        );
        return true;
      } catch (e) {
        console.error("save failed", e);
        setDataRaw(previous);
        setSaveError(e);
        return false;
      } finally {
        setWritePending(false);
      }
    },
    [uid, data],
  );
"""
    text = once(text, old_setdata, new_setdata, "setData")

    text = once(
        text,
        '  return { data, setData, setVerifiedEntitlements, loaded, notifications };',
        '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError };',
        "useAppData return",
    )

    text = once(
        text,
        '      initial.createdAt = new Date().toISOString();\n      await setDoc(doc(db, "users", cred.user.uid), initial);',
        '      const createdAt = new Date().toISOString();\n      initial.createdAt = createdAt;\n      initial.updatedAt = createdAt;\n      persistWriteWatermark(cred.user.uid, createdAt);\n      await setDoc(doc(db, "users", cred.user.uid), initial);',
        "signup write",
    )

    old_finish = '''  const finish = async () => {\n    const next = clone(data);'''
    new_finish = '''  const finish = async () => {\n    setErr("");\n    const uid = auth.currentUser?.uid;\n    if (!uid) {\n      setErr(ar ? "الجلسة انتهت — سجل دخولك مرة تانية" : "Your session expired — please sign in again");\n      return;\n    }\n    let base;\n    try {\n      const snap = await getDoc(doc(db, "users", uid));\n      if (!snap.exists()) throw new Error("User profile document does not exist");\n      base = { ...freshState(), ...snap.data() };\n    } catch (e) {\n      console.error("[onboarding] authoritative Firestore read failed", e);\n      setErr(ar ? "تعذر قراءة بياناتك المحفوظة — حاول تاني" : "Couldn’t read your saved profile — please try again");\n      return;\n    }\n    const next = clone(base);'''
    text = once(text, old_finish, new_finish, "onboarding finish start")

    bad_lang = '''    next.settings = { ...next.settings, language: next.settings.language || ar && "ar" || "en" };\n    next.settings = { ...next.settings, language: next.settings.language || ar && "ar" || "en" };'''
    good_lang = '''    next.settings = { ...next.settings, language: ar ? "ar" : "en" };'''
    if bad_lang in text:
        text = text.replace(bad_lang, good_lang, 1)
    elif good_lang not in text:
        raise SystemExit("onboarding language lines not found")

    old_root = '''  const { data, setData, setVerifiedEntitlements, loaded } = useAppData(\n    firebaseUser?.uid,\n  );'''
    new_root = '''  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(\n    firebaseUser?.uid,\n  );'''
    text = once(text, old_root, new_root, "root hook destructure")

    old_route = '''  useEffect(() => {\n    if (!localLang && !savedLanguage) {\n      setPhase("language");\n      return;\n    }\n    if (firebaseUser === undefined) return; // Firebase hasn't reported yet — stay on splash\n    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (!loaded) return; // signed in, waiting on their Firestore document to load\n    if (data.onboarded) {\n      setPhase("app");\n      return;\n    }\n    // New Google users must provide a phone before the normal onboarding flow.\n    setPhase("onboarding");\n  }, [firebaseUser, loaded, localLang, savedLanguage, data.onboarded]); // eslint-disable-line\n'''
    new_route = '''  useEffect(() => {\n    if (!localLang && !savedLanguage) {\n      setPhase("language");\n      return;\n    }\n    if (firebaseUser === undefined) return;\n    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (!loaded || writePending) return;\n    if (saveError) return;\n    if (data.onboarded) {\n      setPhase("app");\n      return;\n    }\n    setPhase("onboarding");\n  }, [firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]); // eslint-disable-line\n'''
    text = once(text, old_route, new_route, "root routing effect")

    text = text.replace("await setDoc(result.ref, next);", "await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });")
    text = text.replace("{ nutritionPlanRequestedAt:new Date().toISOString(), nutritionPlanRequestStatus:'pending' }, {merge:true}", "{ nutritionPlanRequestedAt:new Date().toISOString(), nutritionPlanRequestStatus:'pending', updatedAt:new Date().toISOString() }, {merge:true}")
    text = text.replace("{customNutritionLog:next},{merge:true}", "{customNutritionLog:next, updatedAt:new Date().toISOString()},{merge:true}")

    APP.write_text(text, encoding="utf-8")


def repair_google_auth():
    text = AUTH.read_text(encoding="utf-8")
    old = '''    if (isNoCredentialError(mapped)) {\n      try {\n        console.warn(\n          "[GoogleSignIn] Credential Manager returned no credentials; retrying with legacy Google Sign-In chooser",\n        );\n        usedCredentialManager = false;\n        result = await runNativeGoogleSignIn(Boolean(0));\n      } catch (fallbackError) {'''
    new = '''    if (isNoCredentialError(mapped) || mapped?.googleStatusCode === "10" || mapped?.code === "developer_error") {\n      try {\n        console.warn(\n          "[GoogleSignIn] modern native flow did not complete; retrying with legacy Google Sign-In chooser",\n          mapped?.googleStatusCode || mapped?.code || "unknown",\n        );\n        usedCredentialManager = false;\n        result = await runNativeGoogleSignIn(false);\n      } catch (fallbackError) {'''
    text = once(text, old, new, "Google auth fallback")
    AUTH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    repair_app()
    repair_google_auth()
    print("Release repair source transformations applied successfully")
