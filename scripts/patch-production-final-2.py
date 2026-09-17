from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"production-final-2: {label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# Paywall component needs the verified-state setter so a successful server
# verification updates the runtime entitlement immediately.
s = replace_once(s, 'function PaywallScreen({ data, setData, back, showToast, params = {} }) {', 'function PaywallScreen({ data, setData, setVerifiedEntitlements, back, showToast, params = {} }) {', "paywall component signature")

pattern = re.compile(r'content\s*=\s*\(\s*<PaywallScreen\n([\s\S]*?\n\s*back=\{back\})', re.M)
m = pattern.search(s)
if m and 'setVerifiedEntitlements={setVerifiedEntitlements}' not in m.group(0):
    block = m.group(0).replace('\n        back={back}', '\n        setVerifiedEntitlements={setVerifiedEntitlements}\n        back={back}', 1)
    s = s[:m.start()] + block + s[m.end():]

s = s.replace('      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription', '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription', 1)

# Missing-profile recovery: do not silently convert a missing remote profile
# into a new onboarding state.
if 'const [profileMissing, setProfileMissing] = useState(false);' not in s:
    s = replace_once(s, '  const [saveError, setSaveError] = useState(null);\n', '  const [saveError, setSaveError] = useState(null);\n  const [profileMissing, setProfileMissing] = useState(false);\n', "missing-profile state")

if 'setProfileMissing(false);' not in s:
    candidates = [
        '''      firestoreEntitlementsRef.current = null;
      setLoadError(null);
      return;''',
        '''      verifiedEntitlementsRef.current = null;
      setLoadError(null);
      return;''',
        '''      verifiedEntitlementsRef.current = null;
      return;''',
    ]
    for candidate in candidates:
        if candidate in s:
            s = s.replace(candidate, candidate.replace('      return;', '      setSaveError(null);\n      setProfileMissing(false);\n      return;', 1), 1)
            break

snapshot_anchor = '''      (snap) => {
        const fresh = freshState();
        const parsed = snap.exists() ? snap.data() : {};'''
snapshot_patch = '''      (snap) => {
        const fresh = freshState();
        if (!snap.exists()) {
          setProfileMissing(true);
          setLoaded(true);
          // Preserve already-hydrated local state. A missing remote document
          // must never silently masquerade as a brand-new account.
          return;
        }
        setProfileMissing(false);
        const parsed = snap.data();'''
if snapshot_patch not in s:
    if snapshot_anchor not in s:
        raise SystemExit("missing-profile: snapshot anchor not found")
    s = s.replace(snapshot_anchor, snapshot_patch, 1)

# Extend useAppData return contract.
if 'clearProfileMissing: () => setProfileMissing(false)' not in s:
    return_pattern = re.compile(r'(return\s*\{\s*data,\s*setData,\s*setVerifiedEntitlements,\s*loaded,\s*notifications,\s*writePending,\s*saveError)(,\s*loadError)?(\s*\};)', re.S)
    rm = return_pattern.search(s)
    if not rm:
        raise SystemExit("missing-profile: useAppData return anchor not found")
    suffix = rm.group(2) or ''
    separator = ', ' if suffix else ''
    replacement = rm.group(1) + suffix + separator + 'profileMissing, clearProfileMissing: () => setProfileMissing(false)' + rm.group(3)
    s = s[:rm.start()] + replacement + s[rm.end():]

# Root router gets the recovery state and phase gate. This block is deliberately
# tolerant of prior router formatting changes.
if 'profileMissing, clearProfileMissing' not in s:
    root_start = s.find('export default function GymApp()')
    if root_start < 0:
        raise SystemExit("missing-profile: app root anchor not found")
    hook_idx = s.find('useAppData(', root_start)
    if hook_idx < 0:
        raise SystemExit("missing-profile: app root useAppData call not found")
    destructure_start = s.rfind('const {', root_start, hook_idx)
    destructure_end = s.find('} = useAppData(', destructure_start)
    if destructure_start < 0 or destructure_end < 0:
        raise SystemExit("missing-profile: root destructuring not found")
    block = s[destructure_start:destructure_end + 1]
    if 'profileMissing' not in block:
        block_new = block.replace('loadError', 'loadError, profileMissing, clearProfileMissing')
        if block_new == block:
            block_new = block[:-1] + ', profileMissing, clearProfileMissing }'
        s = s[:destructure_start] + block_new + s[destructure_end + 1:]

