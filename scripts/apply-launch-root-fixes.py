from pathlib import Path
import subprocess

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")
old = 'if (alreadyFinished || !existingStartedAt || resumableStartedAt || !uidSafe()) return;'
new = 'if (alreadyFinished || !existingStartedAt || resumableStartedAt) return;'
if old in s:
    s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")
    print("Removed stale uidSafe dependency from cardio state machine")
elif 'uidSafe()' in s:
    raise SystemExit("Unexpected uidSafe() reference remains outside the expected cardio guard")
else:
    print("Cardio source already clean")

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
Path(__file__).unlink()
subprocess.run(["git", "add", "src/App.jsx", "scripts/apply-launch-root-fixes.py"], check=True)
subprocess.run(["git", "commit", "-m", "fix: remove stale cardio helper [skip ci]"], check=True)
subprocess.run(["git", "push", "origin", "HEAD:main"], check=True)
print("Cardio helper cleanup pushed to main")
