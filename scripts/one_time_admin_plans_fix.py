from pathlib import Path
import re

# Client-owned state must never overwrite Admin-owned plans.
app = Path('src/App.jsx')
s = app.read_text(encoding='utf-8')
old = '''const persisted = Object.fromEntries(
          Object.entries(next).filter(([key]) => key !== "entitlements"),
        );'''
new = '''const persisted = Object.fromEntries(
          Object.entries(next).filter(
            ([key]) =>
              key !== "entitlements" &&
              key !== "customTrainingPlan" &&
              key !== "customNutritionPlan",
          ),
        );'''
if old not in s:
    raise SystemExit('setData persistence block not found')
s = s.replace(old, new, 1)

# Do not let selecting a built-in plan erase an Admin-assigned plan.
s, n = re.subn(
    r'\n\s*// A built-in plan selection intentionally replaces an admin custom plan\.\n\s*next\.customTrainingPlan = null;',
    '', s, count=1,
)
if n != 1:
    raise SystemExit('customTrainingPlan deletion branch not found')

# Put the published training plan into the real Plans screen.
marker = '      {data.customNutritionPlan && data.entitlements.nutritionPro && ('
if 'PERSONALIZED TRAINING' not in s:
    training_card = '''      {data.customTrainingPlan && data.entitlements.trainingPro && (
        <div style={{ padding: "0 18px 10px" }}>
          <Card
            onClick={() => go("workout")}
            style={{
              background: C.greenSoft,
              border: `1.5px solid ${C.green}66`,
              cursor: "pointer",
            }}
          >
            <div style={{ color: C.sub, fontSize: 10, fontWeight: 900, letterSpacing: 0.6 }}>
              {ar ? "خطة تدريب مخصصة" : "PERSONALIZED TRAINING"}
            </div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 900, marginTop: 4 }}>
              🏋️ {ar ? (data.customTrainingPlan.titleAr || "خطة التدريب المخصصة") : (data.customTrainingPlan.title || "Personal Training Plan")}
            </div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 4 }}>
              {ar ? `تبدأ ${data.customTrainingPlan.startDate || dateKey(0)}` : `Starts ${data.customTrainingPlan.startDate || dateKey(0)}`}
            </div>
            <div style={{ color: C.text, fontSize: 11.5, fontWeight: 800, marginTop: 9 }}>
              {ar ? "فتح خطة التدريب ←" : "Open Training Plan →"}
            </div>
          </Card>
        </div>
      )}
'''
    if marker not in s:
        raise SystemExit('Plans nutrition card marker not found')
    s = s.replace(marker, training_card + marker, 1)
app.write_text(s, encoding='utf-8')

# Give notifications an explicit destination.
admin = Path('admin/app.js')
a = admin.read_text(encoding='utf-8')
a, n1 = re.subn(r'(type: "training_plan_ready",\n)', r'\1    route: { screen: "workout", params: {} },\n', a, count=1)
a, n2 = re.subn(r'(type: "nutrition_plan_ready",\n)', r'\1    route: { screen: "nutritionPlan", params: {} },\n', a, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'notification route patch failed: training={n1}, nutrition={n2}')
admin.write_text(a, encoding='utf-8')

# TikTok: keep the exact supplied web URL in the full-screen iframe, but do not sandbox it.
index = Path('index.html')
h = index.read_text(encoding='utf-8')
sandbox = '              frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");\n'
if sandbox not in h:
    raise SystemExit('TikTok sandbox line not found')
h = h.replace(sandbox, '              frame.removeAttribute("sandbox");\n', 1)
index.write_text(h, encoding='utf-8')

# GitHub Pages root: make Admin Dashboard explicitly discoverable while keeping legal resources.
Path('docs/index.html').write_text('''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>Fifty Fit</title>
  <style>body{font-family:Arial,sans-serif;max-width:760px;margin:50px auto;padding:0 20px;line-height:1.7}a{display:block;margin:14px 0}</style>
</head>
<body>
  <h1>Fifty Fit</h1>
  <p>Official resources and staff tools for Fifty Fit.</p>
  <a href="./admin/">Admin Dashboard</a>
  <a href="./privacy-policy.html">Privacy Policy</a>
  <a href="./account-deletion.html">Account &amp; Data Deletion</a>
</body>
</html>
''', encoding='utf-8')

# GitHub Pages Admin: always load the canonical /admin assets and the nutrition builder.
Path('docs/admin/boot.js').write_text('''const root = document.getElementById("app");

function showBootError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const safe = message.replace(/[&<>\\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "'": "&#39;",
  }[c]));
  root.innerHTML = `<div class="login-page"><div class="login-card"><div class="brand center"><div class="brand-mark big">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div><h1>Admin could not start</h1><p class="muted">The page loaded, but the Firebase admin module could not start.</p><div class="error">${safe}</div><p class="muted">Refresh this page once. If this message remains, send this exact error to the developer.</p></div></div>`;
}

const cacheVersion = Date.now();
const rawBase = "https://raw.githubusercontent.com/Bodyahmed77/fittrack.app/main/admin/";

async function fetchText(name) {
  const response = await fetch(`${rawBase}${name}?v=${cacheVersion}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load admin asset ${name} (${response.status})`);
  return response.text();
}

function importBlob(source, label) {
  const blob = new Blob([source], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  return import(url).finally(() => URL.revokeObjectURL(url)).catch((error) => {
    error.message = `${label}: ${error.message || error}`;
    throw error;
  });
}

async function boot() {
  const [styles, appSource, cardioSource, nutritionSource] = await Promise.all([
    fetchText("styles.css"),
    fetchText("app.js"),
    fetchText("cardio.js"),
    fetchText("nutrition-builder.js"),
  ]);

  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  const firebaseConfigModule = `const firebaseConfig = ${JSON.stringify({
    apiKey: "AIzaSyANEXYUVqaGss1i9WS5gH7Ic3UrBgKG_qc",
    authDomain: "fittrack-698fa.firebaseapp.com",
    projectId: "fittrack-698fa",
    storageBucket: "fittrack-698fa.firebasestorage.app",
    messagingSenderId: "632925500741",
    appId: "1:632925500741:web:1d42d331f0bd09f4c67a2c",
    measurementId: "G-7S75NTCV5B",
  })};`;

  const normalizedApp = appSource.replace(
    'import { firebaseConfig } from "./firebase-config.js";',
    firebaseConfigModule,
  );
  const normalizedNutrition = nutritionSource.replace(
    'import { firebaseConfig } from "./firebase-config.js";',
    firebaseConfigModule,
  );

  await importBlob(normalizedApp, "admin/app.js");
  await importBlob(cardioSource, "admin/cardio.js");
  await importBlob(normalizedNutrition, "admin/nutrition-builder.js");
}

boot().catch(showBootError);
''', encoding='utf-8')

page = Path('docs/admin/index.html')
page_text = page.read_text(encoding='utf-8').replace('boot.js?v=20260813-2', 'boot.js?v=20260813-4')
page.write_text(page_text, encoding='utf-8')

print('Targeted fixes prepared successfully.')
