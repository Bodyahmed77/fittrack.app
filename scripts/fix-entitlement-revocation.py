from pathlib import Path

p = Path('src/App.jsx')
s = p.read_text(encoding='utf-8')

# Server-verified empty Play purchase query is a real "no active purchases" result.
# Only preserve local state when the billing layer is preview/unsupported.
old = '''        if (!records.length) {\n          // Do not wipe existing local entitlements on empty query —\n          // user may be offline or plugin may be unavailable briefly.\n          return;\n        }'''
new = '''        if (!records.length) {\n          // An empty real Play query means there are no active purchases.\n          // Preview/unsupported results are not authoritative and must not wipe offline state.\n          if (result?.preview || result?.unsupported) return;\n          setVerifiedEntitlements({\n            trainingPro: false,\n            nutritionPro: false,\n            aiCoachPro: false,\n            proExpiresAt: null,\n          });\n          return;\n        }'''
if old in s:
    s = s.replace(old, new, 1)

# Manual Restore: clear only when the real Play query is empty.
old = '''      if (purchaseRecords.length === 0 && !res?.preview) {\n        showToast(\n          ar\n            ? "مفيش اشتراكات سابقة نستردّها"\n            : "No previous subscriptions to restore",\n        );\n        return;\n      }'''
new = '''      if (purchaseRecords.length === 0 && !res?.preview) {\n        setVerifiedEntitlements({\n          trainingPro: false,\n          nutritionPro: false,\n          aiCoachPro: false,\n          proExpiresAt: null,\n        });\n        showToast(\n          ar\n            ? "مفيش اشتراكات سابقة نستردّها"\n            : "No active subscriptions to restore",\n        );\n        return;\n      }'''
if old in s:
    s = s.replace(old, new, 1)

# AI-only users should also be considered Pro in the profile Pro CTA.
s = s.replace(
    'const pro = data.entitlements.trainingPro || data.entitlements.nutritionPro;',
    'const pro = data.entitlements.trainingPro || data.entitlements.nutritionPro || data.entitlements.aiCoachPro;',
    1,
)

# Finish remaining user-facing branding strings missed by the whitespace-sensitive cleanup.
s = s.replace('''      >\n        Fifty\n      </div>''', '''      >\n        FitTrack\n      </div>''')
s = s.replace('''            Fifty\n          </div>''', '''            FitTrack\n          </div>''')

p.write_text(s, encoding='utf-8')
print('entitlement revocation hardening applied')
