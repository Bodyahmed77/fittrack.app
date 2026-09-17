from pathlib import Path

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

# patch-production-final introduces loadError state but the original hook return
# does not expose it. Add it before patch-production-final-2 needs to extend the
# return contract with profile-missing recovery metadata.
old = '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError };'
new = '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError, loadError };'
if new not in s:
    if old not in s:
        raise SystemExit("load-error-return: useAppData return anchor not found")
    s = s.replace(old, new, 1)

if "/* FIFTYFIT_LOAD_ERROR_RETURN_V1 */" not in s:
    s = "/* FIFTYFIT_LOAD_ERROR_RETURN_V1 */\n" + s

p.write_text(s, encoding="utf-8")
print("load error return contract applied")
