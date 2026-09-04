from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

# 1) Sanitize Firestore entitlement expiry in the snapshot merge. Expired
# server/admin rows must never reopen Pro after Play restore is empty.
needle = '''        const verified = verifiedEntitlementsRef.current || {};
        const firestore = parsed.entitlements || {};
        const merged = {'''
replacement = '''        const verified = verifiedEntitlementsRef.current || {};
        const firestore = parsed.entitlements || {};
        const firestoreExpiryRaw = firestore.proExpiresAt || null;
        const firestoreExpiryMs = firestoreExpiryRaw
          ? (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(firestoreExpiryRaw))
              ? Date.parse(`${firestoreExpiryRaw}T23:59:59.999`)
              : Date.parse(String(firestoreExpiryRaw)))
          : null;
        const firestoreActive =
          !Number.isFinite(firestoreExpiryMs) || firestoreExpiryMs > Date.now();
        const merged = {'''
if needle in s and replacement not in s:
    s = s.replace(needle, replacement, 1)

s = s.replace(
'''            trainingPro: !!(firestore.trainingPro || verified.trainingPro),
            nutritionPro: !!(firestore.nutritionPro || verified.nutritionPro),
            aiCoachPro: !!(firestore.aiCoachPro || verified.aiCoachPro),
            proExpiresAt: verified.proExpiresAt || firestore.proExpiresAt || null,''',
'''            trainingPro: firestoreActive && !!(firestore.trainingPro || verified.trainingPro),
            nutritionPro: firestoreActive && !!(firestore.nutritionPro || verified.nutritionPro),
            aiCoachPro: firestoreActive && !!(firestore.aiCoachPro || verified.aiCoachPro),
            proExpiresAt: verified.proExpiresAt || (firestoreActive ? firestoreExpiryRaw : null),''', 1)

# 2) Null verified state should also respect Firestore expiry.
old = '''      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          trainingPro: !!fs.trainingPro,
          nutritionPro: !!fs.nutritionPro,
          aiCoachPro: !!fs.aiCoachPro,
          proExpiresAt: fs.proExpiresAt || null,
        },
      }));'''
new = '''      const fs = firestoreEntitlementsRef.current || {};
      const fsExpiryRaw = fs.proExpiresAt || null;
      const fsExpiryMs = fsExpiryRaw
        ? (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(fsExpiryRaw))
            ? Date.parse(`${fsExpiryRaw}T23:59:59.999`)
            : Date.parse(String(fsExpiryRaw)))
        : null;
      const fsActive = !Number.isFinite(fsExpiryMs) || fsExpiryMs > Date.now();
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          trainingPro: fsActive && !!fs.trainingPro,
          nutritionPro: fsActive && !!fs.nutritionPro,
          aiCoachPro: fsActive && !!fs.aiCoachPro,
          proExpiresAt: fsActive ? fsExpiryRaw : null,
        },
      }));'''
if old in s and new not in s:
    s = s.replace(old, new, 1)

# 3) Make sure the Play success expiry is preserved in local state and the
# verified setter is actually passed to PaywallScreen.
if 'function PaywallScreen({ data, setData, setVerifiedEntitlements,' not in s:
    s = s.replace(
        'function PaywallScreen({ data, setData, back, showToast, params = {} }) {',
        'function PaywallScreen({ data, setData, setVerifiedEntitlements, back, showToast, params = {} }) {',
        1,
    )

route = re.compile(r'(content\s*=\s*\(\s*<PaywallScreen\n)([\s\S]*?)(\n\s*back=\{back\})', re.M)
m = route.search(s)
if m:
    block = m.group(0)
    if 'setVerifiedEntitlements={setVerifiedEntitlements}' not in block:
        block = block.replace('\n        back={back}', '\n        setVerifiedEntitlements={setVerifiedEntitlements}\n        back={back}', 1)
        s = s[:m.start()] + block + s[m.end():]

# 4) Successful Play purchase must retain server expiry even if a legacy
# post-success state assignment tries to clear it.
s = s.replace(
    '      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
    '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription',
    1,
)

# 5) Expiry watchdog: lock verified Pro immediately after its actual expiry,
# while leaving unexpired Firestore/admin access intact.
watch_marker = '/* FIFTYFIT_PRO_EXPIRY_WATCHDOG_V1 */'
if watch_marker not in s:
    anchor = '  const showToast = useCallback((msg, duration = 2200) => {'
    watchdog = '''  /* FIFTYFIT_PRO_EXPIRY_WATCHDOG_V1 */
  useEffect(() => {
    const check = () => {
      const expiry = data.entitlements?.proExpiresAt;
      if (!expiry) return;
      const raw = String(expiry).trim();
      const ms = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw)
        ? Date.parse(`${raw}T23:59:59.999`)
        : Date.parse(raw);
      if (Number.isFinite(ms) && ms <= Date.now()) {
        setVerifiedEntitlements(null);
      }
    };
    check();
    const timer = window.setInterval(check, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [data.entitlements?.proExpiresAt, setVerifiedEntitlements]);

'''
    if anchor in s:
        s = s.replace(anchor, watchdog + anchor, 1)

# Stable source marker for CI verification.
if 'FIFTYFIT_STABILITY_FIXUPS_V1' not in s:
    s = '/* FIFTYFIT_STABILITY_FIXUPS_V1 */\n' + s

p.write_text(s, encoding='utf-8')
print('stability fixups applied')
