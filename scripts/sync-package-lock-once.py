from pathlib import Path
import subprocess

# One-time CI repair: package.json already contains @capacitor/browser but the
# committed lockfile predates it, so npm ci correctly refuses to continue.
subprocess.run(
    ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
    check=True,
)

lock = Path("package-lock.json")
if not lock.exists() or lock.stat().st_size == 0:
    raise SystemExit("package-lock.json was not generated")

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
Path(__file__).unlink()
subprocess.run(["git", "add", "package-lock.json", "scripts/sync-package-lock-once.py"], check=True)
subprocess.run(["git", "commit", "-m", "build: sync package lock [skip ci]"], check=True)
subprocess.run(["git", "push", "origin", "HEAD:main"], check=True)
print("package-lock.json synchronized and pushed")
