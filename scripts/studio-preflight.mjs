import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function assert(condition, message) { if (!condition) throw new Error(`[studio-preflight] ${message}`); }

const packageJson = JSON.parse(read("package.json"));
const capacitor = JSON.parse(read("capacitor.config.json"));
const firebase = read("src/firebase.js");
const aiCoach = read("src/aiCoach.js");
const aiReport = read("supabase/functions/ai-report/index.ts");
const health = read("supabase/functions/ai-coach-health/index.ts");
const adminApi = read("supabase/functions/admin-api/index.ts");
const adminDashboard = read("src/AdminDashboard.jsx");
const adminClient = read("src/adminApi.js");
const app = read("src/App.jsx");
const main = read("src/main.jsx");
const adminBoot = read("admin/boot.js");
const adminCommandCenter = read("admin/command-center-v3.js");
const docsAdminBoot = read("docs/admin/boot.js");
const adminExpiryPatch = read("scripts/patch-admin-entitlement-expiry.py");

assert(packageJson.type === "module", "package must use ESM");
assert(capacitor.appId === "com.bodyahmed77.fiftyfit", "Android applicationId drift detected");
assert(firebase.includes('projectId: "fittrack-698fa"'), "Firebase projectId drift detected");
assert(!aiCoach.includes("ensurePlayCatalogLoaded()"), "AI Coach must not load Play Billing during module startup");
assert(!aiCoach.includes("ensureNativeKeyboardResize();\n\nlet __playCatalogPromise"), "AI Coach contains an unexpected startup side effect");
assert(aiCoach.includes("await ensureNativeKeyboardResize();"), "AI Coach keyboard preparation must remain feature-scoped");
assert(aiReport.includes("MAX_REPORTS_PER_HOUR = 10"), "AI report rate limit missing");
assert(aiReport.includes('status: "open"'), "AI report review status missing");
assert(health.includes("FIFTYFIT_HEALTH_PROBE_SECRET"), "AI health probe is not operator-gated");
assert(health.includes('return json(200, { ok: true });'), "AI health public response must stay minimal");

assert(adminApi.includes("assertAdmin"), "admin API must enforce admin authorization");
assert(adminApi.includes("ALLOWED_ORIGINS"), "admin API CORS must use an explicit allowlist");
assert(adminApi.includes("firestoreSearchUserByEmail") || adminApi.includes("firestoreSearchEmail"), "admin API centralized user search missing");
assert(adminApi.includes("admin_audit_log"), "admin API must produce an audit trail");
assert(adminApi.includes("user_pro_update"), "admin Pro management action missing");
assert(adminApi.includes("send_notification"), "admin notification action missing");
assert(adminApi.includes("function parseExpiry"), "admin expiry parser missing");
assert(
  adminApi.includes("return parsed.valid && parsed.ms > Date.now();") ||
  (adminApi.includes("function activeExpiry") && adminApi.includes("p.valid && p.ms > Date.now();")),
  "admin expiry must fail closed",
);

assert(adminDashboard.includes("Admin support entitlements"), "admin support entitlement view missing");
assert(adminDashboard.includes("Google Play entitlements"), "paid entitlement separation view missing");
assert(adminDashboard.includes("AI Reports"), "admin dashboard reports view missing");
assert(adminDashboard.includes("Billing"), "admin dashboard billing view missing");
assert(adminDashboard.includes("Audit"), "admin dashboard audit view missing");
assert(adminDashboard.includes("purchaseActive"), "admin purchase status must account for expiry");
assert(adminExpiryPatch.includes("const active = !!expiry && Number.isFinite(expiryMs) && expiryMs > Date.now();"), "admin support expiry patch is not fail-closed");
assert(adminClient.includes("/functions/v1/admin-api"), "admin API client endpoint missing");
assert(adminClient.includes("searchUsers"), "admin API client user-search method missing");

assert(app.includes("FIFTYFIT_ADMIN_DASHBOARD_V1"), "lazy admin dashboard integration missing");
assert(app.includes("FIFTYFIT_ACCOUNT_RECOVERY_V1"), "account recovery hardening is missing from transformed App source");
assert(app.includes("FIFTYFIT_PRODUCTION_FINAL_V1"), "production final hardening is missing from transformed App source");
assert(main.includes("function StartupGate"), "startup gate is missing");
assert(!/^\s*import\s+\{[^}]*Keyboard[^}]*\}\s+from\s+[\"']@capacitor\/keyboard[\"'];?/m.test(main), "Capacitor Keyboard must not be statically imported at app startup");
assert(main.includes('import("@capacitor/keyboard")'), "Capacitor Keyboard native import must remain lazy");
assert(!main.includes('"Your data was not deleted."'), "ErrorBoundary still contains an unverifiable data-deletion claim");
assert(!main.includes('"Your data was not deleted. Restart the app and try again."'), "ErrorBoundary still contains the old data-deletion claim");

assert(adminCommandCenter.includes("FIFTYFIT_ADMIN_COMMAND_CENTER_V3"), "large admin command center v3 is missing");
assert(adminCommandCenter.includes("Plan Requests"), "large admin plan request workspace is missing");
assert(adminCommandCenter.includes("System Health"), "large admin system health workspace is missing");
assert(adminCommandCenter.includes("Export CSV"), "large admin export action is missing");
assert(adminCommandCenter.includes("getCountFromServer"), "large admin exact customer count is missing");
assert(adminBoot.includes("command-center-v3.js"), "canonical admin boot is not loading command center v3");
assert(docsAdminBoot.includes("command-center-v3.js"), "GitHub Pages admin boot is not loading command center v3");

for (const file of ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]) {
  assert(!read(file).includes("com.fittrack.app"), `${file} contains the retired Android package id`);
}

console.log("[studio-preflight] PASS");
