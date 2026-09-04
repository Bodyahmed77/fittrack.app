from pathlib import Path
import re

APP = Path("src/App.jsx")


def once(s, old, new, label):
    if new in s:
        return s
    if old not in s:
        raise SystemExit(f"reliability: missing anchor: {label}")
    return s.replace(old, new, 1)


def patch_timeout(s):
    # The older production patch injected a timeout that force-released the
    # data gate and could incorrectly route an authenticated user into
    # onboarding after a transient Firestore failure. Keep a timeout for
    # diagnostics, but make it produce a recoverable load error instead.
    if "FIFTYFIT_BOOT_TIMEOUT_V1" not in s:
        return s
    pattern = re.compile(
        r'  // FIFTYFIT_BOOT_TIMEOUT_V1: Firestore/auth recovery must never leave the\n'
        r'  // customer on an infinite splash screen\.[\s\S]*?\n  }, \[\]\);'
    )
    replacement = '''  // FIFTYFIT_BOOT_TIMEOUT_V2: a slow backend must show a retryable
  // sync error, never pretend the authenticated document loaded successfully.
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      setLoadError((current) => current || {
        code: "firestore_timeout",
        elapsedMs: Date.now() - startedAt,
      });
    }, 15000);
    return () => clearTimeout(timer);
  }, []);'''
    out, count = pattern.subn(replacement, s, count=1)
    if count != 1:
        raise SystemExit("reliability: boot timeout block not replaced")
    return out


def patch_helpers(s):
    marker = 'function useAppData(uid) {'
    helpers = r'''const USER_BACKUP_PREFIX = "fiftyfit-user-backup-v2:";

function userBackupKey(uid) {
  return `${USER_BACKUP_PREFIX}${uid}`;
}

function makeLocalBackup(uid, value) {
  if (!uid || !value || typeof value !== "object") return;
  try {
    const copy = clone(value);
    // Never persist Play-verified entitlements in local backup storage.
    // Those are server-verified runtime state and must be revalidated.
    copy.entitlements = {
      ...(freshState().entitlements || {}),
      ...(value?.entitlements || {}),
      trainingPro: false,
      nutritionPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
    };
    // Admin-only/server-only authorization fields must never be trusted from
    // the local resilience cache.
    delete copy.adminEntitlements;
    if (copy.account?.photo && String(copy.account.photo).length > 250000) {
      copy.account.photo = "";
    }
    localStorage.setItem(userBackupKey(uid), JSON.stringify({
      savedAt: new Date().toISOString(),
      data: copy,
    }));
  } catch (_) {}
}

function readLocalBackup(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(userBackupKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || typeof parsed.data !== "object") return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function expiryTimeMs(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ms = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59.999`).getTime()
    : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function entitlementStillActive(value) {
  const ms = expiryTimeMs(value);
  return ms == null ? null : ms > Date.now();
}

'''
    return once(s, marker, helpers + marker, "backup helpers")


