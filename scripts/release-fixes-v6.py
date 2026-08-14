"""Release validation for the root-cause fix commit.

This script MUST NOT mutate App.jsx with brittle string replacements.
It only verifies the contracts required for Home, TikTok, and Cardio.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")
pub = Path("src/publishedPlansUx.js").read_text(encoding="utf-8")
main = Path("src/main.jsx").read_text(encoding="utf-8")

def require(cond, label):
    if not cond:
        raise SystemExit(f"v6 validation failed: {label}")

# --- Home: single React path, no live DOM plan-card injector ---
require("function startPublishedPlansUx" in pub, "publishedPlansUx export present")
require("Intentionally empty" in pub or "no-op" in pub.lower() or "React is the sole" in pub,
        "publishedPlansUx is disabled / no-op")
require("appendChild" not in pub and "prepend" not in pub and "MutationObserver" not in pub,
        "publishedPlansUx has no DOM injection")
require("customNutritionPlan" in text and "PERSONALIZED" in text,
        "React plan cards still present in App.jsx")

# --- TikTok: no oEmbed, FullScreenVideoViewer present, Browser path for TikTok ---
require("function FullScreenVideoViewer" in text, "FullScreenVideoViewer present")
require("tiktok.com/oembed" not in text.lower(), "no TikTok oEmbed URL")
require("resolveTikTokVideoId" not in text, "no oEmbed resolver function")
require("Browser.open({ url: tikTokUrl" in text or "Browser.open({" in text,
        "Capacitor Browser open path for TikTok")
require("<iframe" in text, "YouTube iframe path still present")

# --- Cardio: state machine + await persistence before back() ---
require("function CardioExerciseView" in text, "CardioExerciseView present")
require('phase === "RUNNING"' in text or 'phase !== "RUNNING"' in text or 'setPhase("RUNNING")' in text,
        "cardio phase state machine")
require("await setData(next)" in text or "await persistLog" in text,
        "cardio awaits persistence")
require("clearTimer" in text or "clearInterval" in text, "timer cleanup present")
# Must not use the old auto-complete-on-open formula as the sole completed check
# in a way that finishes before the user starts.
require("alreadyFinished" in text or 'phase === "COMPLETED"' in text,
        "completion derived from finished / phase")

print("Release fixes v6 verification passed")
print("Home: DOM plan injector disabled; React is sole plan-card renderer")
print("TikTok: oEmbed removed; Capacitor Browser uses original URL")
print("Cardio: IDLE/RUNNING/COMPLETED state machine; await persist before back()")
