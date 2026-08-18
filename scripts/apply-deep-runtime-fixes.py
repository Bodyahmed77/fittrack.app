from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# The repository intentionally keeps a few deterministic source transforms in
# postinstall because Capacitor and capacitor-billing generate files that do not
# exist in the clean checkout. Each transform is strict and fail-closed.
app_path = Path("src/App.jsx")
app = app_path.read_text(encoding="utf-8")

if "onLanguageChange" not in app.split("function SettingsScreen", 1)[1].split("function ", 1)[0]:
    app = replace_once(app, 'function SettingsScreen({ data, setData, back, go, showToast }) {', 'function SettingsScreen({ data, setData, back, go, showToast, onLanguageChange }) {', "settings language callback prop")

if 'onLanguageChange(l);' not in app:
    old = '''  const setLang = (l) => {
    const next = clone(data);
    next.settings.language = l;
    persistLanguage(l);
    setData(next);
  };'''
    new = '''  const setLang = (l) => {
    if (l !== "ar" && l !== "en") return;
    if (typeof onLanguageChange === "function") {
      onLanguageChange(l);
      return;
    }
    const next = clone(data);
    next.settings.language = l;
    persistLanguage(l);
    setData(next);
  };'''
    if old not in app:
        raise SystemExit("settings setLang handler not found")
    app = app.replace(old, new, 1)

settings_render = '''      <SettingsScreen
        data={data}
        setData={setData}
        back={back}
        go={go}
        showToast={showToast}
      />'''
settings_render_new = '''      <SettingsScreen
        data={data}
        setData={setData}
        back={back}
        go={go}
        showToast={showToast}
        onLanguageChange={(nextLang) => {
          persistLanguage(nextLang);
          setLocalLang(nextLang);
          if (firebaseUser && loaded && data.settings.language !== nextLang) {
            const next = clone(data);
            next.settings.language = nextLang;
            void setData(next);
          }
        }}
      />'''
if settings_render in app:
    app = app.replace(settings_render, settings_render_new, 1)

# Separate admin-managed grants from Play-verified entitlements.
if "const adminEntitlementsRef = useRef(null);" not in app:
    app = replace_once(app, '  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);', '  const verifiedEntitlementsRef = useRef(null);\n  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);', "admin entitlement ref declaration")

if "function normalizeAdminEntitlements(value)" not in app:
    marker = '  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);'
    helper = '''  const adminEntitlementsRef = useRef(null);
  const latestLocalWriteAtRef = useRef(null);

  const normalizeAdminEntitlements = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const expiresAt = source.proExpiresAt ? Date.parse(`${source.proExpiresAt}T23:59:59.999Z`) : NaN;
    const expired = Number.isFinite(expiresAt) && Date.now() > expiresAt;
    if (expired) return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
    return {
      trainingPro: !!source.trainingPro,
      nutritionPro: !!source.nutritionPro,
      aiCoachPro: !!source.aiCoachPro,
      proExpiresAt: source.proExpiresAt || null,
    };
  };'''
    app = replace_once(app, marker, helper, "admin entitlement normalization helper")

if 'adminEntitlementsRef.current = normalizeAdminEntitlements(legacyAdmin);' not in app:
    app = replace_once(app, '        const fresh = freshState();\n        profileExistsRef.current = snap.exists();\n        const parsed = snap.exists() ? snap.data() : {};', '        const fresh = freshState();\n        profileExistsRef.current = snap.exists();\n        const parsed = snap.exists() ? snap.data() : {};\n        const legacyAdmin = parsed.adminEntitlements || {};\n        adminEntitlementsRef.current = normalizeAdminEntitlements(legacyAdmin);', "admin entitlement snapshot load")

if "...(adminEntitlementsRef.current || {})" not in app:
    app = replace_once(app, '''          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },''', '''          entitlements: {
            ...fresh.entitlements,
            ...(adminEntitlementsRef.current || {}),
            ...(verifiedEntitlementsRef.current || {}),
          },
          adminEntitlements: {
            ...(adminEntitlementsRef.current || {}),
          },''', "effective entitlement union")

