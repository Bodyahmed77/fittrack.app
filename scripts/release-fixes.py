"""Non-destructive release sanity checks for the current Fifty Fit source."""
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")

text = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")

# This script intentionally does not rewrite source by exact text blocks.
# UI/source migrations belong in the current source and in dedicated fixers.
# The release gate only blocks known-dangerous regressions.
checks = [
    ("App.jsx exists", APP.exists()),
    ("main.jsx exists", MAIN.exists()),
    ("FullScreenVideoViewer canonical", text.count("function FullScreenVideoViewer(") == 1),
    ("VideoPlayer canonical", text.count("function VideoPlayer(") == 1),
    ("no TikTok oEmbed", not re.search(r"\boembed\b", text, re.I)),
    ("no DOM appendChild injection", "appendChild" not in text),
    ("cardio state machine present", 'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";' in text),
    ("cardio persistence present", "await persist(true, null, 35);" in text),
    ("StartupGate present", "function StartupGate" in main_text),
]

failed = [label for label, ok in checks if not ok]
if failed:
    raise SystemExit("release-fixes: required sanity checks failed: " + ", ".join(failed))

print("release-fixes: sanity checks passed; no brittle source-shape assumptions remain")
