from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
for rel in ["src/App.jsx", "supabase/functions/ai-coach/index.ts"]:
    p = root / rel
    text = p.read_text(encoding="utf-8")
    text = text.replace("FitTrack", "Fifty Fit")
    text = text.replace("buildFifty FitAiContext", "buildFitTrackAiContext")
    p.write_text(text, encoding="utf-8")

workflow = root / ".github/workflows/normalize-branding.yml"
if workflow.exists():
    workflow.unlink()
Path(__file__).unlink()
subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", "-A"], cwd=root, check=True)
subprocess.run(["git", "commit", "-m", "fix: normalize remaining Fifty Fit user-facing text"], cwd=root, check=True)
subprocess.run(["git", "push", "origin", "HEAD:fix/play-readiness-p0-p1"], cwd=root, check=True)
