#!/usr/bin/env python3
"""Harden subscription-expiry notification date parsing.

The app stores server-verified expiry as a real timestamp/ISO string. Do not
append a local-time suffix to an existing ISO timestamp, which can produce an
invalid Date and silently disable the reminder.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")

NEW = r'''async function scheduleSubscriptionExpiryReminder(expiresAtISO) {
  await LocalNotifications.cancel({
    notifications: [{ id: NOTIF_ID_SUB_EXPIRY }],
  });
  if (!expiresAtISO) return;

  const raw = String(expiresAtISO).trim();
  let expiryDate = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    // Date-only values are treated as a local calendar date; schedule the
    // warning at a stable local daytime hour.
    expiryDate = new Date(`${raw}T10:00:00`);
  } else {
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) expiryDate = parsed;
  }
  if (!expiryDate || !Number.isFinite(expiryDate.getTime())) return;

  const fireDate = new Date(expiryDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  if (fireDate <= new Date()) return; // less than 5 days left already

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIF_ID_SUB_EXPIRY,
        title: "Fifty Fit Pro",
        body: "Your Pro subscription ends in 5 days — renew to keep your plan and full history.",
        schedule: { at: fireDate },
      },
    ],
  });
}
'''

s = APP.read_text(encoding="utf-8")
pattern = re.compile(
    r'async function scheduleSubscriptionExpiryReminder\(expiresAtISO\) \{.*?\n\}\n\nfunction authErrorMessage',
    re.S,
)
replacement = NEW + '\nfunction authErrorMessage'
if not pattern.search(s):
    raise SystemExit("subscription reminder function anchor not found")
# Use a callable replacement because NEW intentionally contains backslashes
# in a JavaScript regex literal; re.sub would otherwise interpret them as
# replacement-template escapes.
s2 = pattern.sub(lambda _match: replacement, s, count=1)
if s2 == s:
    raise SystemExit("subscription reminder patch made no change")
APP.write_text(s2, encoding="utf-8")
print("subscription expiry reminder date parsing hardened")
