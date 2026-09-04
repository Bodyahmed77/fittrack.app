from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

# The canonical useAppData source already declares freshState() before the
# parsed snapshot. The reliability patch inserts a second declaration while
# attaching the Firestore entitlement source; collapse it deterministically.
s = re.sub(
    r'(        const fresh = freshState\(\);\n        const parsed = snap\.exists\(\) \? snap\.data\(\) : \{\};\n)'
    r'        const fresh = freshState\(\);\n',
    r'\1',
    s,
    count=1,
)

# Make sure the Paywall route, not an unrelated screen, receives the verified
# entitlement setter required to unlock a successful Play purchase.
pattern = re.compile(r'(content\s*=\s*\(\s*<PaywallScreen\n)([\s\S]*?)(\n\s*back=\{back\})', re.M)
m = pattern.search(s)
if m:
    block = m.group(0)
    if "setVerifiedEntitlements={setVerifiedEntitlements}" not in block:
        block = block.replace("\n        back={back}", "\n        setVerifiedEntitlements={setVerifiedEntitlements}\n        back={back}", 1)
        s = s[:m.start()] + block + s[m.end():]

# Harden direct DOM page overflow for the production web artifact as well.
if "FIFTYFIT_RESPONSIVE_RELEASE_V1" not in s:
    s = "/* FIFTYFIT_RESPONSIVE_RELEASE_V1 */\n" + s

p.write_text(s, encoding="utf-8")
print("reliability fixups applied")
