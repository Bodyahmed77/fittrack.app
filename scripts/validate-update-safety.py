from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"UPDATE SAFETY FAILED: {message}")


package = read("package.json")
capacitor = read("capacitor.config.json")
app = read("src/App.jsx")
firestore_rules = read("firestore.rules")
release_workflow = read(".github/workflows/build-android.yml")
pages_workflow = read(".github/workflows/deploy-web-demo.yml")
admin_index = read("admin/index.html")
admin_boot = read("admin/boot.js")

# The build is intentionally mutation-heavy for legacy compatibility. Validate
# the complete source material instead of binding each invariant to one exact
# historical patch file; otherwise a harmless patch reordering creates false
# negatives while still allowing real drift to escape.
script_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted((ROOT / "scripts").glob("*.py"))
)

# Identity must never drift between releases. A package-id change would make
# Google Play treat the build as a different application.
require('"com.bodyahmed77.fiftyfit"' in capacitor, "canonical Android applicationId missing")
require("fittrack-698fa" in app or "fittrack-698fa" in read("src/firebase.js"), "Firebase project identity missing")
require("versionCode {2000+n}" in release_workflow, "release versionCode is not generated monotonically from workflow runs")
require("versionName \\\"1.0.{n}\\\"" in release_workflow, "release versionName generation missing")

# Stable user-facing document keys and cache keys must remain represented in
# canonical source or in a committed transformation that produces that source.
for key in [
    "customTrainingPlan",
    "customNutritionPlan",
    "trainingPlanRequestedAt",
    "nutritionPlanRequestedAt",
    "entitlements",
    "adminEntitlements",
    "workoutStartDate",
]:
    require(key in app or key in script_text, f"stable data key '{key}' is missing from source/transform set")

load_fallback = read("scripts/patch-load-fallback.py")
admin_overlay = read("scripts/patch-admin-entitlement-overlay.py")
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
delete_account = read("supabase/functions/delete-account/index.ts")
require("delete_user_data" in delete_account and "p_uid" in delete_account, "delete-account RPC contract drift detected")

# Public Pages must publish the actual policy/deletion pages and the canonical
# admin entrypoint. Do not merely test that source files exist in docs/.
require("cp docs/privacy-policy.html dist/privacy-policy.html" in pages_workflow, "privacy policy is not copied into Pages artifact")
require("cp docs/account-deletion.html dist/account-deletion.html" in pages_workflow, "account deletion page is not copied into Pages artifact")
require('"./boot.js?v=20260917-3"' in admin_index, "published admin index is not using canonical boot.js")
require("command-center-v3.js" in admin_boot, "canonical admin boot does not load command center v3")
require('"${PAGE_URL}privacy-policy.html"' in pages_workflow, "Pages workflow is missing deployed privacy-page verification")
require('"${PAGE_URL}account-deletion.html"' in pages_workflow, "Pages workflow is missing deployed deletion-page verification")
require('"${PAGE_URL}admin/boot.js"' in pages_workflow, "Pages workflow is missing deployed admin-boot verification")

# Release workflow must build both the uploadable AAB and regression APK,
# and fingerprint the final outputs for traceability.
require("bundleRelease" in release_workflow and "assembleRelease" in release_workflow, "signed AAB/APK release build gate missing")
require("sha256sum release-artifacts/*" in release_workflow, "release fingerprinting missing")
require("test -s release-artifacts/fifty-fit-release.aab" in release_workflow, "AAB artifact verification missing")
require("test -s release-artifacts/fifty-fit-release.apk" in release_workflow, "APK artifact verification missing")

# The current production build still depends on these compatibility stages. The
# gate checks their presence in the build command rather than their exact order
# so the validator remains resilient to harmless ordering changes.
for script_name in [
    "patch-production-final.py",
    "patch-production-final-2.py",
    "patch-load-error-return.py",
    "patch-load-fallback.py",
    "patch-missing-profile-phase-prep.py",
    "patch-admin-entitlement-overlay.py",
    "patch-session-resilience.py",
    "patch-purchase-ack.py",
    "prepare-billing-release.py",
]:
    require(f"scripts/{script_name}" in package, f"{script_name} is no longer part of the release build")

# No suspicious retired package id may remain in normal source files; package
# replacement is intentionally build-scoped for compatibility with legacy data.
for file_name in ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]:
    require("com.fittrack.app" not in read(file_name), f"retired package id remains in {file_name}")

print("[update-safety] PASS")
