from pathlib import Path
import re

APP = Path("src/App.jsx")


def fail(label):
    raise SystemExit(f"production stability: {label}")


def replace_once(text, old, new, label):
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def patch_load_and_persistence(s):
    # Add reliability refs/state.
    old_refs = '''  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);'''
    new_refs = '''  const verifiedEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);\n  const firestoreEntitlementsRef = useRef(null);\n  const writeQueueRef = useRef(Promise.resolve());\n  const [loadError, setLoadError] = useState(null);'''
    s = replace_once(s, old_refs, new_refs, "reliability refs")

    # Reset refs whenever auth uid changes.
    old_reset = '''      setNotifications([]);\n      verifiedEntitlementsRef.current = null;\n      return;'''
    new_reset = '''      setNotifications([]);\n      verifiedEntitlementsRef.current = null;\n      firestoreEntitlementsRef.current = null;\n      writeQueueRef.current = Promise.resolve();\n      setLoadError(null);\n      return;'''
    s = replace_once(s, old_reset, new_reset, "uid reset")

    # Replace the canonical snapshot success merge with explicit Firestore + verified OR state.
    old_merge = '''        const merged = {\n          ...fresh,\n          ...parsed,\n          account: { ...fresh.account, ...(parsed.account || {}) },\n          settings: { ...fresh.settings, ...(parsed.settings || {}) },\n          profile: { ...fresh.profile, ...(parsed.profile || {}) },\n          entitlements: {\n            ...fresh.entitlements,\n            ...(verifiedEntitlementsRef.current || {}),\n          },\n          customPlan: parsed.customPlan || {},'''
    new_merge = '''        firestoreEntitlementsRef.current = {
          ...fresh.entitlements,
          ...(parsed.entitlements || {}),
        };
        setLoadError(null);
        const verified = verifiedEntitlementsRef.current || {};
        const firestore = parsed.entitlements || {};
        const merged = {
          ...fresh,
          ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: {
            trainingPro: !!(firestore.trainingPro || verified.trainingPro),
            nutritionPro: !!(firestore.nutritionPro || verified.nutritionPro),
            aiCoachPro: !!(firestore.aiCoachPro || verified.aiCoachPro),
            proExpiresAt: verified.proExpiresAt || firestore.proExpiresAt || null,
          },
          customPlan: parsed.customPlan || {},'''
    s = replace_once(s, old_merge, new_merge, "snapshot entitlement merge")

    # Successful snapshots create a local recovery copy without server-owned Pro state.
    old_success = '''        setDataRaw(merged);\n        setLoaded(true);'''
    new_success = '''        setDataRaw(merged);
        try {
          const backup = clone(merged);
          backup.entitlements = {
            trainingPro: false,
            nutritionPro: false,
            aiCoachPro: false,
            proExpiresAt: null,
          };
          if (backup.account?.photo && String(backup.account.photo).length > 250000) backup.account.photo = "";
          localStorage.setItem(`fiftyfit-user-backup-v3:${uid}`, JSON.stringify({
            savedAt: new Date().toISOString(),
            data: backup,
          }));
        } catch (_) {}
        setLoaded(true);'''
    s = replace_once(s, old_success, new_success, "snapshot backup")

    # Snapshot errors must NOT masquerade as a successful empty account.
    old_error = '''      (err) => {\n        console.error("Firestore read failed", err);\n        setLoaded(true);\n      },'''
    new_error = '''      (err) => {
        console.error("Firestore read failed", err);
        try {
          const raw = localStorage.getItem(`fiftyfit-user-backup-v3:${uid}`);
          const backup = raw ? JSON.parse(raw)?.data : null;
          if (backup && typeof backup === "object") {
            setDataRaw({ ...freshState(), ...backup, entitlements: { ...freshState().entitlements } });
            setLoadError(null);
            setLoaded(true);
            return;
          }
        } catch (_) {}
        setLoadError({ code: "firestore_read_failed" });
        setLoaded(false);
      },'''
    s = replace_once(s, old_error, new_error, "snapshot error handling")

    # Do not let user setData persist or overwrite Play entitlements.
    old_persist = '''      const persisted = Object.fromEntries(\n        Object.entries(next).filter(\n          ([key]) =>\n            key !== "customTrainingPlan" &&\n            key !== "customNutritionPlan",\n        ),\n      );\n      verifiedEntitlementsRef.current = next.entitlements;'''
    new_persist = '''      const persisted = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== "customTrainingPlan" &&
            key !== "customNutritionPlan" &&
            key !== "entitlements",
        ),
      );'''
    s = replace_once(s, old_persist, new_persist, "safe persistence payload")

    # Replace setData body with serialized writes and local backup. This exact block is
    # intentionally structurally simple so build-time rewriting cannot create nested finallys.
    old_write = '''      try {\n        await setDoc(\n          doc(db, "users", uid),\n          { ...persisted, updatedAt },\n          { merge: true },\n        );\n        return true;\n      } catch (e) {\n        console.error("save failed", e);\n        try {\n          window.__fiftyFitFirestoreDiagnostics = {\n            stage: "users_profile_write",\n            uid,\n            code: String(e?.code || "unknown"),\n            message: String(e?.message || e || ""),\n            updatedAt: new Date().toISOString(),\n          };\n        } catch (_) {}\n        setDataRaw(previous);\n        setSaveError(e);\n        return false;\n      } finally {\n        setWritePending(false);\n      }'''
    new_write = '''      const queuedWrite = writeQueueRef.current
        .catch(() => {})
        .then(async () => {
          await setDoc(
            doc(db, "users", uid),
            { ...persisted, updatedAt },
            { merge: true },
          );
          try {
            const backup = clone(next);
            backup.entitlements = {
              trainingPro: false,
              nutritionPro: false,
              aiCoachPro: false,
              proExpiresAt: null,
            };
            if (backup.account?.photo && String(backup.account.photo).length > 250000) backup.account.photo = "";
            localStorage.setItem(`fiftyfit-user-backup-v3:${uid}`, JSON.stringify({
              savedAt: new Date().toISOString(),
              data: backup,
            }));
          } catch (_) {}
          return true;
        });
      writeQueueRef.current = queuedWrite;
      try {
        await queuedWrite;
        setSaveError(null);
        return true;
      } catch (e) {
        console.error("save failed", e);
        try {
          window.__fiftyFitFirestoreDiagnostics = {
            stage: "users_profile_write",
            uid,
            code: String(e?.code || "unknown"),
            message: String(e?.message || e || ""),
            updatedAt: new Date().toISOString(),
          };
        } catch (_) {}
        setDataRaw(previous);
        setSaveError(e);
        return false;
      } finally {
        setWritePending(false);
      }'''
    s = replace_once(s, old_write, new_write, "serialized Firestore write")

    return s


