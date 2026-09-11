#!/usr/bin/env python3
from pathlib import Path

APP = Path("src/App.jsx")
MARKER = "FIFTYFIT_RUNTIME_DATE_HARDENING_V1"


def main():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    old_helpers = '''function daysUntil(iso) {
  if (!iso) return 0;
  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}'''
    new_helpers = '''/* FIFTYFIT_RUNTIME_DATE_HARDENING_V1 */
function parseDateLike(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = raw.length === 10 ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysUntil(iso) {
  const expiry = parseDateLike(iso);
  if (!expiry) return 0;
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((expiryDay - todayDay) / 86400000));
}'''
    if old_helpers not in s:
        raise SystemExit("runtime-date: daysUntil anchor not found")
    s = s.replace(old_helpers, new_helpers, 1)

    old_reminder = '''  if (!expiresAtISO) return;
  const fireDate = new Date(expiresAtISO + "T10:00:00");
  fireDate.setDate(fireDate.getDate() - 5);
  if (fireDate <= new Date()) return; // less than 5 days left already — nothing to schedule'''
    new_reminder = '''  const expiresAt = parseDateLike(expiresAtISO);
  if (!expiresAt) return;
  const fireDate = new Date(expiresAt.getTime());
  fireDate.setHours(10, 0, 0, 0);
  fireDate.setDate(fireDate.getDate() - 5);
  if (fireDate <= new Date()) return; // less than 5 days left already — nothing to schedule'''
    if old_reminder not in s:
        raise SystemExit("runtime-date: reminder anchor not found")
    s = s.replace(old_reminder, new_reminder, 1)

    # Admin status must consider AI-only entitlement too.
    old_pro = '''  const proActive =
    !!result?.data?.entitlements?.trainingPro ||
    !!result?.data?.entitlements?.nutritionPro;'''
    new_pro = '''  const proActive =
    !!result?.data?.entitlements?.trainingPro ||
    !!result?.data?.entitlements?.nutritionPro ||
    !!result?.data?.entitlements?.aiCoachPro;'''
    if old_pro in s:
        s = s.replace(old_pro, new_pro, 1)

    # Admin manual grants should use a full ISO expiry, matching server verified values.
    s = s.replace(
        '        next.entitlements.proExpiresAt = expires.toISOString().slice(0, 10);',
        '        next.entitlements.proExpiresAt = expires.toISOString();',
        1,
    )

    # Fix the Google Play management link to the real Android application id.
    s = s.replace(
        'https://play.google.com/store/account/subscriptions?package=com.fittrack.app',
        'https://play.google.com/store/account/subscriptions?package=com.bodyahmed77.fiftyfit',
    )

    APP.write_text(s, encoding="utf-8")
    print("runtime date/billing UI hardening applied")


if __name__ == "__main__":
    main()
