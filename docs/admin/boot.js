const root = document.getElementById("app");

function showBootError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  root.innerHTML = `<div class="login-page"><div class="login-card"><div class="brand center"><div class="brand-mark big">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div><h1>Admin could not start</h1><p class="muted">The page loaded, but the Firebase admin module could not start.</p><div class="error">${message.replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}</div><p class="muted">Refresh this page once. If this message remains, send this exact error to the developer.</p></div></div>`;
}

// GitHub Pages publishes /docs as the site root. The canonical admin source
// lives under /admin in the repository. GitHub Raw serves JavaScript with a
// MIME type that browsers may reject for module imports, so fetch the current
// source as text and import it from same-page Blob URLs.
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
  return import(url)
    .finally(() => URL.revokeObjectURL(url))
    .catch((error) => {
      error.message = `${label}: ${error.message || error}`;
      throw error;
    });
}

// The core admin app refreshes the customer list every 30 seconds. Because the
// app re-renders the customer screen when navigating back to it, its timer can
// otherwise accumulate and cause the dashboard to become progressively slower.
// Keep exactly one copy of that specific refresh timer while leaving unrelated
// timers untouched.
const nativeSetInterval = window.setInterval.bind(window);
const nativeClearInterval = window.clearInterval.bind(window);
let customerRefreshTimer = null;
window.setInterval = (handler, timeout, ...args) => {
  const source = typeof handler === "function" ? Function.prototype.toString.call(handler) : "";
  const isCustomerRefresh = timeout === 30000 && source.includes("refresh().catch");
  if (!isCustomerRefresh) return nativeSetInterval(handler, timeout, ...args);
  if (customerRefreshTimer !== null) nativeClearInterval(customerRefreshTimer);
  customerRefreshTimer = nativeSetInterval(handler, timeout, ...args);
  return customerRefreshTimer;
};

async function boot() {
  const [styles, appSource, cardioSource] = await Promise.all([
    fetchText("styles.css"),
    fetchText("app.js"),
    fetchText("cardio.js"),
  ]);

  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  // app.js has one relative import. Inline the public Firebase web config so
  // the blob module has no relative repository dependency.
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

  // Keep the Pages admin lightweight. The former runtime-enhancements layer
  // used MutationObserver + 4-second polling and is intentionally not loaded.
  await importBlob(normalizedApp, "admin/app.js");
  await importBlob(cardioSource, "admin/cardio.js");
}

boot().catch(showBootError);
