from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def require(condition, message):
    if not condition:
        raise SystemExit(f"ACCOUNT RECOVERY CHECK FAILED: {message}")

app_patch = read("scripts/patch-production-final-2.py")
load_patch = read("scripts/patch-load-fallback.py")
prep_patch = read("scripts/patch-missing-profile-phase-prep.py") if (ROOT / "scripts/patch-missing-profile-phase-prep.py").exists() else ""

require("setProfileMissing(true);" in app_patch, "missing remote profile must enter explicit recovery state")
require("setLoaded(true);" in app_patch, "missing remote profile must resolve loading instead of hanging")
require('setPhase("accountRecovery")' in app_patch or 'setPhase("accountRecovery")' in prep_patch, "recovery phase must be explicit")
require("clearProfileMissing?.();" in app_patch, "explicit new-account path must clear recovery state")
require("setLoaded(hasCachedAccount || !!data?.account?.email);" in load_patch, "transient Firestore failure must preserve cached returning-user state")
require('if (loadError && !loaded && !data?.account?.email)' in app_patch, "load-error gate must not override an already-hydrated account")

# Day 1 is a calendar/account-start concept, not a weekday heuristic.
for source_name, source in [("production patch", app_patch), ("date hardening", read("scripts/patch-runtime-date-hardening.py"))]:
    require("workoutStartDate" in source, f"{source_name}: workout start date contract missing")

print("[account-recovery] PASS")
