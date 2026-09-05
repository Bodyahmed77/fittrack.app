from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

unsafe = 'await setDoc(result.ref, { ...next, updatedAt: new Date().toISOString() });'
admin_grant = '''await updateDoc(result.ref, {\n        "entitlements.trainingPro": !!next.entitlements.trainingPro,\n        "entitlements.nutritionPro": !!next.entitlements.nutritionPro,\n        "entitlements.aiCoachPro": !!next.entitlements.aiCoachPro,\n        "entitlements.proExpiresAt": next.entitlements.proExpiresAt ?? null,\n        updatedAt: new Date().toISOString(),\n      });'''
user_save = '''await updateDoc(result.ref, {\n        "account.name": next.account.name,\n        "account.phone": next.account.phone,\n        updatedAt: new Date().toISOString(),\n      });'''

# There are two Admin writes in the current source: Pro entitlement management
# and editable user details. Replace them in their surrounding context so the
# build can never persist a stale whole-document snapshot over Play entitlements.
pro_marker = 'next.entitlements.trainingPro = false;'
pro_pos = text.find(pro_marker)
if pro_pos >= 0:
    pos = text.find(unsafe, pro_pos)
    if pos >= 0:
        text = text[:pos] + admin_grant + text[pos + len(unsafe):]

user_marker = 'next.account = {\n        ...next.account,\n        name: editName.trim(),\n        phone: editPhone.trim(),\n      };'
user_pos = text.find(user_marker)
if user_pos >= 0:
    pos = text.find(unsafe, user_pos)
    if pos >= 0:
        text = text[:pos] + user_save + text[pos + len(unsafe):]

if unsafe in text:
    raise SystemExit('admin save hardening failed: unsafe whole-document Admin write remains')

APP.write_text(text, encoding='utf-8')
print('admin save hardening applied')