if 'key !== "adminEntitlements"' not in app:
    app = replace_once(app, '''            key !== "entitlements" &&
            key !== "customTrainingPlan" &&''', '''            key !== "entitlements" &&
            key !== "adminEntitlements" &&
            key !== "customTrainingPlan" &&''', "normal user write strips adminEntitlements")

# Preserve explicit Google signup language.
if "function freshState(language = null)" not in app:
    app = replace_once(app, "function freshState() {", "function freshState(language = null) {", "freshState language parameter")
fresh_start = app.index("function freshState(language = null)")
fresh_end = app.index("/* ============================== AUTH + FIRESTORE STORAGE", fresh_start)
fresh_body = app[fresh_start:fresh_end]
if "language," not in fresh_body:
    if fresh_body.count("      language: null,") != 1:
        raise SystemExit("freshState language field missing or ambiguous")
    app = app[:fresh_start] + fresh_body.replace("      language: null,", "      language,", 1) + app[fresh_end:]

# Admin screen writes: target the AdminScreen section only.
app_root = "/* ============================== APP ROOT ============================== */"
admin_start = app.find("function AdminScreen")
admin_end = app.find(app_root, admin_start)
if admin_start < 0 or admin_end < 0:
    raise SystemExit("AdminScreen section not found")
admin_section = app[admin_start:admin_end]

old_admin_write = '''      const next = clone(result.data);
      next.entitlements = next.entitlements || {};
      if (on) {
        // Grant a 30-day Pro subscription from today.
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        next.entitlements.trainingPro = true;
        next.entitlements.nutritionPro = true;
        next.entitlements.aiCoachPro = true;
        next.entitlements.proExpiresAt = expires.toISOString().slice(0, 10);
      } else {
        next.entitlements.trainingPro = false;
        next.entitlements.nutritionPro = false;
        next.entitlements.aiCoachPro = false;
        next.entitlements.proExpiresAt = null;
      }
      await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });
      setResult({ ...result, data: next });
      showToast(on ? "Pro granted for 30 days" : "Pro removed");'''
new_admin_write = '''      const admin = { ...(result.data.adminEntitlements || {}) };
      if (on) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        admin.proExpiresAt = expires.toISOString().slice(0, 10);
        if (plan === "all" || plan === "training") admin.trainingPro = true;
        if (plan === "all" || plan === "nutrition") admin.nutritionPro = true;
        if (plan === "all" || plan === "ai") admin.aiCoachPro = true;
      } else {
        if (plan === "all" || plan === "training") admin.trainingPro = false;
        if (plan === "all" || plan === "nutrition") admin.nutritionPro = false;
        if (plan === "all" || plan === "ai") admin.aiCoachPro = false;
        if (!admin.trainingPro && !admin.nutritionPro && !admin.aiCoachPro) admin.proExpiresAt = null;
      }
      const expiresAtMs = admin.proExpiresAt ? Date.parse(`${admin.proExpiresAt}T23:59:59.999Z`) : NaN;
      const expired = Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs;
      const effective = expired
        ? { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null }
        : { trainingPro: !!admin.trainingPro, nutritionPro: !!admin.nutritionPro, aiCoachPro: !!admin.aiCoachPro, proExpiresAt: admin.proExpiresAt || null };
      await setDoc(result.ref, { adminEntitlements: effective, updatedAt: new Date().toISOString() }, { merge: true });
      const currentEntitlements = result.data.entitlements || {};
      setResult({
        ...result,
        data: {
          ...result.data,
          adminEntitlements: effective,
          entitlements: {
            trainingPro: !!effective.trainingPro || !!currentEntitlements.trainingPro,
            nutritionPro: !!effective.nutritionPro || !!currentEntitlements.nutritionPro,
            aiCoachPro: !!effective.aiCoachPro || !!currentEntitlements.aiCoachPro,
            proExpiresAt: effective.proExpiresAt || currentEntitlements.proExpiresAt || null,
          },
        },
      });
      showToast(on ? `${plan === "all" ? "All Pro" : plan} granted for 30 days` : `${plan === "all" ? "All Pro" : plan} removed`);'''
if old_admin_write in admin_section:
    admin_section = admin_section.replace(old_admin_write, new_admin_write, 1)

old_account_save = '''      const next = clone(result.data);
      next.account = {
        ...next.account,
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });
      setResult({ ...result, data: next });'''