if 'setPhase("accountRecovery")' not in s:
    root_start = s.find('export default function GymApp()')
    branch = re.search(r'(\n\s*)if\s*\(firebaseUser\s*===\s*null\)\s*\{\s*setPhase\(["\']welcome["\']\);\s*return;\s*\}', s[root_start:], re.S)
    if not branch:
        raise SystemExit("missing-profile: signed-out phase branch not found")
    absolute_end = root_start + branch.end()
    indent = branch.group(1)
    insertion = f'{indent}if (profileMissing) {{\n{indent}  setPhase("accountRecovery");\n{indent}  return;\n{indent}}}'
    s = s[:absolute_end] + insertion + s[absolute_end:]

marker = '  let authScreen = null;\n'
recovery_screen = '''  if (phase === "accountRecovery") {
    return (
      <UIContext.Provider value={{ C, lang }}>
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>↩️</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              {lang === "ar" ? "حسابك محتاج استرجاع" : "Account recovery needed"}
            </div>
            <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.65, marginTop: 10 }}>
              {lang === "ar"
                ? "لم نجد ملف التقدم المرتبط بالحساب المسجل حاليًا. بياناتك القديمة لم يتم حذفها. سجّل بالحساب الذي استخدمته سابقًا، أو ابدأ حسابًا جديدًا بشكل صريح."
                : "We could not find the progress profile for the account currently signed in. Your old data was not deleted. Sign in with your previous account, or explicitly start a new profile."}
            </div>
            {firebaseUser?.email ? (
              <div style={{ marginTop: 12, color: C.text, fontSize: 12, fontWeight: 700, wordBreak: "break-word" }}>
                {firebaseUser.email}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
              <GreenButton
                onClick={() => {
                  clearProfileMissing?.();
                  setPhase("onboarding");
                }}
              >
                {lang === "ar" ? "ابدأ كحساب جديد" : "Start as a new account"}
              </GreenButton>
              <button
                type="button"
                onClick={() => signOut(auth)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 13, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                {lang === "ar" ? "تسجيل الخروج واستخدام حساب آخر" : "Sign out and use another account"}
              </button>
            </div>
          </div>
        </div>
      </UIContext.Provider>
    );
  }

'''
if 'Account recovery needed' not in s:
    if marker not in s:
        raise SystemExit("missing-profile: recovery screen marker not found")
    s = s.replace(marker, recovery_screen + marker, 1)

# Content correction found during exercise audit.
s = s.replace('nameAr: "سمانه",', 'nameAr: "رفع الرجل",', 1)

# Robust expiry countdown for date-only and timestamp values.
old_days = '''function daysUntil(iso) {
  if (!iso) return 0;
  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}'''
new_days = '''function daysUntil(iso) {
  if (!iso) return 0;
  const raw = String(iso).trim();
  const ms = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw)
    ? Date.parse(`${raw}T23:59:59.999`)
    : Date.parse(raw);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / 86400000));
}'''
if new_days not in s and old_days in s:
    s = s.replace(old_days, new_days, 1)

if 'FIFTYFIT_PAYWALL_WIRING_V1' not in s:
    s = '/* FIFTYFIT_PAYWALL_WIRING_V1 */\n' + s
if 'FIFTYFIT_ACCOUNT_RECOVERY_V1' not in s:
    s = '/* FIFTYFIT_ACCOUNT_RECOVERY_V1 */\n' + s

p.write_text(s, encoding="utf-8")
print("paywall + missing-profile recovery + exercise-content hardening applied")
