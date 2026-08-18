from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("src/App.jsx")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    "  const latestLocalWriteAtRef = useRef(null);\n\n  useEffect(() => {",
    "  const latestLocalWriteAtRef = useRef(null);\n  const profileExistsRef = useRef(false);\n\n  useEffect(() => {",
    "profile exists ref declaration",
)
app = replace_once(
    app,
    "      verifiedEntitlementsRef.current = null;\n      return;",
    "      verifiedEntitlementsRef.current = null;\n      profileExistsRef.current = false;\n      return;",
    "profile exists ref uid reset",
)
app = replace_once(
    app,
    "        const fresh = freshState();\n        const parsed = snap.exists() ? snap.data() : {};",
    "        const fresh = freshState();\n        profileExistsRef.current = snap.exists();\n        const parsed = snap.exists() ? snap.data() : {};",
    "profile exists ref snapshot",
)
app = replace_once(
    app,
    "        console.error(\"Firestore read failed\", err);\n        setLoaded(true);",
    "        console.error(\"Firestore read failed\", err);\n        setSaveError(err);\n        setLoaded(true);",
    "Firestore read error state",
)

old_persist = '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );
      verifiedEntitlementsRef.current = next.entitlements;'''
new_persist = '''      const persistedBase = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "entitlements" &&
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );
      const persisted = profileExistsRef.current
        ? persistedBase
        : {
            ...persistedBase,
            entitlements: {
              trainingPro: false,
              nutritionPro: false,
              aiCoachPro: false,
              proExpiresAt: null,
            },
          };
      verifiedEntitlementsRef.current = next.entitlements;'''
app = replace_once(app, old_persist, new_persist, "entitlement-safe Firestore payload")

app = replace_once(
    app,
    "        );\n        return true;\n      } catch (e) {",
    "        );\n        profileExistsRef.current = true;\n        return true;\n      } catch (e) {",
    "profile exists ref after successful write",
)

old_onboarding_read = '''    try {
      const snap = await getDoc(doc(db, "users", uid));
      base = snap.exists() ? { ...freshState(), ...snap.data() } : clone(data);
    } catch (e) {
      // getDoc is best-effort here. useAppData already has a live, Firestore-backed
      // snapshot and setData below is the authoritative persistence boundary.
      // A transient read failure must not trap a brand-new user in onboarding.
      console.warn("[onboarding] direct profile read failed; using trusted app state", e);
      base = clone(data);
    }'''
new_onboarding_read = '''    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setErr(ar ? "لم يتم العثور على ملف حسابك — حاول تسجيل الدخول مرة أخرى" : "Your profile could not be found — please sign in again");
        return;
      }
      base = { ...freshState(), ...snap.data() };
    } catch (e) {
      console.error("[onboarding] direct profile read failed", e);
      setErr(ar ? "تعذر قراءة بيانات حسابك — حاول مرة أخرى" : "Couldn’t read your profile — please try again");
      return;
    }'''
app = replace_once(app, old_onboarding_read, new_onboarding_read, "onboarding read must fail closed")

app = replace_once(
    app,
    "      const initial = freshState();\n      initial.account.name = name.trim();",
    "      const initial = freshState();\n      delete initial.customTrainingPlan;\n      delete initial.customNutritionPlan;\n      initial.account.name = name.trim();",
    "email signup admin-managed field sanitization",
)
app = replace_once(
    app,
    "  else if (phase === \"onboarding\")\n    authScreen = (",
    "  else if (phase === \"dataError\")\n    authScreen = <DataErrorScreen error={saveError} />;\n  else if (phase === \"onboarding\")\n    authScreen = (",
    "data error auth screen branch",
)
app = replace_once(
    app,
    "    if (!loaded || writePending) return;\n    if (saveError) return;",
    "    if (!loaded || writePending) return;\n    if (saveError) {\n      setPhase(\"dataError\");\n      return;\n    }",
    "data error phase routing",
)

marker = "/* ============================== APP ROOT ============================== */"
insert = '''function DataErrorScreen({ error }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: C.bg, textAlign: "center" }}>
      <WifiOff size={42} color={C.danger} />
      <div style={{ color: C.text, fontSize: 20, fontWeight: 800, marginTop: 16 }}>{ar ? "تعذر تحميل بيانات حسابك" : "Couldn’t load your account data"}</div>
      <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.6, marginTop: 10, maxWidth: 330 }}>{ar ? "لم نغيّر بياناتك محليًا لأن قاعدة البيانات لم تؤكد القراءة. حاول مرة أخرى." : "Your data was not changed locally because Firestore did not confirm the read. Try again."}</div>
      <div style={{ color: C.sub2, fontSize: 11, marginTop: 12, maxWidth: 330, wordBreak: "break-word" }}>{String(error?.code || error?.message || "firestore_read_failed")}</div>
      <GreenButton onClick={() => window.location.reload()} style={{ marginTop: 28, maxWidth: 320 }}>{ar ? "إعادة المحاولة" : "Retry"}</GreenButton>
    </div>
  );
}

'''
if marker in app and "function DataErrorScreen" not in app:
    app = app.replace(marker, insert + marker, 1)

app = app.replace("package=com.fittrack.app", "package=com.bodyahmed77.fiftyfit")

# Target AdminScreen only. This avoids accidentally rewriting an unrelated helper
# named saveAccount elsewhere in the very large App.jsx.
admin_start = app.find("function AdminScreen")
admin_end = app.find(marker, admin_start)
if admin_start < 0 or admin_end < 0:
    raise SystemExit("AdminScreen section not found")
admin_section = app[admin_start:admin_end]
old_save = '''  const saveAccount = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const next = clone(result.data);
      next.account = {
        ...next.account,
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });
      setResult({ ...result, data: next });
      showToast(ar ? "تم حفظ بيانات المستخدم" : "User details saved");
    } catch (e) {
      console.error("admin save failed", e);
      showToast(ar ? "فشل الحفظ" : "Save failed");
    } finally {
      setSaving(false);
    }
  };'''
new_save = '''  const saveAccount = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const accountPatch = {
        ...(result.data.account || {}),
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      await setDoc(
        result.ref,
        { account: accountPatch, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setResult({ ...result, data: { ...result.data, account: accountPatch } });
      showToast(ar ? "تم حفظ بيانات المستخدم" : "User details saved");
    } catch (e) {
      console.error("admin save failed", e);
      showToast(ar ? "فشل الحفظ" : "Save failed");
    } finally {
      setSaving(false);
    }
  };'''
if old_save not in admin_section:
    raise SystemExit("AdminScreen saveAccount canonical block not found")
admin_section = admin_section.replace(old_save, new_save, 1)
app = app[:admin_start] + admin_section + app[admin_end:]
app_path.write_text(app, encoding="utf-8")

# Google-created profiles must not carry admin-managed fields.
google_path = Path("src/googleAuth.js")
google = google_path.read_text(encoding="utf-8")
old_google = '''  const initial = typeof createInitialState === "function"
    ? createInitialState(user, localLang)
    : minimalInitialState(user, localLang);
  initial.entitlements = {'''
new_google = '''  const initial = typeof createInitialState === "function"
    ? createInitialState(user, localLang)
    : minimalInitialState(user, localLang);
  delete initial.customTrainingPlan;
  delete initial.customNutritionPlan;
  initial.entitlements = {'''
if old_google in google:
    google = google.replace(old_google, new_google, 1)
google_path.write_text(google, encoding="utf-8")

print("runtime audit source fixes applied")