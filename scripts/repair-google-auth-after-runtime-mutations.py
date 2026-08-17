from pathlib import Path

# The legacy/deep runtime mutation script historically rewrote the Google
# Sign-In error-10 branch to retry through the legacy chooser. That is unsafe:
# DEVELOPER_ERROR is a configuration failure and retrying the same native
# configuration only discards the useful diagnostic and produces a second,
# confusing failure. Keep this small integrity guard immediately after the
# existing postinstall mutations until those legacy mutation scripts are
# retired completely.
path = Path("src/googleAuth.js")
text = path.read_text(encoding="utf-8")

bad = 'if (!isNoCredentialError(mapped) && mapped?.code !== "developer_error") {'
good = 'if (!isNoCredentialError(mapped)) {'

if bad in text:
    text = text.replace(bad, good, 1)
    path.write_text(text, encoding="utf-8")
    print("Restored Google Sign-In DEVELOPER_ERROR fail-fast behavior")
else:
    print("Google Sign-In DEVELOPER_ERROR branch already correct")

# Integrity check: Error 10 must never be routed to the legacy chooser.
if bad in text:
    raise SystemExit("Google Sign-In integrity check failed: developer_error fallback still present")

required = 'if (!isNoCredentialError(mapped)) {'
if required not in text:
    raise SystemExit("Google Sign-In integrity check failed: canonical no-credential branch missing")