def patch_use_app_data(s):
    s = once(
        s,
        '  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
        '  const verifiedEntitlementsRef = useRef(null);\n  const firestoreEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);\n  const writeQueueRef = useRef(Promise.resolve());\n  const [loadError, setLoadError] = useState(null);',
        "useAppData refs",
    )
    s = once(
        s,
        '      setNotifications([]);\n      verifiedEntitlementsRef.current = null;\n      return;',
        '''      setNotifications([]);
      verifiedEntitlementsRef.current = null;
      firestoreEntitlementsRef.current = null;
      writeQueueRef.current = Promise.resolve();
      setLoadError(null);
      return;''',
        "uid reset refs",
    )
    s = once(
        s,
        '    setLoaded(false);\n    setSaveError(null);\n    latestLocalWriteAtRef.current = readWriteWatermark(uid) || null;',
        '''    setLoaded(false);
    setSaveError(null);
    setLoadError(null);
    latestLocalWriteAtRef.current = readWriteWatermark(uid) || null;

    const localBackup = readLocalBackup(uid);
    if (localBackup) {
      // Immediate resilient UI for upgrades/restarts when the Firestore read
      // is slow. Pro is intentionally stripped and will be restored only by
      // a fresh server/Play verification.
      setDataRaw({
        ...freshState(),
        ...localBackup,
        entitlements: { ...freshState().entitlements },
      });
      setLoaded(true);
    }''',
        "local backup bootstrap",
    )
    s = once(
        s,
        '        const parsed = snap.exists() ? snap.data() : {};\n        const snapUpdatedAt = String(parsed.updatedAt || "");',
        '''        const parsed = snap.exists() ? snap.data() : {};
        const fresh = freshState();
        firestoreEntitlementsRef.current = {
          ...fresh.entitlements,
          ...(parsed.entitlements || {}),
        };
        setLoadError(null);
        const snapUpdatedAt = String(parsed.updatedAt || "");''',
        "snapshot entitlement source",
    )
    # Older code declares fresh immediately after parsed; avoid duplicate.
    s = s.replace('        const fresh = freshState();\n        const parsed = snap.exists() ? snap.data() : {};\n        const fresh = freshState();\n',
                  '        const fresh = freshState();\n        const parsed = snap.exists() ? snap.data() : {};\n', 1)
    # Merge actual Firestore entitlements before the verified runtime overlay.
    s = s.replace('          entitlements: {\n            ...fresh.entitlements,\n            ...(verifiedEntitlementsRef.current || {}),\n          },',
                  '          entitlements: {\n            ...fresh.entitlements,\n            ...(parsed.entitlements || {}),\n            ...(verifiedEntitlementsRef.current || {}),\n          },', 1)
    s = once(
        s,
        '        setDataRaw(merged);\n        setLoaded(true);',
        '''        setDataRaw(merged);
        persistWriteWatermark(uid, merged.updatedAt || snapUpdatedAt || "");
        makeLocalBackup(uid, merged);
        setLoaded(true);''',
        "snapshot backup",
    )
    # Error callback: use backup if available; otherwise expose retryable load error.
    s = once(
        s,
        '        console.error("Firestore read failed", err);\n        setLoaded(true);',
        '''        console.error("Firestore read failed", err);
        const backup = readLocalBackup(uid);
        if (backup) {
          setDataRaw({
            ...freshState(),
            ...backup,
            entitlements: { ...freshState().entitlements },
          });
          setLoadError(null);
          setLoaded(true);
        } else {
          setLoadError({ code: "firestore_read_failed" });
          setLoaded(false);
        }''',
        "Firestore error handling",
    )

    # Prevent normal user writes from ever attempting to mutate server-owned
    # Play entitlements. Keep a serialized queue so rapid set toggles cannot
    # race and overwrite each other on slower/older devices.
    old = '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan",
        ),
      );'''
    new = '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan" &&
            key !== "entitlements",
        ),
      );
      // Firestore owns admin/local entitlements; Play entitlements are kept
      // only in verifiedEntitlementsRef and injected into runtime state.
      persisted.entitlements =
        firestoreEntitlementsRef.current || freshState().entitlements;'''
    s = once(s, old, new, "safe persisted payload")
    # Do not replace the verified runtime state with arbitrary caller data.
    s = s.replace('      verifiedEntitlementsRef.current = next.entitlements;\n',
                  '      verifiedEntitlementsRef.current = {\n        ...(verifiedEntitlementsRef.current || {}),\n        ...(next.entitlements || {}),\n      };\n', 1)
    # Replace direct setDoc call with queue logic; preserve current optimistic state.
    old_block = '''      try {
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt },
          { merge: true },
        );
        persistWriteWatermark(uid, updatedAt);
        setWritePending(false);
        return true;
      } catch (e) {
        setDataRaw(previous);
        setSaveError(e);
        setWritePending(false);
        console.error("Firestore write failed", e);
        return false;
      }'''
    new_block = '''      makeLocalBackup(uid, { ...next, entitlements: persisted.entitlements });
      const queuedWrite = writeQueueRef.current
        .catch(() => {})
        .then(async () => {
          await setDoc(
            doc(db, "users", uid),
            { ...persisted, updatedAt },
            { merge: true },
          );
          persistWriteWatermark(uid, updatedAt);
          makeLocalBackup(uid, { ...next, entitlements: persisted.entitlements });
          return true;
        });
      writeQueueRef.current = queuedWrite;
      try {
        await queuedWrite;
        setSaveError(null);
        return true;
      } catch (e) {
        setSaveError(e);
        console.error("Firestore write failed", e);
        return false;
      } finally {
        if (writeQueueRef.current === queuedWrite) {
          setWritePending(false);
        }
      }'''
    if old_block not in s:
        # Keep source resilient across the two known variants.
        alt = re.compile(r'      try \{\n        await setDoc\([\s\S]*?        return false;\n      \}', re.M)
        m = alt.search(s)
        if not m:
            raise SystemExit("reliability: setData write block not found")
        s = s[:m.start()] + new_block + s[m.end():]
    else:
        s = s.replace(old_block, new_block, 1)

    s = s.replace('  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError };',
                  '  return { data, setData, setVerifiedEntitlements, loaded, notifications, writePending, saveError, loadError };', 1)
    return s


