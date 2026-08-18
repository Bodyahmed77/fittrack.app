from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ------------------------------------------------------------
# App.jsx — language switching
# ------------------------------------------------------------
app_path = Path("src/App.jsx")
app = app_path.read_text(encoding="utf-8")

if "onLanguageChange" not in app.split("function SettingsScreen", 1)[1].split("function ", 1)[0]:
    app = replace_once(
        app,
        'function SettingsScreen({ data, setData, back, go, showToast }) {',
        'function SettingsScreen({ data, setData, back, go, showToast, onLanguageChange }) {',
        "settings language callback prop",
    )

setlang_pattern = r'  const setLang = \(l\) => \{.*?\n  \};'
setlang_replacement = '''  const setLang = (l) => {
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
if 'onLanguageChange(l);' not in app:
    app, n = re.subn(setlang_pattern, setlang_replacement, app, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("settings setLang handler not found")

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


# ------------------------------------------------------------
# App.jsx — separate admin grants from Play-verified entitlements
# ------------------------------------------------------------
if "const adminEntitlementsRef = useRef(null);" not in app:
    app = replace_once(
        app,
        '  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
        '  const verifiedEntitlementsRef = useRef(null);\n  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
        "admin entitlement ref declaration",
    )

if "function normalizeAdminEntitlements(value)" not in app:
    helper_marker = '  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);'
    helper = '''  const adminEntitlementsRef = useRef(null);
  const latestLocalWriteAtRef = useRef(null);

  const normalizeAdminEntitlements = useCallback((value) => {
    const source = value && typeof value === "object" ? value : {};
    const expiresAt = source.proExpiresAt ? Date.parse(`${source.proExpiresAt}T23:59:59.999Z`) : NaN;
    const expired = Number.isFinite(expiresAt) && Date.now() > expiresAt;
    if (expired) {
      return {
        trainingPro: false,
        nutritionPro: false,
        aiCoachPro: false,
        proExpiresAt: null,
      };
    }
    return {
      trainingPro: !!source.trainingPro,
      nutritionPro: !!source.nutritionPro,
      aiCoachPro: !!source.aiCoachPro,
      proExpiresAt: source.proExpiresAt || null,
    };
  }, []);'''
    app = replace_once(app, helper_marker, helper, "admin entitlement normalization helper")

reset_new = '      verifiedEntitlementsRef.current = null;\n      profileExistsRef.current = false;\n      adminEntitlementsRef.current = null;\n      return;'
if reset_new not in app:
    reset_old = '      verifiedEntitlementsRef.current = null;\n      profileExistsRef.current = false;\n      return;'
    if reset_old in app:
        app = app.replace(reset_old, reset_new, 1)
    else:
        reset_old = '      verifiedEntitlementsRef.current = null;\n      return;'
        if reset_old in app:
            app = app.replace(reset_old, '      verifiedEntitlementsRef.current = null;\n      adminEntitlementsRef.current = null;\n      return;', 1)

if "const legacyAdmin = parsed.adminEntitlements" not in app:
    snapshot_old = '''        const fresh = freshState();
        profileExistsRef.current = snap.exists();
        const parsed = snap.exists() ? snap.data() : {};'''
    snapshot_new = '''        const fresh = freshState();
        profileExistsRef.current = snap.exists();
        const parsed = snap.exists() ? snap.data() : {};
        const legacyAdmin = parsed.adminEntitlements || {};
        adminEntitlementsRef.current = normalizeAdminEntitlements(legacyAdmin);'''
    app = replace_once(app, snapshot_old, snapshot_new, "admin entitlement snapshot load")

if "...(adminEntitlementsRef.current || {})" not in app:
    effective_old = '''          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },'''
    effective_new = '''          entitlements: {
            ...fresh.entitlements,
            ...(adminEntitlementsRef.current || {}),
            ...(verifiedEntitlementsRef.current || {}),
          },
          adminEntitlements: {
            ...(adminEntitlementsRef.current || {}),
          },'''
    app = replace_once(app, effective_old, effective_new, "effective entitlement union")

if "adminEntitlements: { ...(adminEntitlementsRef.current || {}) }" not in app:
    verified_old = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
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
  }, []);'''
    verified_new = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
    verifiedEntitlementsRef.current = {
      nutritionPro: !!entitlements?.nutritionPro,
      trainingPro: !!entitlements?.trainingPro,
      aiCoachPro: !!entitlements?.aiCoachPro,
      proExpiresAt: entitlements?.proExpiresAt || null,
    };
    const admin = normalizeAdminEntitlements(adminEntitlementsRef.current || {});
    adminEntitlementsRef.current = admin;
    setDataRaw((current) => ({
      ...current,
      entitlements: {
        trainingPro: !!admin.trainingPro || !!verifiedEntitlementsRef.current.trainingPro,
        nutritionPro: !!admin.nutritionPro || !!verifiedEntitlementsRef.current.nutritionPro,
        aiCoachPro: !!admin.aiCoachPro || !!verifiedEntitlementsRef.current.aiCoachPro,
        proExpiresAt: admin.proExpiresAt || verifiedEntitlementsRef.current.proExpiresAt || null,
      },
      adminEntitlements: { ...admin },
    }));
  }, [normalizeAdminEntitlements]);'''
    app = replace_once(app, verified_old, verified_new, "verified entitlement union")

if 'key !== "adminEntitlements"' not in app:
    app = replace_once(
        app,
        '''            key !== "entitlements" &&
            key !== "customTrainingPlan" &&''',
        '''            key !== "entitlements" &&
            key !== "adminEntitlements" &&
            key !== "customTrainingPlan" &&''',
        "normal user write strips admin entitlement field",
    )


# ------------------------------------------------------------
# App.jsx — admin UI and writes
# ------------------------------------------------------------
if 'const adminEntitlements = result?.data?.adminEntitlements' not in app:
    old_admin_state = '''  const proActive =
    !!result?.data?.entitlements?.trainingPro ||
    !!result?.data?.entitlements?.nutritionPro;

  const setPro = async (on) => {'''
    new_admin_state = '''  const adminEntitlements = result?.data?.adminEntitlements || {};
  const verifiedEntitlements = result?.data?.entitlements || {};
  const proActive =
    !!adminEntitlements.trainingPro ||
    !!adminEntitlements.nutritionPro ||
    !!adminEntitlements.aiCoachPro ||
    !!verifiedEntitlements.trainingPro ||
    !!verifiedEntitlements.nutritionPro ||
    !!verifiedEntitlements.aiCoachPro;

  const setPro = async (on, plan = "all") => {'''
    app = replace_once(app, old_admin_state, new_admin_state, "admin plan state")

old_admin_write = '''      const next = clone(result.data);
      next.entitlements = next.entitlements || {};
      if (on) {
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
        : {
            trainingPro: !!admin.trainingPro,
            nutritionPro: !!admin.nutritionPro,
            aiCoachPro: !!admin.aiCoachPro,
            proExpiresAt: admin.proExpiresAt || null,
          };
      await setDoc(result.ref, { adminEntitlements: effective, updatedAt: new Date().toISOString() }, { merge: true });
      const currentEntitlements = result.data.entitlements || {};
      const effectiveView = {
        trainingPro: !!effective.trainingPro || !!currentEntitlements.trainingPro,
        nutritionPro: !!effective.nutritionPro || !!currentEntitlements.nutritionPro,
        aiCoachPro: !!effective.aiCoachPro || !!currentEntitlements.aiCoachPro,
        proExpiresAt: effective.proExpiresAt || currentEntitlements.proExpiresAt || null,
      };
      setResult({ ...result, data: { ...result.data, adminEntitlements: effective, entitlements: effectiveView } });
      showToast(on ? `${plan === "all" ? "All Pro" : plan} granted for 30 days` : `${plan === "all" ? "All Pro" : plan} removed`);'''
if old_admin_write in app:
    app = app.replace(old_admin_write, new_admin_write, 1)

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
      await setDoc(
        result.ref,
        { account: accountPatch, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setResult({
        ...result,
        data: { ...result.data, account: accountPatch },
      });'''
if old_account_save in app:
    app = app.replace(old_account_save, new_account_save, 1)

old_buttons = '''                <GreenButton
                  variant="outline"
                  onClick={() => setPro(true)}
                  disabled={saving || proActive}
                  style={{ flex: 1 }}
                >
                  <Crown size={15} /> {ar ? "منح برو" : "Grant Pro"}
                </GreenButton>
                <GreenButton
                  variant="outline"
                  onClick={() => setPro(false)}
                  disabled={saving || !proActive}
                  style={{ flex: 1, borderColor: C.danger, color: C.danger }}
                >
                  <X size={15} /> {ar ? "إزالة برو" : "Remove Pro"}
                </GreenButton>'''
new_buttons = '''                <GreenButton variant="outline" onClick={() => setPro(true, "training")} disabled={saving || adminEntitlements.trainingPro} style={{ flex: 1 }}>
                  {ar ? "تفعيل تدريب" : "Grant Training"}
                </GreenButton>
                <GreenButton variant="outline" onClick={() => setPro(true, "nutrition")} disabled={saving || adminEntitlements.nutritionPro} style={{ flex: 1 }}>
                  {ar ? "تفعيل تغذية" : "Grant Nutrition"}
                </GreenButton>
                <GreenButton variant="outline" onClick={() => setPro(true, "ai")} disabled={saving || adminEntitlements.aiCoachPro} style={{ flex: 1 }}>
                  {ar ? "تفعيل AI" : "Grant AI"}
                </GreenButton>
                <GreenButton variant="outline" onClick={() => setPro(true, "all")} disabled={saving || (adminEntitlements.trainingPro && adminEntitlements.nutritionPro && adminEntitlements.aiCoachPro)} style={{ flex: 1 }}>
                  <Crown size={15} /> {ar ? "تفعيل الكل" : "Grant All"}
                </GreenButton>
                <GreenButton variant="outline" onClick={() => setPro(false, "all")} disabled={saving || !proActive} style={{ flex: 1, borderColor: C.danger, color: C.danger }}>
                  <X size={15} /> {ar ? "إزالة الكل" : "Remove All"}
                </GreenButton>'''
if old_buttons in app:
    app = app.replace(old_buttons, new_buttons, 1)

# ------------------------------------------------------------
# Billing source hardening
# ------------------------------------------------------------
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
  if (source?.subResponseCode != null) {
    err.subResponseCode = String(source.subResponseCode);
  }
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
app_path.write_text(app, encoding="utf-8")
billing_path.write_text(billing, encoding="utf-8")

# ------------------------------------------------------------
# Google Auth — Credential Manager developer errors must remain visible.
# ------------------------------------------------------------
google_path = Path("src/googleAuth.js")
google = google_path.read_text(encoding="utf-8")
google = google.replace(
    'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {',
    'if (!isNoCredentialError(mapped)) {',
    1,
)
google_path.write_text(google, encoding="utf-8")

# ------------------------------------------------------------
# Preserve former repair-stage invariants in this canonical transform.
# ------------------------------------------------------------
app = app_path.read_text(encoding="utf-8")
if "function freshState(language = null)" not in app:
    app = replace_once(app, "function freshState() {", "function freshState(language = null) {", "freshState language parameter")
fresh_start = app.index("function freshState(language = null)")
fresh_end = app.index("/* ============================== AUTH + FIRESTORE STORAGE", fresh_start)
fresh_body = app[fresh_start:fresh_end]
if "language," not in fresh_body:
    if fresh_body.count("      language: null,") != 1:
        raise SystemExit("freshState language field missing or ambiguous")
    app = app[:fresh_start] + fresh_body.replace("      language: null,", "      language,", 1) + app[fresh_end:]
app_path.write_text(app, encoding="utf-8")

# ------------------------------------------------------------
# Paywall: native purchase is only a transport success. The server-side
# verify-purchase call is the only step allowed to turn it into Pro.
# ------------------------------------------------------------
app = app_path.read_text(encoding="utf-8")
old_should_unlock = '''      // Only unlock after the native bridge returns an acknowledged purchase.
      const shouldUnlock = result?.success === true && result?.verified === true;'''
new_should_unlock = '''      // Native Billing only proves that Play returned a purchase token.
      // Server-side verify-purchase is the authoritative entitlement gate below.
      const shouldUnlock = result?.success === true;'''
if old_should_unlock in app:
    app = app.replace(old_should_unlock, new_should_unlock, 1)
elif "const shouldUnlock = result?.success === true;" not in app:
    raise SystemExit("Paywall purchase gate not found")
app_path.write_text(app, encoding="utf-8")

# Final invariants.
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
if "await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });" in final_app:
    raise SystemExit("Admin profile editor still rewrites whole user documents")

print("deep runtime fixes applied")
