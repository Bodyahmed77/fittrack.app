from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

# ------------------------------------------------------------
# App.jsx
# ------------------------------------------------------------
app_path = Path("src/App.jsx")
app = app_path.read_text(encoding="utf-8")

# Settings language must update the root's localLang immediately. Updating
# Firestore alone is insufficient because the root intentionally prefers the
# device's local language for the active session.
app = replace_once(
    app,
    'function SettingsScreen({ data, setData, back, go, showToast }) {',
    'function SettingsScreen({ data, setData, back, go, showToast, onLanguageChange }) {',
    'settings language callback prop',
)
app = replace_once(
    app,
    '''  const setLang = (l) => {\n    const next = clone(data);\n    next.settings.language = l;\n    persistLanguage(l);\n    setData(next);\n  };''',
    '''  const setLang = (l) => {\n    if (l !== "ar" && l !== "en") return;\n    if (typeof onLanguageChange === "function") {\n      onLanguageChange(l);\n      return;\n    }\n    const next = clone(data);\n    next.settings.language = l;\n    persistLanguage(l);\n    setData(next);\n  };''',
    'settings language state update',
)
app = replace_once(
    app,
    '''      <SettingsScreen\n        data={data}\n        setData={setData}\n        back={back}\n        go={go}\n        showToast={showToast}\n      />''',
    '''      <SettingsScreen\n        data={data}\n        setData={setData}\n        back={back}\n        go={go}\n        showToast={showToast}\n        onLanguageChange={(nextLang) => {\n          persistLanguage(nextLang);\n          setLocalLang(nextLang);\n          if (firebaseUser && loaded && data.settings.language !== nextLang) {\n            const next = clone(data);\n            next.settings.language = nextLang;\n            void setData(next);\n          }\n        }}\n      />''',
    'root settings language binding',
)

# ------------------------------------------------------------
# Entitlement model: Firestore admin grants are separate from Play-verified
# entitlements. Effective UI entitlement is their union.
# ------------------------------------------------------------
app = replace_once(
    app,
    '  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
    '  const verifiedEntitlementsRef = useRef(null);\n  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
    'admin entitlement ref declaration',
)
app = replace_once(
    app,
    '      verifiedEntitlementsRef.current = null;\n      return;',
    '      verifiedEntitlementsRef.current = null;\n      adminEntitlementsRef.current = null;\n      return;',
    'admin entitlement ref reset',
)
app = replace_once(
    app,
    '''        const fresh = freshState();\n        profileExistsRef.current = snap.exists();\n        const parsed = snap.exists() ? snap.data() : {};''',
    '''        const fresh = freshState();\n        profileExistsRef.current = snap.exists();\n        const parsed = snap.exists() ? snap.data() : {};\n        const legacyAdmin = parsed.adminEntitlements || parsed.entitlements || fresh.entitlements;\n        adminEntitlementsRef.current = {\n          trainingPro: !!legacyAdmin?.trainingPro,\n          nutritionPro: !!legacyAdmin?.nutritionPro,\n          aiCoachPro: !!legacyAdmin?.aiCoachPro,\n          proExpiresAt: legacyAdmin?.proExpiresAt || null,\n        };''',
    'admin entitlement snapshot load',
)
app = replace_once(
    app,
    '''          entitlements: {\n            ...fresh.entitlements,\n            ...(verifiedEntitlementsRef.current || {}),\n          },''',
    '''          entitlements: {\n            ...fresh.entitlements,\n            ...(adminEntitlementsRef.current || {}),\n            ...(verifiedEntitlementsRef.current || {}),\n          },\n          adminEntitlements: {\n            ...(adminEntitlementsRef.current || fresh.entitlements),\n          },''',
    'effective entitlement union on snapshot',
)
app = replace_once(
    app,
    '''  const setVerifiedEntitlements = useCallback((entitlements) => {\n    verifiedEntitlementsRef.current = {\n      nutritionPro: !!entitlements?.nutritionPro,\n      trainingPro: !!entitlements?.trainingPro,\n      aiCoachPro: !!entitlements?.aiCoachPro,\n      proExpiresAt: entitlements?.proExpiresAt || null,\n    };\n    setDataRaw((current) => ({\n      ...current,\n      entitlements: verifiedEntitlementsRef.current,\n    }));\n  }, []);''',
    '''  const setVerifiedEntitlements = useCallback((entitlements) => {\n    verifiedEntitlementsRef.current = {\n      nutritionPro: !!entitlements?.nutritionPro,\n      trainingPro: !!entitlements?.trainingPro,\n      aiCoachPro: !!entitlements?.aiCoachPro,\n      proExpiresAt: entitlements?.proExpiresAt || null,\n    };\n    setDataRaw((current) => ({\n      ...current,\n      entitlements: {\n        trainingPro: !!adminEntitlementsRef.current?.trainingPro || !!verifiedEntitlementsRef.current.trainingPro,\n        nutritionPro: !!adminEntitlementsRef.current?.nutritionPro || !!verifiedEntitlementsRef.current.nutritionPro,\n        aiCoachPro: !!adminEntitlementsRef.current?.aiCoachPro || !!verifiedEntitlementsRef.current.aiCoachPro,\n        proExpiresAt: adminEntitlementsRef.current?.proExpiresAt || verifiedEntitlementsRef.current.proExpiresAt || null,\n      },\n      adminEntitlements: { ...(adminEntitlementsRef.current || {}) },\n    }));\n  }, []);''',
    'verified entitlement union with admin grants',
)
# Normal user writes must never persist the admin-only grant field.
app = replace_once(
    app,
    '''            key !== "entitlements" &&\n            key !== "customTrainingPlan" &&''',
    '''            key !== "entitlements" &&\n            key !== "adminEntitlements" &&\n            key !== "customTrainingPlan" &&''',
    'normal user write strips admin entitlement field',
)

