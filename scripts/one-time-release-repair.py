#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
AUTH = ROOT / "src" / "googleAuth.js"
MARKER = "// FIFTYFIT_RELEASE_REPAIR_V2"


def replace_between(text, start_marker, end_marker, replacement):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"Missing start marker: {start_marker}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"Missing end marker: {end_marker}")
    return text[:start] + replacement + text[end:]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one occurrence for {label}; found {count}")
    return text.replace(old, new)


def repair_app():
    text = APP.read_text(encoding="utf-8")
    if MARKER in text:
        return

    use_app_data = r'''// FIFTYFIT_RELEASE_REPAIR_V2
const WRITE_WATERMARK_PREFIX = "fiftyfit:write-watermark:";

function writeWatermarkKey(uid) {
  return `${WRITE_WATERMARK_PREFIX}${uid}`;
}

function readWriteWatermark(uid) {
  try {
    return localStorage.getItem(writeWatermarkKey(uid)) || "";
  } catch (_) {
    return "";
  }
}

function persistWriteWatermark(uid, iso) {
  try {
    localStorage.setItem(writeWatermarkKey(uid), iso);
  } catch (_) {
    /* best effort */
  }
}

function newerIso(a, b) {
  if (!a) return b || "";
  if (!b) return a;
  return a >= b ? a : b;
}

function useAppData(uid) {
  const [data, setDataRaw] = useState(freshState());
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [writePending, setWritePending] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const verifiedEntitlementsRef = useRef(null);
  const latestAcceptedWriteAtRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      setLoaded(false);
      setNotifications([]);
      setWritePending(false);
      setSaveError(null);
      verifiedEntitlementsRef.current = null;
      return;
    }
    setLoaded(false);
    setSaveError(null);
    latestAcceptedWriteAtRef.current = readWriteWatermark(uid) || null;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const fresh = freshState();
        const parsed = snap.exists() ? snap.data() : {};
        const incoming = String(parsed.updatedAt || "");
        const known = String(latestAcceptedWriteAtRef.current || "");

        if (known && (!incoming || incoming < known)) {
          console.warn("[firestore] rejected stale user snapshot", {
            uid,
            incoming: incoming || null,
            known,
          });
          return;
        }

        if (incoming) {
          const newest = newerIso(known, incoming);
          latestAcceptedWriteAtRef.current = newest || null;
          if (newest) persistWriteWatermark(uid, newest);
        }

        const merged = {
          ...fresh,
          ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },
          customPlan: parsed.customPlan || {},
          customTrainingPlan: parsed.customTrainingPlan || null,
          customTrainingPlanActive: parsed.customTrainingPlanActive === true,
          customNutritionPlan: parsed.customNutritionPlan || null,
        };
        setDataRaw(merged);
        setLoaded(true);
      },
      (err) => {
        console.error("Firestore read failed", err);
        setSaveError(err);
        setLoaded(true);
      },
    );

    const notificationsRef = collection(db, "users", uid, "notifications");
    const notificationSessionStartedAt = Date.now();
    const unsubNotifications = onSnapshot(notificationsRef, (notificationSnap) => {
      const history = notificationSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      setNotifications(history);

      notificationSnap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const n = change.doc.data() || {};
        const createdAtMs = Date.parse(String(n.createdAt || ""));
        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;
        LocalNotifications.schedule({ notifications: [{
          id: Math.floor(Math.random() * 900000000) + 100000000,
          title: n.title || "Fifty Fit",
          body: n.body || "You have a new update.",
          schedule: { at: new Date(Date.now() + 300) },
        }] }).catch(() => {});
      });
    });

    return () => { unsub(); unsubNotifications(); };
  }, [uid]);

  const setVerifiedEntitlements = useCallback((entitlements) => {
    verifiedEntitlementsRef.current = {
      nutritionPro: !!entitlements?.nutritionPro,
      trainingPro: !!entitlements?.trainingPro,
      aiCoachPro: !!entitlements?.aiCoachPro,
      proExpiresAt: entitlements?.proExpiresAt || null,
    };
    setDataRaw((current) => ({
      ...current,
      entitlements: verifiedEntitlementsRef.current,
    }));
  }, []);

  const setData = useCallback(
    async (next) => {
      if (!uid) return true;
      const previous = data;
      const updatedAt = new Date().toISOString();
      const nextWithMeta = { ...next, updatedAt };
      const persisted = Object.fromEntries(
        Object.entries(nextWithMeta).filter(
          ([key]) =>
            key !== "entitlements" &&
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );

      verifiedEntitlementsRef.current = next.entitlements;
      setSaveError(null);
      setWritePending(true);
      setDataRaw(nextWithMeta);
      latestAcceptedWriteAtRef.current = newerIso(
        latestAcceptedWriteAtRef.current,
        updatedAt,
      );
      persistWriteWatermark(uid, latestAcceptedWriteAtRef.current);

      try {
        await setDoc(
          doc(db, "users", uid),
          persisted,
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

  return {
    data,
    setData,
    setVerifiedEntitlements,
    loaded,
    notifications,
    writePending,
    saveError,
  };
}

'''
    text = replace_between(text, "function useAppData(uid) {", "function nutritionCycleState(", use_app_data)

    text = replace_once(
        text,
        '      initial.createdAt = new Date().toISOString();\n      await setDoc(doc(db, "users", cred.user.uid), initial);',
        '      const createdAt = new Date().toISOString();\n      initial.createdAt = createdAt;\n      initial.updatedAt = createdAt;\n      persistWriteWatermark(cred.user.uid, createdAt);\n      await setDoc(doc(db, "users", cred.user.uid), initial);',
        "email signup initial document",
    )

    finish_start = text.find("  const finish = async () => {")
    finish_end = text.find("\n  if (generating) return", finish_start)
    if finish_start < 0 or finish_end < 0:
        raise SystemExit("Onboarding finish block not found")
    finish = r'''  const finish = async () => {
    setErr("");
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setErr(ar ? "الجلسة انتهت — سجل دخولك مرة تانية" : "Your session expired — please sign in again");
      return;
    }

    let base;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) throw new Error("User profile document does not exist");
      base = { ...freshState(), ...snap.data() };
    } catch (e) {
      console.error("[onboarding] authoritative Firestore read failed", e);
      setErr(ar ? "تعذر قراءة بياناتك المحفوظة — حاول تاني" : "Couldn’t read your saved profile — please try again");
      return;
    }

    const next = clone(base);
    next.account = {
      ...next.account,
      phone: phone.trim(),
      gender,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
      goal,
      daysPerWeek: days,
      activityLevel,
    };
    next.activePlanId = "beginner";
    next.workoutStartDate = next.workoutStartDate || dateKey(0);
    next.bodyWeight = [createWeightEntry(Number(weight), dateKey(0))];
    const tdeeResult = calcTDEE({
      weight: Number(weight),
      height: Number(height),
      age: Number(age),
      gender,
      activityLevel,
      goal,
    });
    if (tdeeResult) {
      next.dailyTargets = {
        kcal: tdeeResult.target,
        protein: tdeeResult.protein,
        carbs: tdeeResult.carbs,
        fat: tdeeResult.fat,
      };
    }
    next.settings = {
      ...next.settings,
      language: ar ? "ar" : "en",
    };
    next.onboarded = true;

    console.log("[onboarding] persistence starting", { uid });
    const saved = await setData(next);
    console.log("[onboarding] persistence finished", { uid, saved });
    if (!saved) {
      setErr(ar ? "تعذر حفظ بياناتك — تحقق من الإنترنت وحاول مرة تانية" : "Couldn’t save your profile — check your connection and try again");
      return;
    }
    setGenerating(true);
  };
'''
    text = text[:finish_start] + finish + text[finish_end:]

    text = replace_once(
        text,
        '  const { data, setData, setVerifiedEntitlements, loaded } = useAppData(\n    firebaseUser?.uid,\n  );',
        '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(\n    firebaseUser?.uid,\n  );',
        "GymApp useAppData destructure",
    )

    routing_old = '''  useEffect(() => {\n    if (!localLang && !savedLanguage) {\n      setPhase("language");\n      return;\n    }\n    if (firebaseUser === undefined) return; // Firebase hasn't reported yet — stay on splash\n    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (!loaded) return; // signed in, waiting on their Firestore document to load\n    if (data.onboarded) {\n      setPhase("app");\n      return;\n    }\n    // New Google users must provide a phone before the normal onboarding flow.\n    setPhase("onboarding");\n  }, [firebaseUser, loaded, localLang, savedLanguage, data.onboarded]); // eslint-disable-line\n'''
    routing_new = '''  useEffect(() => {\n    if (!localLang && !savedLanguage) {\n      setPhase("language");\n      return;\n    }\n    if (firebaseUser === undefined) return;\n    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (!loaded || writePending) return;\n    // A failed write must not let optimistic local state route the user into\n    // the app. Keep the current screen so the user can retry the save.\n    if (saveError) return;\n    if (data.onboarded) {\n      setPhase("app");\n      return;\n    }\n    setPhase("onboarding");\n  }, [firebaseUser, loaded, writePending, saveError, localLang, savedLanguage, data.onboarded]); // eslint-disable-line\n'''
    text = replace_once(text, routing_old, routing_new, "GymApp routing effect")

    # Admin writes and nutrition request/log writes must carry updatedAt so a\n    # durable snapshot watermark cannot reject legitimate server updates.\n    text = text.replace(
        "await setDoc(result.ref, next);",
        "await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });",
    )
    text = text.replace(
        "{ nutritionPlanRequestedAt:new Date().toISOString(), nutritionPlanRequestStatus:'pending' }, {merge:true}",
        "{ nutritionPlanRequestedAt:new Date().toISOString(), nutritionPlanRequestStatus:'pending', updatedAt:new Date().toISOString() }, {merge:true}",
    )
    text = text.replace(
        "{customNutritionLog:next},{merge:true}",
        "{customNutritionLog:next, updatedAt:new Date().toISOString()},{merge:true}",
    )

    APP.write_text(text, encoding="utf-8")


def repair_google_auth():
    text = AUTH.read_text(encoding="utf-8")
    old = '''    if (isNoCredentialError(mapped)) {\n      try {\n        console.warn(\n          "[GoogleSignIn] Credential Manager returned no credentials; retrying with legacy Google Sign-In chooser",\n        );\n        usedCredentialManager = false;\n        result = await runNativeGoogleSignIn(Boolean(0));\n      } catch (fallbackError) {'''
    new = '''    if (isNoCredentialError(mapped) || mapped?.googleStatusCode === "10" || mapped?.code === "developer_error") {\n      try {\n        console.warn(\n          "[GoogleSignIn] modern native flow did not complete; retrying with legacy Google Sign-In chooser",\n          mapped?.googleStatusCode || mapped?.code || "unknown",\n        );\n        usedCredentialManager = false;\n        result = await runNativeGoogleSignIn(false);\n      } catch (fallbackError) {'''
    if old not in text:
        raise SystemExit("Expected native Google fallback block not found")
    text = text.replace(old, new, 1)
    AUTH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    repair_app()
    repair_google_auth()
    print("Release repair source transformations applied successfully")
