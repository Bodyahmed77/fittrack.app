from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")
pattern = re.compile(r'(content\s*=\s*\(\s*<PaywallScreen\n)([\s\S]*?)(\n\s*back=\{back\})', re.M)
m = pattern.search(s)
if not m:
    raise SystemExit("paywall verified-state: PaywallScreen routing block not found")
block = m.group(0)
if "setVerifiedEntitlements={setVerifiedEntitlements}" not in block:
    block = block.replace("\n        back={back}", "\n        setVerifiedEntitlements={setVerifiedEntitlements}\n        back={back}", 1)
    s = s[:m.start()] + block + s[m.end():]
if "FIFTYFIT_PAYWALL_VERIFIED_STATE_V1" not in s:
    s = "/* FIFTYFIT_PAYWALL_VERIFIED_STATE_V1 */\n" + s
p.write_text(s, encoding="utf-8")
print("Paywall verified entitlement setter wired")
