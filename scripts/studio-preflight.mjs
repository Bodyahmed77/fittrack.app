import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[studio-preflight] ${message}`);
}

const packageJson = JSON.parse(read("package.json"));
const capacitor = JSON.parse(read("capacitor.config.json"));
const firebase = read("src/firebase.js");
const aiCoach = read("src/aiCoach.js");
const aiReport = read("supabase/functions/ai-report/index.ts");
const health = read("supabase/functions/ai-coach-health/index.ts");
const app = read("src/App.jsx");
const main = read("src/main.jsx");

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
assert(app.includes("FIFTYFIT_ACCOUNT_RECOVERY_V1"), "account recovery hardening is missing from transformed App source");
assert(app.includes("FIFTYFIT_PRODUCTION_FINAL_V1"), "production final hardening is missing from transformed App source");
assert(main.includes("function StartupGate"), "startup gate is missing");
assert(!main.includes('"Your data was not deleted."'), "ErrorBoundary still contains an unverifiable data-deletion claim");
assert(!main.includes('"Your data was not deleted. Restart the app and try again."'), "ErrorBoundary still contains the old data-deletion claim");

for (const file of ["src/firebase.js", "src/aiCoach.js", "src/aiReport.js", "capacitor.config.json"]) {
  assert(!read(file).includes("com.fittrack.app"), `${file} contains the retired Android package id`);
}

console.log("[studio-preflight] PASS");
