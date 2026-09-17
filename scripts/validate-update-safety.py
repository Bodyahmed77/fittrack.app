from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"UPDATE SAFETY FAILED: {message}")


package = read("package.json")
capacitor = read("capacitor.config.json")
app = read("src/App.jsx")
load_fallback = read("scripts/patch-load-fallback.py")
admin_overlay = read("scripts/patch-admin-entitlement-overlay.py")
admin_dashboard = read("src/AdminDashboard.jsx")
admin_command_center = read("admin/command-center-v3.js")
firestore_rules = read("firestore.rules")
release_workflow = read(".github/workflows/build-android.yml")
delete_account = read("supabase/functions/delete-account/index.ts")

# Read exactly the Python patchers that are wired into the production build
# rather than assuming a single historical patch owns a stable field.
release_scripts = sorted(set(re.findall(r"scripts/([A-Za-z0-9._-]+\\.py)", package)))
release_script_sources = []
for script_name in release_scripts:
    script_path = ROOT / "scripts" / script_name
    if script_path.is_file():
        release_script_sources.append(read(f"scripts/{script_name}"))
release_patches = "\n".join(release_script_sources)

# The invariant keys are shared by the app data model and the admin/support
# surfaces. Validate the whole set of canonical consumers so a harmless move
# from App.jsx into an admin surface does not create a false CI failure.
stable_sources = "\n".join([app, release_patches, admin_dashboard, admin_command_center])

# Identity must never drift between releases. A package-id change would make
# Google Play treat the build as a different application.
require('"com.bodyahmed77.fiftyfit"' in capacitor, "canonical Android applicationId missing")
require("fittrack-698fa" in app or "fittrack-698fa" in read("src/firebase.js"), "Firebase project identity missing")
require("versionCode {2000+n}" in release_workflow, "release versionCode is not generated monotonically from workflow runs")
require("versionName \"1.0.{n}\"" in release_workflow, "versionName generation missing")

# Stable user-facing document keys/cache fields must survive upgrades.
for key in [
    "customTrainingPlan",
    "customNutritionPlan",
    "trainingPlanRequestedAt",
    "nutritionPlanRequestedAt",
    "entitlements",
    "adminEntitlements",
    "workoutStartDate",
]:
    require(key in stable_sources, f"stable data key '{key}' is missing from canonical app/admin sources")

require("fiftyfit:account-cache:${uid}" in load_fallback, "account cache namespace drift detected")
require("setLoaded(hasCachedAccount || !!data?.account?.email)" in load_fallback, "returning-user fallback is missing")

# Entitlement sources must remain separated. This protects paid Play access
# from profile edits and support tooling during future releases.
require("mergeEntitlementSources" in admin_overlay, "entitlement merge guard missing")
require("adminEntitlementsRef" in admin_overlay, "admin support entitlement state is not isolated")
require("request.resource.data.get(\"adminEntitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects admin support entitlement writes")
require("request.resource.data.get(\"entitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects paid entitlement writes")

# The delete-account backend contract must remain stable for the external
# deletion flow. Changes here require an explicit migration/review.
require("delete_user_data" in delete_account and "p_uid" in delete_account, "delete-account RPC contract drift detected")

# Production build must keep the defensive transforms in the chain. Removing
# one can silently reintroduce upgrade-time regressions.
for script_name in [
    "patch-production-final.py",
    "patch-production-final-2.py",
    "patch-load-error-return.py",
    "patch-load-fallback.py",
    "patch-admin-entitlement-overlay.py",
    "patch-session-resilience.py",
    "patch-purchase-ack.py",
    "prepare-billing-release.py",
]:
    require(f"scripts/{script_name}" in package, f"{script_name} is no longer part of the release build")

# Release workflow must build both the uploadable AAB and the regression APK,
# and fingerprint the final outputs for traceability.
require("bundleRelease" in release_workflow and "assembleRelease" in release_workflow, "signed AAB/APK release build gate missing")
require("sha256sum release-artifacts/*" in release_workflow, "release fingerprinting missing")
require("test -s release-artifacts/fifty-fit-release.aab" in release_workflow, "AAB artifact verification missing")
require("test -s release-artifacts/fifty-fit-release.apk" in release_workflow, "APK artifact verification missing")

# No suspicious legacy package id may remain in app-facing source files.
for file_name in ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]:
    require("com.fittrack.app" not in read(file_name), f"retired package id remains in {file_name}")

print("[update-safety] PASS")