# Do not clear admin grants when Google Play has no purchase record.
app = replace_once(
    app,
    '''          setVerifiedEntitlements({\n            trainingPro: false,\n            nutritionPro: false,\n            aiCoachPro: false,\n            proExpiresAt: null,\n          });''',
    '''          setVerifiedEntitlements({\n            trainingPro: false,\n            nutritionPro: false,\n            aiCoachPro: false,\n            proExpiresAt: null,\n          });''',
    'restore entitlement clear preserved via union',
)

# ------------------------------------------------------------
# Admin screen: explicit plan grants, persisted separately from Play state.
# ------------------------------------------------------------
app = replace_once(
    app,
    '''  const proActive =\n    !!result?.data?.entitlements?.trainingPro ||\n    !!result?.data?.entitlements?.nutritionPro;\n\n  const setPro = async (on) => {''',
    '''  const adminEntitlements = result?.data?.adminEntitlements || result?.data?.entitlements || {};\n  const proActive =\n    !!adminEntitlements.trainingPro ||\n    !!adminEntitlements.nutritionPro ||\n    !!adminEntitlements.aiCoachPro;\n\n  const setPro = async (on, plan = "all") => {''',
    'admin plan state',
)
app = replace_once(
    app,
    '''      const next = clone(result.data);\n      next.entitlements = next.entitlements || {};\n      if (on) {\n        // Grant a 30-day Pro subscription from today.\n        const expires = new Date();\n        expires.setDate(expires.getDate() + 30);\n        next.entitlements.trainingPro = true;\n        next.entitlements.nutritionPro = true;\n        next.entitlements.aiCoachPro = true;\n        next.entitlements.proExpiresAt = expires.toISOString().slice(0, 10);\n      } else {\n        next.entitlements.trainingPro = false;\n        next.entitlements.nutritionPro = false;\n        next.entitlements.aiCoachPro = false;\n        next.entitlements.proExpiresAt = null;\n      }\n      await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });\n      setResult({ ...result, data: next });\n      showToast(on ? "Pro granted for 30 days" : "Pro removed");''',
    '''      const next = clone(result.data);\n      const admin = {\n        ...(next.adminEntitlements || next.entitlements || {}),\n      };\n      if (on) {\n        const expires = new Date();\n        expires.setDate(expires.getDate() + 30);\n        admin.proExpiresAt = expires.toISOString().slice(0, 10);\n        if (plan === "all" || plan === "training") admin.trainingPro = true;\n        if (plan === "all" || plan === "nutrition") admin.nutritionPro = true;\n        if (plan === "all" || plan === "ai") admin.aiCoachPro = true;\n      } else {\n        if (plan === "all" || plan === "training") admin.trainingPro = false;\n        if (plan === "all" || plan === "nutrition") admin.nutritionPro = false;\n        if (plan === "all" || plan === "ai") admin.aiCoachPro = false;\n        if (!admin.trainingPro && !admin.nutritionPro && !admin.aiCoachPro) admin.proExpiresAt = null;\n      }\n      const effective = {\n        trainingPro: !!admin.trainingPro,\n        nutritionPro: !!admin.nutritionPro,\n        aiCoachPro: !!admin.aiCoachPro,\n        proExpiresAt: admin.proExpiresAt || null,\n      };\n      await setDoc(result.ref, {\n        adminEntitlements: effective,\n        entitlements: effective,\n        updatedAt: new Date().toISOString(),\n      }, { merge: true });\n      setResult({ ...result, data: { ...next, adminEntitlements: effective, entitlements: effective } });\n      showToast(on ? `${plan === "all" ? "All Pro" : plan} granted for 30 days` : `${plan === "all" ? "All Pro" : plan} removed`);''',
    'admin entitlement write',
)

