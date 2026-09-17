from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

# Paywall component needs the verified-state setter so a successful server
# verification updates the runtime entitlement immediately, before Firestore
# snapshot reconciliation.
s = s.replace(
    'function PaywallScreen({ data, setData, back, showToast, params = {} }) {',
    'function PaywallScreen({ data, setData, setVerifiedEntitlements, back, showToast, params = {} }) {',
    1,
)

# The root router has several screen components; only modify the Paywall block.
pattern = re.compile(r'content\s*=\s*\(\s*<PaywallScreen\n([\s\S]*?\n\s*back=\{back\})', re.M)
m = pattern.search(s)
if m:
    block = m.group(0)
    if 'setVerifiedEntitlements={setVerifiedEntitlements}' not in block:
        block = block.replace('\n        back={back}', '\n        setVerifiedEntitlements={setVerifiedEntitlements}\n        back={back}', 1)
        s = s[:m.start()] + block + s[m.end():]

# Successful purchase/restore expiry must be normalized without double suffixes.
s = s.replace(
    '      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
    '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription',
    1,
)

# ---------------------------------------------------------------------------
# Missing-profile recovery.
# A Firestore snapshot that does not exist is NOT permission/network failure,
# but it also must not silently become a fresh account and send a returning
# user through onboarding. Preserve any local cached state, surface an explicit
# recovery screen, and make starting from scratch an explicit user action.
# ---------------------------------------------------------------------------
state_anchor = '  const [saveError, setSaveError] = useState(null);\n'
state_patch = '  const [saveError, setSaveError] = useState(null);\n  const [profileMissing, setProfileMissing] = useState(false);\n'
if state_patch not in s:
    if state_anchor not in s:
        raise SystemExit("missing-profile: state anchor not found")
    s = s.replace(state_anchor, state_patch, 1)

# The preceding production-final pass may already have added firestoreEntitlementsRef
# and loadError to this exact reset block. Patch either shape idempotently.
reset_patch = '''      setSaveError(null);
      setProfileMissing(false);
      return;'''
if reset_patch not in s:
    reset_candidates = [
        '''      setNotifications([]);
      verifiedEntitlementsRef.current = null;
      firestoreEntitlementsRef.current = null;
      setLoadError(null);
      return;''',
        '''      setNotifications([]);
      verifiedEntitlementsRef.current = null;
      return;''',
    ]
    matched = False
    for candidate in reset_candidates:
        if candidate in s:
            replacement = candidate.replace(
                '      setNotifications([]);\n',
                '      setNotifications([]);\n',
                1,
            ).replace(
                '      setLoadError(null);\n      return;',
                '      setLoadError(null);\n      setSaveError(null);\n      setProfileMissing(false);\n      return;',
                1,
            )
            replacement = replacement.replace(
                '      verifiedEntitlementsRef.current = null;\n      return;',
                '      verifiedEntitlementsRef.current = null;\n      setSaveError(null);\n      setProfileMissing(false);\n      return;',
                1,
            )
            s = s.replace(candidate, replacement, 1)
            matched = True
            break
    if not matched and reset_patch not in s:
        # As a final structural fallback, anchor on the start of the uid-less branch.
        branch_anchor = '''    if (!uid) {
      setLoaded(false);
      setNotifications([]);'''
        branch_match = s.count(branch_anchor)
        if branch_match != 1:
            raise SystemExit(f"missing-profile: uid reset anchor not found (candidates tried: {branch_match})")
        old = branch_anchor + '''
'''
        new = branch_anchor + '''
      setSaveError(null);
      setProfileMissing(false);'''
        s = s.replace(old, new, 1)

snapshot_anchor = '''      (snap) => {
        const fresh = freshState();
        const parsed = snap.exists() ? snap.data() : {};'''
snapshot_patch = '''      (snap) => {
        const fresh = freshState();
        if (!snap.exists()) {
          setProfileMissing(true);
          setLoaded(true);
          // Preserve an already hydrated local account cache. Do not replace
          // it with freshState() merely because the server document is absent.
          return;
        }
        setProfileMissing(false);
        const parsed = snap.data();'''
if snapshot_patch not in s:
    if snapshot_anchor not in s:
        raise SystemExit("missing-profile: snapshot anchor not found")
    s = s.replace(snapshot_anchor, snapshot_patch, 1)

return_anchor = '      saveError,\n      loadError,\n    );'
return_patch = '      saveError,\n      loadError,\n      profileMissing,\n      clearProfileMissing: () => setProfileMissing(false),\n    );'
if return_patch not in s:
    if return_anchor in s:
        s = s.replace(return_anchor, return_patch, 1)
    else:
        alt = '      loadError,\n    };'
        if alt not in s:
            raise SystemExit("missing-profile: useAppData return anchor not found")
        s = s.replace(alt, '      loadError,\n      profileMissing,\n      clearProfileMissing: () => setProfileMissing(false),\n    };', 1)

# Root router receives the explicit missing-profile state.
destructure_anchor = '''const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError } = useAppData(
'''
destructure_patch = '''const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError, profileMissing, clearProfileMissing } = useAppData(
'''
if destructure_patch not in s:
    if destructure_anchor not in s:
        raise SystemExit("missing-profile: root destructuring anchor not found")
    s = s.replace(destructure_anchor, destructure_patch, 1)

phase_anchor = '''    if (firebaseUser === null) {
      setPhase("welcome");
      return;
    }
    if (loadError && !loaded && !data?.account?.email) {'''
phase_patch = '''    if (firebaseUser === null) {
      setPhase("welcome");
      return;
    }
    if (profileMissing) {
      setPhase("accountRecovery");
      return;
    }
    if (loadError && !loaded && !data?.account?.email) {'''
if phase_patch not in s:
    if phase_anchor not in s:
        raise SystemExit("missing-profile: phase gate anchor not found")
    s = s.replace(phase_anchor, phase_patch, 1)

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

s = s.replace('nameAr: "سمانه",', 'nameAr: "رفع الرجل",', 1)

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
print('paywall + missing-profile recovery + exercise-content hardening applied')
