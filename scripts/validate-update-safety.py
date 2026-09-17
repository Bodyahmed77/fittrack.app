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
production_final = read("scripts/patch-production-final-2.py")
recovery_prep = read("scripts/patch-missing-profile-phase-prep.py") if (ROOT / "scripts/patch-missing-profile-phase-prep.py").exists() else ""
admin_overlay = read("scripts/patch-admin-entitlement-overlay.py")
admin_dashboard = read("src/AdminDashboard.jsx")
admin_command_center = read("admin/command-center-v3.js")
ai_coach_backend = read("supabase/functions/ai-coach/index.ts")
firestore_rules = read("firestore.rules")
release_workflow = read(".github/workflows/build-android.yml")
delete_account = read("supabase/functions/delete-account/index.ts")

release_scripts = sorted(set(re.findall(r"scripts/([A-Za-z0-9._-]+\\.py)", package)))
release_script_sources = []
for script_name in release_scripts:
    script_path = ROOT / "scripts" / script_name
    if script_path.is_file():
        release_script_sources.append(read(f"scripts/{script_name}"))
release_patches = "\n".join(release_script_sources)
stable_sources = "\n".join([app, release_patches, admin_dashboard, admin_command_center])

require('"com.bodyahmed77.fiftyfit"' in capacitor, "canonical Android applicationId missing")
require("fittrack-698fa" in app or "fittrack-698fa" in read("src/firebase.js"), "Firebase project identity missing")
require("versionCode {2000+n}" in release_workflow, "release versionCode is not generated monotonically from workflow runs")
require("versionName \"1.0.{n}\"" in release_workflow, "versionName generation missing")

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
require("setLoaded(hasCachedAccount || !!data?.account?.email);" in load_fallback, "transient Firestore failure must preserve cached returning-user state")
require("setProfileMissing(true);" in production_final, "missing remote profile must enter explicit recovery state")
require('setPhase("accountRecovery")' in production_final or 'setPhase("accountRecovery")' in recovery_prep, "missing profile must enter explicit recovery phase")
require("clearProfileMissing?.();" in production_final, "explicit new-account flow must clear recovery state")
require("setProfileMissing(false);" in production_final, "valid profile snapshot must clear stale recovery state")
require('if (!snap.exists())' in production_final, "missing-profile branch must distinguish absent server profile")
require('if (loadError && !loaded && !data?.account?.email)' in production_final, "load-error gate must not override hydrated account state")

require("mergeEntitlementSources" in admin_overlay, "entitlement merge guard missing")
require("adminEntitlementsRef" in admin_overlay, "admin support entitlement state is not isolated")
require("request.resource.data.get(\"adminEntitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects admin support entitlement writes")
require("request.resource.data.get(\"entitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects paid entitlement writes")

require("function parseExpiry" in ai_coach_backend, "AI backend expiry parser missing")
require("return parsed.valid && parsed.ms > Date.now();" in ai_coach_backend, "AI admin support entitlement must fail closed on invalid expiry")

require("delete_user_data" in delete_account and "p_uid" in delete_account, "delete-account RPC contract drift detected")

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

require("bundleRelease" in release_workflow and "assembleRelease" in release_workflow, "signed AAB/APK release build gate missing")
require("sha256sum release-artifacts/*" in release_workflow, "release fingerprinting missing")
require("test -s release-artifacts/fifty-fit-release.aab" in release_workflow, "AAB artifact verification missing")
require("test -s release-artifacts/fifty-fit-release.apk" in release_workflow, "APK artifact verification missing")
require("node --check src/fiftyFitBilling.js" in release_workflow, "first-party billing JS syntax gate missing")
require("com.android.billingclient:billing:9.1.0" in release_workflow, "PBL9 release pin missing")
require("node_modules/capacitor-billing" in release_workflow, "release workflow must preserve Gradle compatibility module")

for demo_file in [
    "web-demo/index.html",
    "web-demo/main.js",
    "web-demo/styles.css",
    "vite.webdemo.config.js",
    ".github/workflows/deploy-web-demo.yml",
]:
    require((ROOT / demo_file).is_file(), f"standalone web demo file '{demo_file}' is missing")

for file_name in ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]:
    require("com.fittrack.app" not in read(file_name), f"retired package id remains in {file_name}")

print("[update-safety] PASS")
