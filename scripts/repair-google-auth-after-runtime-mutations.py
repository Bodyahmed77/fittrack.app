from pathlib import Path

# Postinstall integrity guard for the small set of runtime mutations that
# still have legacy producers. The long-term goal is to retire source mutation
# entirely; until then, this script makes the final shipped source canonical
# and fails closed when the expected surrounding code is missing.

# ------------------------------------------------------------
# Google Sign-In: DEVELOPER_ERROR must fail fast
# ------------------------------------------------------------
google_path = Path("src/googleAuth.js")
google_text = google_path.read_text(encoding="utf-8")

bad_google = 'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {'
good_google = 'if (!isNoCredentialError(mapped)) {'

if bad_google in google_text:
    google_text = google_text.replace(bad_google, good_google, 1)
    google_path.write_text(google_text, encoding="utf-8")
    print("Restored Google Sign-In DEVELOPER_ERROR fail-fast behavior")
else:
    print("Google Sign-In DEVELOPER_ERROR branch already correct")

if bad_google in google_text:
    raise SystemExit("Google Sign-In integrity check failed: developer_error fallback still present")

required_google = 'if (!isNoCredentialError(mapped)) {'
if required_google not in google_text:
    raise SystemExit("Google Sign-In integrity check failed: canonical no-credential branch missing")

# ------------------------------------------------------------
# Language persistence: Google-created accounts must persist the explicit
# language selected before account creation. `freshState()` historically
# ignored the language argument supplied by googleAuth.js.
# ------------------------------------------------------------
app_path = Path("src/App.jsx")
app = app_path.read_text(encoding="utf-8")

old_header = "function freshState() {"
new_header = "function freshState(language = null) {"

if old_header in app and new_header not in app:
    app = app.replace(old_header, new_header, 1)
    print("Updated freshState() to accept an explicit language")
elif new_header in app:
    print("freshState() language parameter already present")
else:
    raise SystemExit("Language integrity check failed: freshState() declaration not found")

old_language = '      language: null,'
new_language = '      language,'

fresh_segment = app.split(new_header, 1)[1].split('/* ============================== AUTH + FIRESTORE STORAGE', 1)[0]
if new_language not in fresh_segment:
    scoped = app.split(new_header, 1)
    if len(scoped) != 2:
        raise SystemExit("Language integrity check failed: could not locate freshState body")
    before, tail = scoped
    body_parts = tail.split('/* ============================== AUTH + FIRESTORE STORAGE', 1)
    if len(body_parts) != 2:
        raise SystemExit("Language integrity check failed: freshState boundary not found")
    body, after = body_parts
    if body.count(old_language) != 1:
        raise SystemExit(f"Language integrity check failed: expected one freshState language field, found {body.count(old_language)}")
    body = body.replace(old_language, new_language, 1)
    app = before + new_header + body + '/* ============================== AUTH + FIRESTORE STORAGE' + after
    print("freshState() now persists the supplied language")

# ------------------------------------------------------------
# Admin entitlement safety: an admin grant must only change the
# server-managed adminEntitlements layer. It must never overwrite a real
# Google Play-verified entitlement with false. The effective entitlement is
# the union of adminEntitlements and verified entitlements elsewhere.
# ------------------------------------------------------------
old_admin_write = '''      await setDoc(result.ref, {
        adminEntitlements: effective,
        entitlements: effective,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setResult({ ...result, data: { ...result.data, adminEntitlements: effective, entitlements: effective } });'''
new_admin_write = '''      await setDoc(result.ref, {
        adminEntitlements: effective,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      const currentEntitlements = result.data.entitlements || {};
      const effectiveView = {
        trainingPro: !!effective.trainingPro || !!currentEntitlements.trainingPro,
        nutritionPro: !!effective.nutritionPro || !!currentEntitlements.nutritionPro,
        aiCoachPro: !!effective.aiCoachPro || !!currentEntitlements.aiCoachPro,
        proExpiresAt: effective.proExpiresAt || currentEntitlements.proExpiresAt || null,
      };
      setResult({ ...result, data: { ...result.data, adminEntitlements: effective, entitlements: effectiveView } });'''

if old_admin_write in app:
    app = app.replace(old_admin_write, new_admin_write, 1)
    print("Admin grant now preserves Play-verified entitlements")

old_admin_state = '''  const adminEntitlements = result?.data?.adminEntitlements || {};
  const proActive =
    !!adminEntitlements.trainingPro ||
    !!adminEntitlements.nutritionPro ||
    !!adminEntitlements.aiCoachPro;'''
new_admin_state = '''  const adminEntitlements = result?.data?.adminEntitlements || {};
  const verifiedEntitlements = result?.data?.entitlements || {};
  const proActive =
    !!adminEntitlements.trainingPro ||
    !!adminEntitlements.nutritionPro ||
    !!adminEntitlements.aiCoachPro ||
    !!verifiedEntitlements.trainingPro ||
    !!verifiedEntitlements.nutritionPro ||
    !!verifiedEntitlements.aiCoachPro;'''
if old_admin_state in app:
    app = app.replace(old_admin_state, new_admin_state, 1)
    print("Admin Pro status now reflects effective entitlement")

app_path.write_text(app, encoding="utf-8")

# Final assertions: build must ship the canonical Google and language logic.
final_google = google_path.read_text(encoding="utf-8")
if bad_google in final_google:
    raise SystemExit("Google Sign-In integrity check failed after all mutations")

final_app = app_path.read_text(encoding="utf-8")
if "function freshState(language = null)" not in final_app:
    raise SystemExit("Language integrity check failed: freshState signature missing")
fresh_start = final_app.index("function freshState(language = null)")
fresh_end = final_app.index("/* ============================== AUTH + FIRESTORE STORAGE", fresh_start)
fresh_body = final_app[fresh_start:fresh_end]
if "language," not in fresh_body or "language: null" in fresh_body:
    raise SystemExit("Language integrity check failed: freshState language field is not canonical")
