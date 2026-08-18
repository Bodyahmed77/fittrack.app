from pathlib import Path

# The legacy/deep runtime mutation script historically rewrote the Google
# Sign-In error-10 branch to retry through the legacy chooser. That is unsafe:
# DEVELOPER_ERROR is a configuration failure and retrying the same native
# configuration only discards the useful diagnostic and produces a second,
# confusing failure. Keep this small integrity guard immediately after the
# existing postinstall mutations until those legacy mutation scripts are
# retired completely.

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
# Language persistence: Google-created accounts must persist the
# language selected before account creation. The committed freshState()
# historically ignored the localLang argument supplied by googleAuth.js.
# Keep the transformation deterministic and idempotent until the legacy
# runtime mutation chain is retired and this logic becomes normal source.
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
    app_path.write_text(app, encoding="utf-8")
    print("freshState() now persists the supplied language")
else:
    app_path.write_text(app, encoding="utf-8")
    print("freshState() language persistence already correct")

# Verify the final build-time source state has both protections.
final_app = app_path.read_text(encoding="utf-8")
if "function freshState(language = null)" not in final_app:
    raise SystemExit("Language integrity check failed: freshState language signature missing")

fresh_start = final_app.index("function freshState(language = null)")
fresh_end = final_app.index("/* ============================== AUTH + FIRESTORE STORAGE", fresh_start)
fresh_body = final_app[fresh_start:fresh_end]
if "language," not in fresh_body or "language: null" in fresh_body:
    raise SystemExit("Language integrity check failed: freshState language field is not canonical")