new_account_save = '''      const accountPatch = {
        ...(result.data.account || {}),
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      await setDoc(result.ref, { account: accountPatch, updatedAt: new Date().toISOString() }, { merge: true });
      setResult({ ...result, data: { ...result.data, account: accountPatch } });'''
if old_account_save in admin_section:
    admin_section = admin_section.replace(old_account_save, new_account_save, 1)

app = app[:admin_start] + admin_section + app[admin_end:]
app = app.replace("package=com.fittrack.app", "package=com.bodyahmed77.fiftyfit")

# Paywall: native purchase returns a token; server verification is the unlock gate.
old_unlock = '''      const shouldUnlock = result?.success === true && result?.verified === true;'''
if old_unlock in app:
    app = app.replace(old_unlock, '      const shouldUnlock = result?.success === true;', 1)

app_path.write_text(app, encoding="utf-8")

# Google Sign-In developer errors are configuration failures and must never be
# hidden by retrying through the legacy chooser.
google_path = Path("src/googleAuth.js")
google = google_path.read_text(encoding="utf-8")
google = google.replace('if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {', 'if (!isNoCredentialError(mapped)) {', 1)
google_path.write_text(google, encoding="utf-8")

billing_path = Path("src/billing.js")
billing = billing_path.read_text(encoding="utf-8")
old_billing = '''  const err = new Error(message);
  err.code = String(code);
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
  return err;'''
new_billing = '''  const err = new Error(message);
  err.code = String(code);
  if (source?.subResponseCode != null) err.subResponseCode = String(source.subResponseCode);
  err.responseCode = source?.responseCode ?? source?.billingResponseCode ?? e?.responseCode ?? null;
  err.nativeCode = source?.code ?? source?.responseCode ?? source?.billingResponseCode ?? e?.nativeCode ?? null;
  err.nativeMessage = source?.debugMessage || source?.message || e?.nativeMessage || e?.message || null;
  err.raw = e;
  return err;'''
if old_billing in billing:
    billing = billing.replace(old_billing, new_billing, 1)
old_launch = '''    try {
      result = await billing.launchBillingFlow({
        product: productId,
        type: "SUBS",
        ...(selectedOfferToken ? { offerToken: selectedOfferToken } : {}),
      });'''
new_launch = '''    if (!selectedOfferToken) {
      const err = new Error(`Google Play returned no eligible subscription offer for ${productId}`);
      err.code = "offer_token_missing";
      err.productId = productId;
      throw err;
    }
    try {
      result = await billing.launchBillingFlow({
        product: productId,
        type: "SUBS",
        offerToken: selectedOfferToken,
      });'''
if old_launch in billing:
    billing = billing.replace(old_launch, new_launch, 1)
billing_path.write_text(billing, encoding="utf-8")

# Preserve the former repair-stage Google-account field sanitization.
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

# Final invariants scoped to actual transformed subsystems.
final_google = google_path.read_text(encoding="utf-8")
if 'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {' in final_google:
    raise SystemExit("Google auth integrity failed: developer_error fallback still present")
final_app = app_path.read_text(encoding="utf-8")
if "function freshState(language = null)" not in final_app:
    raise SystemExit("Language integrity failed: freshState signature missing")
if "const shouldUnlock = result?.success === true && result?.verified === true;" in final_app:
    raise SystemExit("Paywall integrity failed: unlock gate still requires pre-server verification")
if "const shouldUnlock = result?.success === true;" not in final_app:
    raise SystemExit("Paywall integrity failed: server verification gate not wired")
admin_start = final_app.find("function AdminScreen")
admin_end = final_app.find(app_root, admin_start)
if admin_start < 0 or admin_end < 0:
    raise SystemExit("AdminScreen integrity failed: section missing")
final_admin = final_app[admin_start:admin_end]
if "const accountPatch = {" not in final_admin:
    raise SystemExit("Admin profile editor still lacks field-scoped account write")
if "await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });" in final_admin:
    raise SystemExit("AdminScreen still rewrites stale whole user document")
if "adminEntitlements: effective" not in final_admin:
    raise SystemExit("Admin grant is not persisted separately")

print("deep runtime fixes applied")