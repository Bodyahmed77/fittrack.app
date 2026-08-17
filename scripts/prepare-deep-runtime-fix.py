from pathlib import Path

p = Path("scripts/apply-deep-runtime-fixes.py")
text = p.read_text(encoding="utf-8")

# The Firestore rules are maintained directly in the repository now. Remove the
# legacy rule-rewrite block from the runtime patch so postinstall stays
# idempotent across local builds and CI rebuilds.
marker = "# ------------------------------------------------------------\n# Firestore rules: users cannot alter adminEntitlements.\n# ------------------------------------------------------------\n"
if marker in text:
    head, _ = text.split(marker, 1)
    text = head + '# Firestore rules are maintained directly in firestore.rules.\nprint("firestore rules patch skipped; rules are source-controlled")\n\n'

# Never infer admin grants from ordinary Play-verified entitlements. An
# existing Play subscription is not an admin grant.
text = text.replace(
    'const legacyAdmin = parsed.adminEntitlements || parsed.entitlements || fresh.entitlements;',
    'const legacyAdmin = parsed.adminEntitlements || fresh.entitlements;',
)

# The previous runtime audit inserts a profileExists reset next to the verified
# entitlement reset. Align the strict deep patch with that already-transformed
# source so postinstall is deterministic.
text = text.replace(
    '      verifiedEntitlementsRef.current = null;\\n      return;',
    '      verifiedEntitlementsRef.current = null;\\n      profileExistsRef.current = false;\\n      return;',
)
text = text.replace(
    '      verifiedEntitlementsRef.current = null;\\n      profileExistsRef.current = false;\\n      return;',
    '      verifiedEntitlementsRef.current = null;\\n      profileExistsRef.current = false;\\n      adminEntitlementsRef.current = null;\\n      return;',
)

p.write_text(text, encoding="utf-8")
print("deep runtime patch prepared")
