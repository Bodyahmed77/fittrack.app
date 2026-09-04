from pathlib import Path
import re

APP = Path("src/App.jsx")


def require_replace(s, old, new, label):
    if new in s:
        return s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"production-final: {label}: expected 1 match, found {n}")
    return s.replace(old, new, 1)


def patch(s):
    # Preserve server-verified and Firestore/admin entitlement sources separately.
    s = require_replace(
        s,
        '  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
        '''  const verifiedEntitlementsRef = useRef(null);
  const firestoreEntitlementsRef = useRef(null);
  const latestLocalWriteAtRef = useRef(null);
  const [loadError, setLoadError] = useState(null);''',
        "state refs",
    )

    # Reset source refs when auth identity changes.
    s = require_replace(
        s,
        '      setNotifications([]);\n      verifiedEntitlementsRef.current = null;\n      return;',
        '''      setNotifications([]);
      verifiedEntitlementsRef.current = null;
      firestoreEntitlementsRef.current = null;
      setLoadError(null);
      return;''',
        "uid reset",
    )

    # Do not treat a failed Firestore read as a successful empty account.
    s = require_replace(
        s,
        '      (err) => {\n        console.error("Firestore read failed", err);\n        setLoaded(true);\n      },',
        '''      (err) => {
        console.error("Firestore read failed", err);
        setLoadError({ code: String(err?.code || "firestore_read_failed") });
        setLoaded(false);
      },''',
        "Firestore error handling",
    )

    # The snapshot must preserve Firestore/admin entitlements and a successful
    # Play verification at the same time. Expired Firestore entitlements are closed.
    old_merge = '''        const merged = {
          ...fresh,
          ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },
          customPlan: parsed.customPlan || {},'''
    new_merge = '''        firestoreEntitlementsRef.current = {
          ...fresh.entitlements,
          ...(parsed.entitlements || {}),
        };
        setLoadError(null);
        const firestore = parsed.entitlements || {};
        const verified = verifiedEntitlementsRef.current || {};
        const expiryRaw = firestore.proExpiresAt || verified.proExpiresAt || null;
        const expiryMs = expiryRaw
          ? (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(expiryRaw))
              ? Date.parse(`${expiryRaw}T23:59:59.999`)
              : Date.parse(String(expiryRaw)))
          : null;
        const active = !Number.isFinite(expiryMs) || expiryMs > Date.now();
        const merged = {
          ...fresh,
          ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: {
            trainingPro: active && !!(firestore.trainingPro || verified.trainingPro),
            nutritionPro: active && !!(firestore.nutritionPro || verified.nutritionPro),
            aiCoachPro: active && !!(firestore.aiCoachPro || verified.aiCoachPro),
            proExpiresAt: active ? expiryRaw : null,
          },
          customPlan: parsed.customPlan || {},'''
    if new_merge not in s:
        s = require_replace(s, old_merge, new_merge, "entitlement merge")

    # Protect the Play-owned fields from ordinary profile/workout writes.
    s = require_replace(
        s,
        '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );
      verifiedEntitlementsRef.current = next.entitlements;''',
        '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan" &&
            key !== "entitlements",
        ),
      );''',
        "safe profile persistence",
    )

    # A verified entitlement update must merge, not erase another Pro product.
    old_verified = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
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
    new_verified = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
    if (!entitlements) {
      verifiedEntitlementsRef.current = null;
      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          trainingPro: !!fs.trainingPro,
          nutritionPro: !!fs.nutritionPro,
          aiCoachPro: !!fs.aiCoachPro,
          proExpiresAt: fs.proExpiresAt || null,
        },
      }));
      return;
    }
    const previous = verifiedEntitlementsRef.current || {};
    const nextVerified = {
      nutritionPro: entitlements.nutritionPro === undefined ? !!previous.nutritionPro : !!entitlements.nutritionPro,
      trainingPro: entitlements.trainingPro === undefined ? !!previous.trainingPro : !!entitlements.trainingPro,
      aiCoachPro: entitlements.aiCoachPro === undefined ? !!previous.aiCoachPro : !!entitlements.aiCoachPro,
      proExpiresAt: entitlements.proExpiresAt ?? previous.proExpiresAt ?? null,
    };
    verifiedEntitlementsRef.current = nextVerified;
    const fs = firestoreEntitlementsRef.current || {};
    setDataRaw((current) => ({
      ...current,
      entitlements: {
        trainingPro: !!(fs.trainingPro || nextVerified.trainingPro),
        nutritionPro: !!(fs.nutritionPro || nextVerified.nutritionPro),
        aiCoachPro: !!(fs.aiCoachPro || nextVerified.aiCoachPro),
        proExpiresAt: nextVerified.proExpiresAt || fs.proExpiresAt || null,
      },
    }));
  }, []);'''
    s = require_replace(s, old_verified, new_verified, "verified entitlement setter")

    # Root route: loading failure is a retryable data-sync state, never onboarding.
    s = require_replace(
        s,
        '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(\n',
        '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError } = useAppData(\n',
        "root hook destructuring",
    )
    s = require_replace(
        s,
        '    if (!loaded || writePending) return;\n    if (saveError) return;',
        '''    if (loadError) {
      setPhase("dataError");
      return;
    }
    if (!loaded || writePending) return;
    if (saveError) return;''',
        "root data gate",
    )

    # Empty Play restore must not erase a valid admin/Firestore entitlement.
    s = require_replace(
        s,
        '''        if (!records.length) {
          // An empty real Play query means there are no active purchases.
          // Preview/unsupported results are not authoritative and must not wipe offline state.
          if (result?.preview || result?.unsupported) return;
          setVerifiedEntitlements({
            trainingPro: false,
            nutritionPro: false,
            aiCoachPro: false,
            proExpiresAt: null,
          });
          return;
        }''',
        '''        if (!records.length) {
          if (result?.preview || result?.unsupported) return;
          setVerifiedEntitlements(null);
          return;
        }''',
        "empty Play restore",
    )

    # Capture real expiry from the backend during automatic restore.
    auto_old = '''            await registerServerEntitlement(
              rec.productId,
              rec.productId,
              rec.result,
            );'''
    auto_new = '''            const verifiedRestore = await registerServerEntitlement(
              rec.productId,
              rec.productId,
              rec.result,
            );
            if (verifiedRestore?.expiresAt) {
              activated.proExpiresAt =
                !activated.proExpiresAt || Date.parse(verifiedRestore.expiresAt) > Date.parse(activated.proExpiresAt)
                  ? verifiedRestore.expiresAt
                  : activated.proExpiresAt;
            }'''
    # This appears in the root auto-restore and may have a second restore loop.
    if auto_new not in s:
        if auto_old in s:
            s = s.replace(auto_old, auto_new, 1)

    # Paywall: use actual server expiry immediately after verification.
    s = require_replace(
        s,
        '''          await registerServerEntitlement(
            productKey,
            result?.productId || productKey,
            result?.result,
          );''',
        '''          const serverVerification = await registerServerEntitlement(
            productKey,
            result?.productId || productKey,
            result?.result,
          );
          setVerifiedEntitlements({
            trainingPro: planId === "training" || planId === "both",
            nutritionPro: planId === "nutrition" || planId === "both",
            aiCoachPro: planId === "ai",
            proExpiresAt: serverVerification?.expiresAt || null,
          });''',
        "purchase verification",
    )
    s = s.replace(
        '      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
        '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription',
        1,
    )

    # Stable expiry countdown across date-only and ISO timestamps.
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
    if new_days not in s:
        s = require_replace(s, old_days, new_days, "daysUntil")

    # Retryable error page.
    marker = '  let authScreen = null;\n'
    screen = '''  if (phase === "dataError") {
    return (
      <UIContext.Provider value={{ C, lang }}>
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>
            <RefreshCcw size={42} color={C.green} style={{ marginBottom: 16 }} />
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {lang === "ar" ? "تعذر تحميل بيانات حسابك" : "Couldn’t load your account"}
            </div>
            <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>
              {lang === "ar" ? "بياناتك لم يتم استبدالها بحساب جديد. حاول المزامنة مرة أخرى." : "Your account was not replaced with a new one. Retry the account sync."}
            </div>
            <div style={{ marginTop: 20 }}>
              <GreenButton onClick={() => window.location.reload()}>
                {lang === "ar" ? "إعادة المحاولة" : "Retry"}
              </GreenButton>
            </div>
          </div>
        </div>
      </UIContext.Provider>
    );
  }