def patch_verified_state(s):
    old = '''  const setVerifiedEntitlements = useCallback((entitlements) => {\n    verifiedEntitlementsRef.current = {\n      nutritionPro: !!entitlements?.nutritionPro,\n      trainingPro: !!entitlements?.trainingPro,\n      aiCoachPro: !!entitlements?.aiCoachPro,\n      proExpiresAt: entitlements?.proExpiresAt || null,\n    };\n    setDataRaw((current) => ({\n      ...current,\n      entitlements: verifiedEntitlementsRef.current,\n    }));\n  }, []);'''
    new = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
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
    const expiry = entitlements?.proExpiresAt || null;
    const expiryMs = expiry ? (Date.parse(expiry) || Date.parse(`${expiry}T23:59:59.999`)) : null;
    const expired = Number.isFinite(expiryMs) && expiryMs <= Date.now();
    const next = {
      nutritionPro: !expired && !!entitlements?.nutritionPro,
      trainingPro: !expired && !!entitlements?.trainingPro,
      aiCoachPro: !expired && !!entitlements?.aiCoachPro,
      proExpiresAt: expired ? null : expiry,
    };
    verifiedEntitlementsRef.current = next;
    const fs = firestoreEntitlementsRef.current || {};
    setDataRaw((current) => ({
      ...current,
      entitlements: {
        trainingPro: !!(fs.trainingPro || next.trainingPro),
        nutritionPro: !!(fs.nutritionPro || next.nutritionPro),
        aiCoachPro: !!(fs.aiCoachPro || next.aiCoachPro),
        proExpiresAt: next.proExpiresAt || fs.proExpiresAt || null,
      },
    }));
  }, []);'''
    return replace_once(s, old, new, "verified state setter")


def patch_root(s):
    old = '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(\n'
    new = '  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError, loadError } = useAppData(\n'
    s = replace_once(s, old, new, "root hook values")

    old_gate = '''    if (!loaded || writePending) return;\n    if (saveError) return;'''
    new_gate = '''    if (loadError) {
      setPhase("dataError");
      return;
    }
    if (!loaded || writePending) return;
    if (saveError) return;'''
    s = replace_once(s, old_gate, new_gate, "load gate")

    # Never clear admin/Firestore Pro on an empty Play restore.
    old_empty = '''        if (!records.length) {\n          // An empty real Play query means there are no active purchases.\n          // Preview/unsupported results are not authoritative and must not wipe offline state.\n          if (result?.preview || result?.unsupported) return;\n          setVerifiedEntitlements({\n            trainingPro: false,\n            nutritionPro: false,\n            aiCoachPro: false,\n            proExpiresAt: null,\n          });\n          return;\n        }'''
    new_empty = '''        if (!records.length) {
          // Play has no active purchase; leave Firestore/admin entitlements untouched.
          if (result?.preview || result?.unsupported) return;
          setVerifiedEntitlements(null);
          return;
        }'''
    s = replace_once(s, old_empty, new_empty, "empty Play restore")

    # Capture verified restore expiry from backend.
    old_restore = '''            await registerServerEntitlement(\n              rec.productId,\n              rec.productId,\n              rec.result,\n            );'''
    new_restore = '''            const verifiedRestore = await registerServerEntitlement(
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
    s = replace_once(s, old_restore, new_restore, "auto restore expiry")

    # Add retryable data-error UI before auth screens.
    marker = '  let authScreen = null;\n'
    error_screen = '''  if (phase === "dataError") {
    return (
      <UIContext.Provider value={{ C, lang }}>
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>
            <RefreshCcw size={44} color={C.green} style={{ marginBottom: 16 }} />
            <div style={{ fontWeight: 800, fontSize: 20 }}>{lang === "ar" ? "تعذر تحميل بيانات حسابك" : "Couldn’t load your account"}</div>
            <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>{lang === "ar" ? "بياناتك لم تتحول لحساب جديد. أعد المحاولة عندما يعود الاتصال بقاعدة البيانات." : "Your account was not replaced with a new one. Retry when the database connection is available."}</div>
            <div style={{ marginTop: 20 }}><GreenButton onClick={() => window.location.reload()}>{lang === "ar" ? "إعادة المحاولة" : "Retry"}</GreenButton></div>
          </div>
        </div>
      </UIContext.Provider>
    );
  }

'''
    s = replace_once(s, marker, error_screen + marker, "data error screen")
    return s


def patch_paywall(s):
    s = s.replace(
        'function PaywallScreen({ data, setData, back, showToast, params = {} }) {',
        'function PaywallScreen({ data, setData, setVerifiedEntitlements, back, showToast, params = {} }) {',
        1,
    )
    old = '''          await registerServerEntitlement(\n            productKey,\n            result?.productId || productKey,\n            result?.result,\n          );'''
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
    s = replace_once(s, old, new, "purchase verified state")

    # Wire the expiry returned from verified purchase into the local post-success state.
    s = s.replace(
        '      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
        '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription',
        1,
    )
    return s


def patch_days_until(s):
    old = '''function daysUntil(iso) {\n  if (!iso) return 0;\n  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");\n  return Math.max(0, Math.round(ms / 86400000));\n}'''
    new = '''function daysUntil(iso) {
  if (!iso) return 0;
  const raw = String(iso).trim();
  const ms = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw)
    ? Date.parse(`${raw}T23:59:59.999`)
    : Date.parse(raw);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / 86400000));
}'''
    return replace_once(s, old, new, "daysUntil")


def main():
    s = APP.read_text(encoding="utf-8")
    s = patch_load_and_persistence(s)
    s = patch_verified_state(s)
    s = patch_root(s)
    s = patch_paywall(s)
    s = patch_days_until(s)
    if "FIFTYFIT_PRODUCTION_STABILITY_V1" not in s:
        s = "/* FIFTYFIT_PRODUCTION_STABILITY_V1 */\n" + s
    APP.write_text(s, encoding="utf-8")
    print("production stability patch applied")


if __name__ == "__main__":
    main()
