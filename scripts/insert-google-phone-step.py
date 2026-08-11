from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
app = root / "src" / "App.jsx"
text = app.read_text(encoding="utf-8")
start = text.index("function OnboardingScreen(")
end = text.index("/* ============================== HOME SCREEN", start)
section = text[start:end]

if 'value={phone}' not in section:
    marker = '''        {step === 1 && (\n          <div>\n            <div\n              style={{\n                color: C.text,\n                fontSize: 21,\n                fontWeight: 800,\n                marginBottom: 20,\n              }}\n            >\n              {ar ? "إيه نوعك؟" : "What's your gender?"}'''
    phone_step = '''        {step === 0 && (\n          <div>\n            <div\n              style={{\n                color: C.text,\n                fontSize: 21,\n                fontWeight: 800,\n                marginBottom: 8,\n              }}\n            >\n              {ar ? "رقم تليفونك إيه؟" : "What's your phone number?"}\n            </div>\n            <div style={{ color: C.sub, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>\n              {ar\n                ? "هنستخدمه للتواصل معاك بخصوص الخطط المخصصة والدعم عند الحاجة."\n                : "We'll use it for custom-plan communication and support when needed."}\n            </div>\n            <TextField\n              icon={Phone}\n              type="tel"\n              value={phone}\n              onChange={(e) => setPhone(e.target.value)}\n              placeholder={ar ? "رقم التليفون" : "Phone number"}\n            />\n          </div>\n        )}\n'''
    if marker not in section:
        raise SystemExit("Onboarding gender marker not found")
    section = section.replace(marker, phone_step + marker, 1)
    text = text[:start] + section + text[end:]
    app.write_text(text, encoding="utf-8")

workflow = root / ".github/workflows/phone-step-fix.yml"
if workflow.exists():
    workflow.unlink()
Path(__file__).unlink()

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", "-A"], cwd=root, check=True)
subprocess.run(["git", "commit", "-m", "fix: show required phone step for Google signup"], cwd=root, check=True)
subprocess.run(["git", "push", "origin", "HEAD:fix/play-readiness-p0-p1"], cwd=root, check=True)
