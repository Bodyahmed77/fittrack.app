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
# We intentionally fix the known purchase path only.
s = s.replace(
    '      next.entitlements.proExpiresAt = null;\n      // A newly activated Training Pro subscription',
    '      next.entitlements.proExpiresAt = serverVerification?.expiresAt || null;\n      // A newly activated Training Pro subscription',
    1,
)

if 'FIFTYFIT_PAYWALL_WIRING_V1' not in s:
    s = '/* FIFTYFIT_PAYWALL_WIRING_V1 */\n' + s

p.write_text(s, encoding='utf-8')
print('paywall verified-state wiring applied')
