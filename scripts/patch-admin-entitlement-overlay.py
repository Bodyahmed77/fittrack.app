from pathlib import Path

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")
MARKER = "FIFTYFIT_ADMIN_ENTITLEMENT_OVERLAY_V1"

def replace_once(text, old, new, label):
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"admin-entitlement-overlay: {label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

helper = '''
function normalizeAdminEntitlementOverlay(raw) {
  const overlay = raw && typeof raw === "object" ? raw : {};
  const trainingPro = overlay.trainingPro === true;
  const nutritionPro = overlay.nutritionPro === true;
  const aiCoachPro = overlay.aiCoachPro === true;
  const proExpiresAt = overlay.proExpiresAt ? String(overlay.proExpiresAt).trim() : null;
  if (!trainingPro && !nutritionPro && !aiCoachPro) {
    return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
  }
  if (!proExpiresAt) return { trainingPro, nutritionPro, aiCoachPro, proExpiresAt: null };
  const expiryMs = Date.parse(`${proExpiresAt}T23:59:59.999Z`);
  if (Number.isFinite(expiryMs) && expiryMs <= Date.now()) {
    return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
  }
  return { trainingPro, nutritionPro, aiCoachPro, proExpiresAt };
}

function mergeEntitlementSources(base, admin) {
  const paid = base && typeof base === "object" ? base : {};
  const support = normalizeAdminEntitlementOverlay(admin);
  const expiryValues = [paid.proExpiresAt, support.proExpiresAt].filter(Boolean);
  expiryValues.sort((a, b) => {
    const am = Date.parse(String(a).length === 10 ? `${a}T23:59:59.999Z` : String(a));
    const bm = Date.parse(String(b).length === 10 ? `${b}T23:59:59.999Z` : String(b));
    return (Number.isFinite(am) ? am : -Infinity) - (Number.isFinite(bm) ? bm : -Infinity);
  });
  return {
    trainingPro: !!paid.trainingPro || support.trainingPro,
    nutritionPro: !!paid.nutritionPro || support.nutritionPro,
    aiCoachPro: !!paid.aiCoachPro || support.aiCoachPro,
    proExpiresAt: expiryValues[expiryValues.length - 1] || null,
  };
}

'''
if helper not in s:
    anchor = 'function useAppData(uid) {'
    if anchor not in s:
        raise SystemExit("admin-entitlement-overlay: useAppData anchor not found")
    s = s.replace(anchor, helper + anchor, 1)

# Keep the admin overlay in its own ref so Play restore callbacks cannot erase
# a legitimate support entitlement from the runtime state.
s = replace_once(
    s,
    '  const firestoreEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
    '  const firestoreEntitlementsRef = useRef(null);\n  const adminEntitlementsRef = useRef(null);\n  const latestLocalWriteAtRef = useRef(null);',
    "admin entitlement ref",
)

# Reset the overlay source when the Firebase identity changes.
s = replace_once(
    s,
    '      firestoreEntitlementsRef.current = null;\n      setLoadError(null);',
    '      firestoreEntitlementsRef.current = null;\n      adminEntitlementsRef.current = null;\n      setLoadError(null);',
    "admin entitlement reset",
)

# Capture the server-owned support grant separately from purchase-backed entitlements.
s = replace_once(
    s,
    '        firestoreEntitlementsRef.current = {\n          ...fresh.entitlements,\n          ...(parsed.entitlements || {}),\n        };',
    '        firestoreEntitlementsRef.current = {\n          ...fresh.entitlements,\n          ...(parsed.entitlements || {}),\n        };\n        adminEntitlementsRef.current = normalizeAdminEntitlementOverlay(parsed.adminEntitlements);',
    "admin entitlement snapshot source",
)

# Make the main Firestore snapshot merge include the still-active support grant.
s = replace_once(
    s,
    '''          entitlements: {
            trainingPro: active && !!(firestore.trainingPro || verified.trainingPro),
            nutritionPro: active && !!(firestore.nutritionPro || verified.nutritionPro),
            aiCoachPro: active && !!(firestore.aiCoachPro || verified.aiCoachPro),
            proExpiresAt: active ? expiryRaw : null,
          },''',
    '''          entitlements: mergeEntitlementSources(
            {
              trainingPro: active && !!(firestore.trainingPro || verified.trainingPro),
              nutritionPro: active && !!(firestore.nutritionPro || verified.nutritionPro),
              aiCoachPro: active && !!(firestore.aiCoachPro || verified.aiCoachPro),
              proExpiresAt: active ? expiryRaw : null,
            },
            adminEntitlementsRef.current,
          ),''',
    "snapshot entitlement merge",
)

# Merge the support grant after any Play restore/verification update too.
s = replace_once(
    s,
    '''      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          trainingPro: !!(fs.trainingPro || nextVerified.trainingPro),
          nutritionPro: !!(fs.nutritionPro || nextVerified.nutritionPro),
          aiCoachPro: !!(fs.aiCoachPro || nextVerified.aiCoachPro),
          proExpiresAt: nextVerified.proExpiresAt || fs.proExpiresAt || null,
        },
      }));''',
    '''      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: mergeEntitlementSources(
          {
            trainingPro: !!(fs.trainingPro || nextVerified.trainingPro),
            nutritionPro: !!(fs.nutritionPro || nextVerified.nutritionPro),
            aiCoachPro: !!(fs.aiCoachPro || nextVerified.aiCoachPro),
            proExpiresAt: nextVerified.proExpiresAt || fs.proExpiresAt || null,
          },
          adminEntitlementsRef.current,
        ),
      }));''',
    "verified entitlement merge",
)

# The null/clear path must also preserve a support grant.
s = replace_once(
    s,
    '''      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: {
          trainingPro: !!fs.trainingPro,
          nutritionPro: !!fs.nutritionPro,
          aiCoachPro: !!fs.aiCoachPro,
          proExpiresAt: fs.proExpiresAt || null,
        },
      }));''',
    '''      const fs = firestoreEntitlementsRef.current || {};
      setDataRaw((current) => ({
        ...current,
        entitlements: mergeEntitlementSources(fs, adminEntitlementsRef.current),
      }));''',
    "cleared verified entitlement merge",
)

if MARKER not in s:
    s = f"/* {MARKER} */\n" + s

p.write_text(s, encoding="utf-8")
print("admin entitlement overlay applied")