# Replace the two-button block with explicit plan controls.
old_buttons = '''                <GreenButton\n                  variant="outline"\n                  onClick={() => setPro(true)}\n                  disabled={saving || proActive}\n                  style={{ flex: 1 }}\n                >\n                  <Crown size={15} /> {ar ? "منح برو" : "Grant Pro"}\n                </GreenButton>\n                <GreenButton\n                  variant="outline"\n                  onClick={() => setPro(false)}\n                  disabled={saving || !proActive}\n                  style={{ flex: 1, borderColor: C.danger, color: C.danger }}\n                >\n                  <X size={15} /> {ar ? "إزالة برو" : "Remove Pro"}\n                </GreenButton>'''
new_buttons = '''                <GreenButton variant="outline" onClick={() => setPro(true, "training")} disabled={saving || adminEntitlements.trainingPro} style={{ flex: 1 }}>\n                  {ar ? "تفعيل تدريب" : "Grant Training"}\n                </GreenButton>\n                <GreenButton variant="outline" onClick={() => setPro(true, "nutrition")} disabled={saving || adminEntitlements.nutritionPro} style={{ flex: 1 }}>\n                  {ar ? "تفعيل تغذية" : "Grant Nutrition"}\n                </GreenButton>\n                <GreenButton variant="outline" onClick={() => setPro(true, "ai")} disabled={saving || adminEntitlements.aiCoachPro} style={{ flex: 1 }}>\n                  {ar ? "تفعيل AI" : "Grant AI"}\n                </GreenButton>\n                <GreenButton variant="outline" onClick={() => setPro(true, "all")} disabled={saving || (adminEntitlements.trainingPro && adminEntitlements.nutritionPro && adminEntitlements.aiCoachPro)} style={{ flex: 1 }}>\n                  <Crown size={15} /> {ar ? "تفعيل الكل" : "Grant All"}\n                </GreenButton>\n                <GreenButton variant="outline" onClick={() => setPro(false, "all")} disabled={saving || !proActive} style={{ flex: 1, borderColor: C.danger, color: C.danger }}>\n                  <X size={15} /> {ar ? "إزالة الكل" : "Remove All"}\n                </GreenButton>'''
app = replace_once(app, old_buttons, new_buttons, 'admin plan controls UI')

app_path.write_text(app, encoding="utf-8")

