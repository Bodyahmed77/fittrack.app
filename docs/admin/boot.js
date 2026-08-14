const root = document.getElementById("app");

function showBootError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const safe = message.replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
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
  // The current main branch contains the supported Nutrition Builder inside
  // nutrition-builder.js. Do not request the old PR-only nutrition-builder-ux.js
  // asset here; it is not part of the deployed admin bundle and caused a 404 boot failure.
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
