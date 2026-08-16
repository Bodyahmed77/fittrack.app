from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ------------------------------------------------------------
# App.jsx runtime fixes discovered during the deep audit.
# The transform is intentionally strict: if the surrounding source changes,
# the build must stop rather than silently producing a partially patched app.
# ------------------------------------------------------------
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

old_persist = '''      const persisted = Object.fromEntries(\n        Object.entries(next).filter(\n          ([key]) =>\n            key !== \"customTrainingPlan\" &&\n            key !== \"customNutritionPlan\",\n        ),\n      );\n      verifiedEntitlementsRef.current = next.entitlements;'''
new_persist = '''      const persistedBase = Object.fromEntries(\n        Object.entries(next).filter(\n          ([key]) =>\n            key !== \"entitlements\" &&\n            key !== \"customTrainingPlan\" &&\n            key !== \"customNutritionPlan\",\n        ),\n      );\n      // Firestore rules deliberately make entitlements server-authoritative.\n      // Existing profiles must never receive client-written Pro flags. A\n      // missing profile may only be created with the exact free entitlement\n      // object required by firestore.rules.\n      const persisted = profileExistsRef.current\n        ? persistedBase\n        : {\n            ...persistedBase,\n            entitlements: {\n              trainingPro: false,\n              nutritionPro: false,\n              aiCoachPro: false,\n              proExpiresAt: null,\n            },\n          };\n      verifiedEntitlementsRef.current = next.entitlements;'''
app = replace_once(app, old_persist, new_persist, "entitlement-safe Firestore payload")

app = replace_once(
    app,
    "        );\n        return true;\n      } catch (e) {",
    "        );\n        profileExistsRef.current = true;\n        return true;\n      } catch (e) {",
    "profile exists ref after successful write",
)

old_onboarding_read = '''    try {\n      const snap = await getDoc(doc(db, \"users\", uid));\n      base = snap.exists() ? { ...freshState(), ...snap.data() } : clone(data);\n    } catch (e) {\n      // getDoc is best-effort here. useAppData already has a live, Firestore-backed\n      // snapshot and setData below is the authoritative persistence boundary.\n      // A transient read failure must not trap a brand-new user in onboarding.\n      console.warn(\"[onboarding] direct profile read failed; using trusted app state\", e);\n      base = clone(data);\n    }'''
new_onboarding_read = '''    try {\n      const snap = await getDoc(doc(db, \"users\", uid));\n      if (!snap.exists()) {\n        setErr(ar ? \"لم يتم العثور على ملف حسابك — حاول تسجيل الدخول مرة أخرى\" : \"Your profile could not be found — please sign in again\");\n        return;\n      }\n      base = { ...freshState(), ...snap.data() };\n    } catch (e) {\n      console.error(\"[onboarding] direct profile read failed\", e);\n      setErr(ar ? \"تعذر قراءة بيانات حسابك — حاول مرة أخرى\" : \"Couldn’t read your profile — please try again\");\n      return;\n    }'''
app = replace_once(app, old_onboarding_read, new_onboarding_read, "onboarding read must fail closed")

app = replace_once(
    app,
    "      const initial = freshState();\n      initial.account.name = name.trim();",
    "      const initial = freshState();\n      // These fields are admin-managed and are rejected by firestore.rules on create.\n      delete initial.customTrainingPlan;\n      delete initial.customNutritionPlan;\n      initial.account.name = name.trim();",
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

# Insert a small fail-closed Firestore recovery screen before the app root.
marker = "/* ============================== APP ROOT ============================== */"
insert = '''function DataErrorScreen({ error }) {\n  const { C, lang } = useUI();\n  const ar = lang === \"ar\";\n  return (\n    <div\n      dir={ar ? \"rtl\" : \"ltr\"}\n      style={{\n        minHeight: \"100vh\",\n        display: \"flex\",\n        flexDirection: \"column\",\n        alignItems: \"center\",\n        justifyContent: \"center\",\n        padding: 28,\n        background: C.bg,\n        textAlign: \"center\",\n      }}\n    >\n      <WifiOff size={42} color={C.danger} />\n      <div style={{ color: C.text, fontSize: 20, fontWeight: 800, marginTop: 16 }}>\n        {ar ? \"تعذر تحميل بيانات حسابك\" : \"Couldn’t load your account data\"}\n      </div>\n      <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.6, marginTop: 10, maxWidth: 330 }}>\n        {ar\n          ? \"لم نغيّر بياناتك محليًا لأن قاعدة البيانات لم تؤكد القراءة. حاول مرة أخرى.\"\n          : \"Your data was not changed locally because Firestore did not confirm the read. Try again.\"}\n      </div>\n      <div style={{ color: C.sub2, fontSize: 11, marginTop: 12, maxWidth: 330, wordBreak: \"break-word\" }}>\n        {String(error?.code || error?.message || \"firestore_read_failed\")}\n      </div>\n      <GreenButton onClick={() => window.location.reload()} style={{ marginTop: 28, maxWidth: 320 }}>\n        {ar ? \"إعادة المحاولة\" : \"Retry\"}\n      </GreenButton>\n    </div>\n  );\n}\n\n'''
if app.count(marker) != 1:
    raise SystemExit("APP ROOT marker not found exactly once")
app = app.replace(marker, insert + marker, 1)

app = app.replace(
    "package=com.fittrack.app",
    "package=com.bodyahmed77.fiftyfit",
)

app_path.write_text(app, encoding="utf-8")

# ------------------------------------------------------------
# Google Auth create path: remove admin-managed fields supplied by freshState.
# ------------------------------------------------------------
google_path = Path("src/googleAuth.js")
google = google_path.read_text(encoding="utf-8")
old_google = '''  const initial = typeof createInitialState === \"function\"\n    ? createInitialState(user, localLang)\n    : minimalInitialState(user, localLang);\n  initial.entitlements = {'''
new_google = '''  const initial = typeof createInitialState === \"function\"\n    ? createInitialState(user, localLang)\n    : minimalInitialState(user, localLang);\n  // firestore.rules rejects admin-managed plan fields on client-created docs.\n  delete initial.customTrainingPlan;\n  delete initial.customNutritionPlan;\n  initial.entitlements = {'''
if google.count(old_google) != 1:
    raise SystemExit(f"Google create sanitization: expected 1 match, found {google.count(old_google)}")
google = google.replace(old_google, new_google, 1)
google_path.write_text(google, encoding="utf-8")

print("runtime audit source fixes applied")