# ------------------------------------------------------------
# Billing error diagnostics: preserve the native response code/message.
# ------------------------------------------------------------
billing_path = Path("src/billing.js")
billing = billing_path.read_text(encoding="utf-8")
old_billing = '''  const err = new Error(message);\n  err.code = String(code);\n  if (source?.subResponseCode != null) {\n    err.subResponseCode = String(source.subResponseCode);\n  }\n  return err;'''
new_billing = '''  const err = new Error(message);\n  err.code = String(code);\n  if (source?.subResponseCode != null) {\n    err.subResponseCode = String(source.subResponseCode);\n  }\n  err.responseCode = source?.responseCode ?? source?.billingResponseCode ?? e?.responseCode ?? null;\n  err.nativeCode = source?.code ?? source?.responseCode ?? source?.billingResponseCode ?? e?.nativeCode ?? null;\n  err.nativeMessage = source?.debugMessage || source?.message || e?.nativeMessage || e?.message || null;\n  err.raw = e;\n  return err;'''
billing = replace_once(billing, old_billing, new_billing, 'billing native diagnostics propagation')

# The selected subscription offer must be tied to the selected product. Record
# all offers so a broken Play Console base plan is immediately diagnosable.
billing = replace_once(
    billing,
    '''        selectedOfferToken =\n        details?.offerToken ||''',
    '''        selectedOfferToken =\n        details?.offerToken ||''',
    'billing offer extraction anchor',
)

# Fail with a precise error if a subscription has no eligible offer token. This
# is the normal reason a launch call fails after ProductDetails succeeds.
old_launch = '''    try {\n      result = await billing.launchBillingFlow({\n        product: productId,\n        type: "SUBS",\n        ...(selectedOfferToken ? { offerToken: selectedOfferToken } : {}),\n      });'''
new_launch = '''    if (!selectedOfferToken) {\n      const err = new Error(`Google Play returned no eligible subscription offer for ${productId}`);\n      err.code = "offer_token_missing";\n      err.productId = productId;\n      throw err;\n    }\n\n    try {\n      result = await billing.launchBillingFlow({\n        product: productId,\n        type: "SUBS",\n        offerToken: selectedOfferToken,\n      });'''
billing = replace_once(billing, old_launch, new_launch, 'billing offer token required')
billing_path.write_text(billing, encoding="utf-8")

# ------------------------------------------------------------
# Google Sign-In: make the generated Web client ID explicit to the native
# plugin config at build time and allow legacy chooser fallback for a
# Credential Manager developer-error path.
# ------------------------------------------------------------
google_path = Path("src/googleAuth.js")
google = google_path.read_text(encoding="utf-8")
old_catch = '''    if (!isNoCredentialError(mapped)) {'''
new_catch = '''    if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {'''
google = replace_once(google, old_catch, new_catch, 'google credential manager fallback for developer error')
# Add a diagnostic entry before the compatibility fallback for numeric 10.
old_warn = '''    console.warn("[GoogleSignIn] no authorized Credential Manager credential; using legacy chooser");'''
new_warn = '''    console.warn("[GoogleSignIn] Credential Manager path unavailable; using legacy chooser", { code: mapped?.code, googleStatusCode: mapped?.googleStatusCode, nativeCode: mapped?.nativeCode });'''
google = replace_once(google, old_warn, new_warn, 'google fallback diagnostic')
google_path.write_text(google, encoding="utf-8")

# ------------------------------------------------------------
# Firestore rules: users cannot alter adminEntitlements.
# ------------------------------------------------------------
rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
rules = replace_once(
    rules,
    '''          "everythingPro"\n        ]);''',
    '''          "everythingPro",\n          "adminEntitlements"\n        ]);''',
    'firestore create admin entitlement guard',
)
rules = replace_once(
    rules,
    '''          request.resource.data.get("entitlements", {}) ==\n            resource.data.get("entitlements", {}) &&\n          !request.resource.data.diff(resource.data).affectedKeys().hasAny([''',
    '''          request.resource.data.get("entitlements", {}) ==\n            resource.data.get("entitlements", {}) &&\n          request.resource.data.get("adminEntitlements", {}) ==\n            resource.data.get("adminEntitlements", {}) &&\n          !request.resource.data.diff(resource.data).affectedKeys().hasAny([''',
    'firestore update admin entitlement guard',
)
rules_path.write_text(rules, encoding="utf-8")

# ------------------------------------------------------------
# Capacitor config: the workflow injects googleWebClientId from the verified
# google-services.json before cap sync. This key is intentionally generated,
# never hand-maintained.
# ------------------------------------------------------------
print("deep runtime fixes applied")
