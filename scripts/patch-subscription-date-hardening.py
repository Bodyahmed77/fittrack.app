from pathlib import Path

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")
old = '  const fireDate = new Date(expiresAtISO + "T10:00:00");\n'
new = '''  const rawExpiry = String(expiresAtISO).trim();\n  const fireDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(rawExpiry)\n    ? new Date(`${rawExpiry}T10:00:00`)\n    : new Date(rawExpiry);\n  if (Number.isNaN(fireDate.getTime())) return;\n'''
if old not in s:
    if "FIFTYFIT_SUBSCRIPTION_DATE_HARDENING_V1" in s:
        # Repair a previously malformed marker placement from the first implementation.
        s = s.replace(
            "async /* FIFTYFIT_SUBSCRIPTION_DATE_HARDENING_V1 */\n  function scheduleSubscriptionExpiryReminder(expiresAtISO) {",
            "/* FIFTYFIT_SUBSCRIPTION_DATE_HARDENING_V1 */\n  async function scheduleSubscriptionExpiryReminder(expiresAtISO) {",
            1,
        )
        p.write_text(s, encoding="utf-8")
        print("Repaired subscription expiry date hardening marker placement")
        raise SystemExit(0)
    raise SystemExit("subscription expiry construction pattern not found")
s = s.replace(old, new, 1)
s = s.replace(
    "  async function scheduleSubscriptionExpiryReminder(expiresAtISO) {",
    "  /* FIFTYFIT_SUBSCRIPTION_DATE_HARDENING_V1 */\n  async function scheduleSubscriptionExpiryReminder(expiresAtISO) {",
    1,
)
p.write_text(s, encoding="utf-8")
print("Applied subscription expiry date hardening")