'''
    if screen not in s:
        s = require_replace(s, marker, screen + marker, "data error screen")

    # Ensure a common Pro expiry watchdog always runs.
    if 'FIFTYFIT_PRO_EXPIRY_WATCHDOG_V2' not in s:
        anchor = '  const showToast = useCallback((msg, duration = 2200) => {'
        watchdog = '''  /* FIFTYFIT_PRO_EXPIRY_WATCHDOG_V2 */
  useEffect(() => {
    const check = () => {
      const expiry = String(data.entitlements?.proExpiresAt || "").trim();
      if (!expiry) return;
      const ms = /^\\d{4}-\\d{2}-\\d{2}$/.test(expiry)
        ? Date.parse(`${expiry}T23:59:59.999`)
        : Date.parse(expiry);
      if (Number.isFinite(ms) && ms <= Date.now()) {
        setVerifiedEntitlements(null);
      }
    };
    check();
    const timer = window.setInterval(check, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [data.entitlements?.proExpiresAt, setVerifiedEntitlements]);

'''
        s = require_replace(s, anchor, watchdog + anchor, "expiry watchdog")

    if 'FIFTYFIT_PRODUCTION_FINAL_V1' not in s:
        s = '/* FIFTYFIT_PRODUCTION_FINAL_V1 */\n' + s
    return s


if __name__ == '__main__':
    s = APP.read_text(encoding='utf-8')
    APP.write_text(patch(s), encoding='utf-8')
    print('production final hardening applied')
