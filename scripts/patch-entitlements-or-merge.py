#!/usr/bin/env python3
"""Ensure admin Pro grants and Play purchases both unlock the UI.

1) Snapshot merge: OR Firestore entitlements with Play-verified flags.
2) Empty Play restore must not force-clear Pro (preserves admin grants).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
text = APP.read_text(encoding="utf-8")
original = text

old_merge = """          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },"""
new_merge = """          entitlements: (() => {
            // Admin grants live in Firestore; Play-verified flags live in the ref.
            // UI Pro = either source (OR). Never let an empty Play restore wipe admin Pro.
            const fs = parsed.entitlements || {};
            const vr = verifiedEntitlementsRef.current || {};
            return {
              trainingPro: !!(fs.trainingPro || vr.trainingPro),
              nutritionPro: !!(fs.nutritionPro || vr.nutritionPro),
              aiCoachPro: !!(fs.aiCoachPro || vr.aiCoachPro),
              proExpiresAt: vr.proExpiresAt || fs.proExpiresAt || null,
            };
          })(),"""

if "fs.trainingPro || vr.trainingPro" not in text:
    if old_merge not in text:
        raise SystemExit("entitlements merge block not found in App.jsx")
    text = text.replace(old_merge, new_merge, 1)

old_empty = """        if (!records.length) {
          // An empty real Play query means there are no active purchases.
          // Preview/unsupported results are not authoritative and must not wipe offline state.
          if (result?.preview || result?.unsupported) return;
          setVerifiedEntitlements({
            trainingPro: false,
            nutritionPro: false,
            aiCoachPro: false,
            proExpiresAt: null,
          });
          return;
        }"""
new_empty = """        if (!records.length) {
          // Empty Play query is not authoritative for admin-granted Pro in Firestore.
          // Do NOT force-clear verified flags — snapshot merge already ORs both sources.
          if (result?.preview || result?.unsupported) return;
          return;
        }"""

if "Do NOT force-clear verified flags" not in text:
    if old_empty not in text:
        raise SystemExit("empty restore block not found in App.jsx")
    text = text.replace(old_empty, new_empty, 1)

if text != original:
    APP.write_text(text, encoding="utf-8")
    print("App.jsx: admin+Play entitlements OR-merge applied")
else:
    print("App.jsx: entitlements OR-merge already present")
