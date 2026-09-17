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
firestore_rules = read("firestore.rules")
release_workflow = read(".github/workflows/build-android.yml")
pages_workflow = read(".github/workflows/deploy-web-demo.yml")
admin_index = read("admin/index.html")
admin_boot = read("admin/boot.js")
web_demo_index = read("web-demo/index.html")
web_demo_main = read("web-demo/main.jsx")
web_demo_styles = read("web-demo/styles.css")
web_demo_vite = read("vite.webdemo.config.js")

script_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted((ROOT / "scripts").glob("*.py"))
)

require('"com.bodyahmed77.fiftyfit"' in capacitor, "canonical Android applicationId missing")
require("fittrack-698fa" in app or "fittrack-698fa" in read("src/firebase.js"), "Firebase project identity missing")
require("versionCode {2000+n}" in release_workflow, "release versionCode is not generated monotonically from workflow runs")
require(re.search(r'versionName\s+"1\.0\.\{n\}"', release_workflow) is not None, "release versionName generation missing")

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
require("mergeEntitlementSources" in admin_overlay, "entitlement merge guard missing")
require("adminEntitlementsRef" in admin_overlay, "admin support entitlement state is not isolated")
require("request.resource.data.get(\"adminEntitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects admin support entitlement writes")
require("request.resource.data.get(\"entitlements\", {}) ==" in firestore_rules, "Firestore rule no longer protects paid entitlement writes")

delete_account = read("supabase/functions/delete-account/index.ts")
require("delete_user_data" in delete_account and "p_uid" in delete_account, "delete-account RPC contract drift detected")

require("cp docs/privacy-policy.html dist/privacy-policy.html" in pages_workflow, "privacy policy is not copied into Pages artifact")
require("cp docs/account-deletion.html dist/account-deletion.html" in pages_workflow, "account deletion page is not copied into Pages artifact")
require('"./boot.js?v=20260917-3"' in admin_index, "published admin index is not using canonical boot.js")
require("command-center-v3.js" in admin_boot, "canonical admin boot does not load command center v3")
require('"${PAGE_URL}privacy-policy.html"' in pages_workflow, "Pages workflow is missing deployed privacy-page verification")
require('"${PAGE_URL}account-deletion.html"' in pages_workflow, "Pages workflow is missing deployed deletion-page verification")
require('"${PAGE_URL}admin/boot.js"' in pages_workflow, "Pages workflow is missing deployed admin-boot verification")

for path_name in [
    "web-demo/index.html",
    "web-demo/main.jsx",
    "web-demo/styles.css",
    "vite.webdemo.config.js",
]:
    require((ROOT / path_name).is_file(), f"isolated web-demo file missing: {path_name}")
require('"web-demo"' in web_demo_vite and "root:" in web_demo_vite, "web-demo Vite root must target web-demo/")
require("npx vite build --config vite.webdemo.config.js" in pages_workflow, "Pages workflow must build isolated web-demo directly")
require("VITE_WEB_DEMO" not in pages_workflow and "npm run build" not in pages_workflow, "Pages workflow must not build production App.jsx in demo mode")
require("data-fiftyfit-demo-mode" in web_demo_index, "demo HTML marker missing")
require("root.dataset.fiftyfitDemoMode = \"1\"" in web_demo_main, "demo runtime mode marker missing")
require("root.dataset.fiftyfitDemoReady = \"1\"" in web_demo_main, "demo runtime ready marker missing")
require("localStorage" in web_demo_main and "fiftyfit:web-demo" in web_demo_main, "local demo persistence missing")
require("Day 1" in web_demo_main, "demo Day 1 product invariant missing")
for source in [web_demo_main, web_demo_index, web_demo_styles, web_demo_vite]:
    require(not re.search(r"firebase|firestore|capacitor|billing|google-play|google\.com", source, re.I), "production integration leaked into isolated web-demo source")

require("bundleRelease" in release_workflow and "assembleRelease" in release_workflow, "signed AAB/APK release build gate missing")
require("sha256sum release-artifacts/*" in release_workflow, "release fingerprinting missing")
require("test -s release-artifacts/fifty-fit-release.aab" in release_workflow, "AAB artifact verification missing")
require("test -s release-artifacts/fifty-fit-release.apk" in release_workflow, "APK artifact verification missing")

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

for file_name in ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]:
    require("com.fittrack.app" not in read(file_name), f"retired package id remains in {file_name}")

print("[update-safety] PASS")
