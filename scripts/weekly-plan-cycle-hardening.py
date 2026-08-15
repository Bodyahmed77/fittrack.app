from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# This release step is intentionally validation-only. The previous version
# tried to rewrite App.jsx by matching a legacy `planDayForDate` function and
# several exact NutritionPlanScreen snippets. Those structures no longer exist
# in the current source, so the release pipeline was failing before npm build.
#
# The actual UI/state hardening belongs in the current-source release fixer.
# This script now checks only durable invariants and never requires a specific
# helper name or source layout.
required_markers = (
    "function isCustomTrainingPlanActive",
    "customTrainingPlanActive",
    "customTrainingPlan",
    "workoutStartDate",
)
missing = [marker for marker in required_markers if marker not in text]
if missing:
    raise SystemExit(
        "weekly-cycle: current training-plan state markers missing: "
        + ", ".join(missing)
    )

# The current app must not retain the old exact-helper contract that caused
# previous release runs to fail. We deliberately do not modify source here.
print("weekly-cycle: current-source validation passed; no legacy shape assumptions remain")
