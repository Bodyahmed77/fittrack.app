from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
PRIVACY = ROOT / "src" / "privacy.js"
CAP = ROOT / "capacitor.config.json"
INDEX = ROOT / "index.html"


def replace_all(path, replacements):
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text == original:
        return False
    path.write_text(text, encoding="utf-8")
    return True

# Public app branding: keep internal identifiers/package IDs stable, but make
# every user-visible app name consistently "Fifty Fit".
replace_all(APP, [
    ('title: "FitTrack"', 'title: "Fifty Fit"'),
    ('title: "FitTrack Pro"', 'title: "Fifty Fit Pro"'),
    ('alt="FitTrack"', 'alt="Fifty Fit"'),
    ('>FitTrack<', '>Fifty Fit<'),
    ('FitTrack Pro', 'Fifty Fit Pro'),
    ('Unlock FitTrack Pro', 'Unlock Fifty Fit Pro'),
    ('Get more out of FitTrack', 'Get more out of Fifty Fit'),
])

# Google-created accounts start with an empty phone. Make phone mandatory
# before a new account can complete onboarding, while preserving the existing
# email/password signup validation.
text = APP.read_text(encoding="utf-8")
if 'const [phone, setPhone] = useState(data.account.phone || "");' not in text:
    text = text.replace(
        '  const [gender, setGender] = useState("");\n  const [age, setAge] = useState("");',
        '  const [phone, setPhone] = useState(data.account.phone || "");\n  const [gender, setGender] = useState("");\n  const [age, setAge] = useState("");',
        1,
    )

# Shift only the onboarding step indexes, descending to avoid double shifts.
for old, new in [(6, 7), (5, 6), (4, 5), (3, 4), (2, 3), (1, 2), (0, 1)]:
    text = text.replace(f'step === {old}', f'step === {new}')

text = text.replace(
    '  const steps = ar\n    ? ["النوع", "السن", "الطول", "الوزن", "الهدف", "النشاط", "الجدول"]\n    : ["Gender", "Age", "Height", "Weight", "Goal", "Activity", "Schedule"];',
    '  const steps = ar\n    ? ["رقم الهاتف", "النوع", "السن", "الطول", "الوزن", "الهدف", "النشاط", "الجدول"]\n    : ["Phone", "Gender", "Age", "Height", "Weight", "Goal", "Activity", "Schedule"];',
    1,
)

old_validation = '''  const next = () => {\n    setErr("");'''
new_validation = '''  const next = () => {\n    setErr("");\n    if (step === 0 && (!phone.trim() || phone.trim().replace(/\\D/g, "").length < 8)) {\n      setErr(ar ? "اكتب رقم تليفون صحيح" : "Enter a valid phone number");\n      return;\n    }'''
if old_validation not in text:
    raise SystemExit("Could not find onboarding next() validation")
text = text.replace(old_validation, new_validation, 1)

text = text.replace(
    '    next.account = {\n      ...next.account,\n      gender,',
    '    next.account = {\n      ...next.account,\n      phone: phone.trim(),\n      gender,',
    1,
)

# Insert the phone step immediately before the shifted gender step.
marker = '''        {step === 1 && (\n          <div>\n            <div\n              style={{\n                color: C.text,\n                fontSize: 21,\n                fontWeight: 800,\n                marginBottom: 20,\n              }}\n            >\n              {ar ? "إيه نوعك؟" : "What's your gender?"}'''
if 'placeholder={ar ? "رقم التليفون" : "Phone number"}' not in text:
    phone_step = '''        {step === 0 && (\n          <div>\n            <div\n              style={{\n                color: C.text,\n                fontSize: 21,\n                fontWeight: 800,\n                marginBottom: 8,\n              }}\n            >\n              {ar ? "رقم تليفونك إيه؟" : "What's your phone number?"}\n            </div>\n            <div style={{ color: C.sub, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>\n              {ar\n                ? "هنستخدمه للتواصل معاك بخصوص الخطط المخصصة والدعم عند الحاجة."\n                : "We'll use it for custom-plan communication and support when needed."}\n            </div>\n            <TextField\n              icon={Phone}\n              type="tel"\n              value={phone}\n              onChange={(e) => setPhone(e.target.value)}\n              placeholder={ar ? "رقم التليفون" : "Phone number"}\n            />\n          </div>\n        )}\n'''
    if marker not in text:
        raise SystemExit("Could not find onboarding gender marker")
    text = text.replace(marker, phone_step + marker, 1)

APP.write_text(text, encoding="utf-8")

# Legal/data disclosure must match the now-required phone collection.
replace_all(PRIVACY, [
    ('FitTrack — Privacy Policy & Legal Content', 'Fifty Fit — Privacy Policy & Legal Content'),
    ('name: "FitTrack"', 'name: "Fifty Fit"'),
    ('developer: "FitTrack"', 'developer: "Fifty Fit"'),
    ('applies to users of FitTrack', 'applies to users of Fifty Fit'),
    ('FitTrack ("we", "our", "us")', 'Fifty Fit ("we", "our", "us")'),
    ('an optional phone number if you choose to provide one for support', 'a phone number required to create and maintain your account and to support custom-plan communication'),
    ('FitTrack context', 'Fifty Fit context'),
    ('your current FitTrack context', 'your current Fifty Fit context'),
    ('associated FitTrack data', 'associated Fifty Fit data'),
])
replace_all(CAP, [('"appName": "FitTrack"', '"appName": "Fifty Fit"')])
replace_all(INDEX, [('<title>Fifty</title>', '<title>Fifty Fit</title>')])

# Normalize remaining public-name strings in setup/legal docs.
for rel in ["README.md", "AI_COACH_SETUP.md", "GOOGLE_SIGNIN_SETUP.md", "SIGNING_SETUP.md"]:
    p = ROOT / rel
    if p.exists():
        replace_all(p, [("FitTrack", "Fifty Fit")])

# Remove this one-shot maintenance workflow and script after this run.
workflow = ROOT / ".github" / "workflows" / "launch-finalize.yml"
if workflow.exists():
    workflow.unlink()
Path(__file__).unlink()

print("Launch finalization applied: Fifty Fit branding + mandatory Google-account phone onboarding.")
