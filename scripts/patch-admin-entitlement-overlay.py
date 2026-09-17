from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")
MARKER = "FIFTYFIT_ADMIN_ENTITLEMENT_OVERLAY_V1"


def replace_once(text: str, old: str, new: str, label: str) -> str:
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
  const hasExpiryField = Object.prototype.hasOwnProperty.call(overlay, "proExpiresAt");
  const proExpiresAt = overlay.proExpiresAt ? String(overlay.proExpiresAt).trim() : null;
  if (!trainingPro && !nutritionPro && !aiCoachPro) {
    return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
  }
  if (!proExpiresAt) return { trainingPro, nutritionPro, aiCoachPro, proExpiresAt: null };
  const expiryMs = Date.parse(`${proExpiresAt}T23:59:59.999Z`);
  if (!Number.isFinite(expiryMs)) {
    // Malformed explicit expiry must fail closed. A genuinely perpetual grant
    // is represented by an omitted/absent expiry field, not an invalid value.
    return hasExpiryField
      ? { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null }
      : { trainingPro, nutritionPro, aiCoachPro, proExpiresAt: null };
  }
  if (expiryMs <= Date.now()) {
    return { trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null };
  }
  return { trainingPro, nutritionPro, aiCoachPro, proExpiresAt };
}

function mergeEntitlementSources(base, admin) {
  const paid = base && typeof base === "object" ? base : {};
  const support = normalizeAdminEntitlementOverlay(admin);
  const candidates = [paid.proExpiresAt, support.proExpiresAt].filter(Boolean).map(String);
  const latestExpiry = candidates.reduce((latest, value) => {
    const latestMs = latest ? Date.parse(String(latest).length === 10 ? `${latest}T23:59:59.999Z` : String(latest)) : -Infinity;
    const valueMs = Date.parse(String(value).length === 10 ? `${value}T23:59:59.999Z` : String(value));
    return Number.isFinite(valueMs) && valueMs > latestMs ? value : latest;
  }, null);
  return {
    trainingPro: !!paid.trainingPro || support.trainingPro,
    nutritionPro: !!paid.nutritionPro || support.nutritionPro,
    aiCoachPro: !!paid.aiCoachPro || support.aiCoachPro,
    proExpiresAt: latestExpiry || null,
  };
}

'''

if helper not in s:
    anchor = "function useAppData(uid) {"
    if anchor not in s:
        raise SystemExit("admin-entitlement-overlay: useAppData anchor not found")
    s = s.replace(anchor, helper + anchor, 1)

if "const adminEntitlementsRef = useRef(null);" not in s:
    s = replace_once(
        s,
        "  const firestoreEntitlementsRef = useRef(null);",
        "  const firestoreEntitlementsRef = useRef(null);\n  const adminEntitlementsRef = useRef(null);",
        "admin entitlement ref",
    )

if "adminEntitlementsRef.current = null;" not in s:
    s = replace_once(
        s,
        "      firestoreEntitlementsRef.current = null;\n      setLoadError(null);",
        "      firestoreEntitlementsRef.current = null;\n      adminEntitlementsRef.current = null;\n      setLoadError(null);",
        "admin entitlement reset",
    )

if "adminEntitlementsRef.current = normalizeAdminEntitlementOverlay(parsed.adminEntitlements);" not in s:
    capture_anchor = """        firestoreEntitlementsRef.current = {
          ...fresh.entitlements,
          ...(parsed.entitlements || {}),
        };"""
    if capture_anchor not in s:
        raise SystemExit("admin-entitlement-overlay: snapshot entitlement source anchor not found")
    s = s.replace(
        capture_anchor,
        capture_anchor + "\n        adminEntitlementsRef.current = normalizeAdminEntitlementOverlay(parsed.adminEntitlements);",
        1,
    )

if "merged.entitlements = mergeEntitlementSources(merged.entitlements, adminEntitlementsRef.current);" not in s:
    if "        setDataRaw(merged);" not in s:
        raise SystemExit("admin-entitlement-overlay: snapshot commit anchor not found")
    s = s.replace(
        "        setDataRaw(merged);",
        "        merged.entitlements = mergeEntitlementSources(merged.entitlements, adminEntitlementsRef.current);\n        setDataRaw(merged);",
        1,
    )

# Replace the entire verified-entitlement callback rather than matching a fragile
# historical body. Keep the existing API contract and preserve support grants.
setter_pattern = re.compile(
    r'  const setVerifiedEntitlements = useCallback\(\(entitlements\) => \{[\s\S]*?\n  \}, \[\]\);',
)
new_setter = '''  const setVerifiedEntitlements = useCallback((entitlements) => {
    const fs = firestoreEntitlementsRef.current || {};
    if (!entitlements) {
      verifiedEntitlementsRef.current = null;
      setDataRaw((current) => ({
        ...current,
        entitlements: mergeEntitlementSources(fs, adminEntitlementsRef.current),
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
    }));
  }, []);'''

matches = setter_pattern.findall(s)
if len(matches) != 1:
    raise SystemExit(f"admin-entitlement-overlay: verified entitlement callback count={len(matches)}")
s = setter_pattern.sub(new_setter, s, count=1)

if MARKER not in s:
    s = f"/* {MARKER} */\n" + s

p.write_text(s, encoding="utf-8")
print("admin entitlement overlay applied")