def patch_verified_setter(s):
    old = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
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
    new = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
    if (!entitlements) {
      verifiedEntitlementsRef.current = null;
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          ...(firestoreEntitlementsRef.current || current.entitlements || freshState().entitlements),
        },
      }));
      return;
    }
    const expiry = entitlements?.proExpiresAt || null;
    const active = entitlementStillActive(expiry);
    const normalized = {
      nutritionPro: active === false ? false : !!entitlements?.nutritionPro,
      trainingPro: active === false ? false : !!entitlements?.trainingPro,
      aiCoachPro: active === false ? false : !!entitlements?.aiCoachPro,
      proExpiresAt: active === false ? null : expiry,
    };
    verifiedEntitlementsRef.current = normalized;
    setDataRaw((current) => ({
      ...current,
      entitlements: normalized,
    }));
  }, []);'''
    return once(s, old, new, "verified entitlement setter")


def patch_root(s):
    s = once(
        s,
        '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(',
        '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError } = useAppData(',
        "root useAppData destructure",
    )
    s = once(
        s,
        '    if (!loaded || writePending) return;\n    if (saveError) return;',
        '''    if (loadError) {
      setPhase("dataError");
      return;
    }
    if (!loaded || writePending) return;
    if (saveError) return;''',
        "root load error gate",
    )
    # Replace the no-purchase verified-clear path with a no-op; Firestore/admin
    # state remains intact and expired Play state is removed by expiry timer.
    s = s.replace('''          setVerifiedEntitlements({
            trainingPro: false,
            nutritionPro: false,
            aiCoachPro: false,
            proExpiresAt: null,
          });
          return;''',
                  '''          // No active Play purchase: do not overwrite Firestore/admin
          // entitlements here. A verified Play overlay expires independently.
          setVerifiedEntitlements(null);
          return;''', 1)
    # Add expiry watchdog just after language/persist setup block.
    anchor = '  useEffect(() => {\n    const open = () => setAiDrawerOpen(true);'
    expiry = '''  useEffect(() => {
    const checkExpiry = () => {
      const expiry = data.entitlements?.proExpiresAt;
      if (expiry && entitlementStillActive(expiry) === false) {
        setVerifiedEntitlements({
          trainingPro: false,
          nutritionPro: false,
          aiCoachPro: false,
          proExpiresAt: null,
        });
      }
    };
    checkExpiry();
    const timer = window.setInterval(checkExpiry, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [data.entitlements?.proExpiresAt, setVerifiedEntitlements]);

'''
    s = once(s, anchor, expiry + anchor, "expiry watchdog")
    # Add dataError render before auth screens.
    auth_anchor = '  let authScreen = null;\n'
    error_screen = '''  if (phase === "dataError") {
    return (
      <UIContext.Provider value={ui}>
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{
            minHeight: "100vh",
            background: C.bg,
            color: C.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>
            <RefreshCcw size={44} color={C.green} style={{ marginBottom: 16 }} />
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {lang === "ar" ? "محتاجين نزامن حسابك" : "We need to sync your account"}
            </div>
            <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>
              {lang === "ar"
                ? "بياناتك محفوظة، لكن الاتصال بقاعدة البيانات اتأخر. حاول مرة تانية بدل ما نعتبرك مستخدم جديد."
                : "Your data is safe, but the account sync is taking too long. Retry instead of treating this as a new account."}
            </div>
            <div style={{ marginTop: 20 }}>
              <GreenButton onClick={() => window.location.reload()}>
                {lang === "ar" ? "إعادة المحاولة" : "Retry sync"}
              </GreenButton>
            </div>
          </div>
        </div>
      </UIContext.Provider>
    );
  }

'''
    s = once(s, auth_anchor, error_screen + auth_anchor, "data error screen")
    # Ensure Paywall receives setter.
    s = s.replace('''        data={data}
        setData={setData}
        back={back}''', '''        data={data}
        setData={setData}
        setVerifiedEntitlements={setVerifiedEntitlements}
        back={back}''', 1)
    return s


def patch_days(s):
    old = '''function daysUntil(iso) {
  if (!iso) return 0;
  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}'''
    new = '''function daysUntil(iso) {
  const ms = expiryTimeMs(iso);
  if (ms == null) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / 86400000));
}'''
    return once(s, old, new, "daysUntil")


def patch_paywall(s):
    s = s.replace('function PaywallScreen({ data, setData, back, showToast, params = {} }) {',
                  'function PaywallScreen({ data, setData, setVerifiedEntitlements, back, showToast, params = {} }) {', 1)
    old = '''          await registerServerEntitlement(
            productKey,
            result?.productId || productKey,
            result?.result,
          );'''
    new = '''          const serverVerification = await registerServerEntitlement(
            productKey,
            result?.productId || productKey,
            result?.result,
          );
          setVerifiedEntitlements({
            trainingPro: planId === "training" || planId === "both",
            nutritionPro: planId === "nutrition" || planId === "both",
            aiCoachPro: planId === "ai",
            proExpiresAt: serverVerification?.expiresAt || null,
          });'''
    s = once(s, old, new, "purchase server verification")
    # Stop wiping the verified expiry immediately after successful purchase.
    s = s.replace('      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
                  '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription', 1)
    # Capture server verification in manual restore loop.
    old_restore = '''          await registerServerEntitlement(
            rec.productId,
            rec.productId,
            rec.result,
          );
          if (rec.planId && !activatedPlans.includes(rec.planId)) {'''
    new_restore = '''          const restored = await registerServerEntitlement(
            rec.productId,
            rec.productId,
            rec.result,
          );
          if (restored?.expiresAt) {
            restoredExpiryAt = restoredExpiryAt
              ? new Date(restoredExpiryAt).getTime() >= new Date(restored.expiresAt).getTime()
                ? restoredExpiryAt
                : restored.expiresAt
              : restored.expiresAt;
          }
          if (rec.planId && !activatedPlans.includes(rec.planId)) {'''
    s = once(s, old_restore, new_restore, "manual restore verification")
    s = once(s, '      const activatedPlans = [];\n      let anyServerError = false;',
             '      const activatedPlans = [];\n      let anyServerError = false;\n      let restoredExpiryAt = null;',
             "manual restore expiry variable")
    s = s.replace('      next.entitlements.proExpiresAt = null;\n      if (!hadTrainingPro',
                  '      next.entitlements.proExpiresAt = restoredExpiryAt;\n      if (!hadTrainingPro', 1)
    # After successful restore, explicitly establish verified entitlement overlay.
    s = once(s,
        '      await setData(next);\n      showToast(\n        ar\n          ? "تم استرجاع اشتراكك بنجاح!"',
        '''      await setData(next);
      setVerifiedEntitlements({
        trainingPro: activatedPlans.includes("training") || activatedPlans.includes("both"),
        nutritionPro: activatedPlans.includes("nutrition") || activatedPlans.includes("both"),
        aiCoachPro: activatedPlans.includes("ai"),
        proExpiresAt: restoredExpiryAt,
      });
      showToast(
        ar
          ? "تم استرجاع اشتراكك بنجاح!"''',
        "manual restore verified overlay")
    return s


def patch_auto_restore(s):
    # Root auto-restore has a separate `activated` object.
    s = once(s,
        '        const activated = {\n          trainingPro: false,\n          nutritionPro: false,\n          aiCoachPro: false,\n          proExpiresAt: null,\n        };',
        '        const activated = {\n          trainingPro: false,\n          nutritionPro: false,\n          aiCoachPro: false,\n          proExpiresAt: null,\n        };',
        "auto restore activated object")
    old = '''            await registerServerEntitlement(
              rec.productId,
              rec.productId,
              rec.result,
            );'''
    new = '''            const verifiedRestore = await registerServerEntitlement(
              rec.productId,
              rec.productId,
              rec.result,
            );
            if (verifiedRestore?.expiresAt) {
              activated.proExpiresAt =
                !activated.proExpiresAt ||
                new Date(verifiedRestore.expiresAt).getTime() > new Date(activated.proExpiresAt).getTime()
                  ? verifiedRestore.expiresAt
                  : activated.proExpiresAt;
            }'''
    s = once(s, old, new, "auto restore verification")
    return s


def main():
    if not APP.exists():
        raise SystemExit("App.jsx missing")
    s = APP.read_text(encoding="utf-8")
    s = patch_timeout(s)
    s = patch_helpers(s)
    s = patch_use_app_data(s)
    s = patch_verified_setter(s)
    s = patch_root(s)
    s = patch_days(s)
    s = patch_paywall(s)
    s = patch_auto_restore(s)
    APP.write_text(s, encoding="utf-8")
    print("production reliability patch applied")


if __name__ == "__main__":
    main()
