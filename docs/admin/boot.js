const root = document.getElementById("app");
function showBootError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  root.innerHTML = `<div class="login-page"><div class="login-card"><div class="brand center"><div class="brand-mark big">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div><h1>Admin could not start</h1><p class="muted">The page loaded, but the Firebase admin module could not start.</p><div class="error">${message.replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}</div><p class="muted">Refresh this page once. If this message remains, send this exact error to the developer.</p></div></div>`;
}

// GitHub Pages publishes /docs as the site root. The repository's canonical
// admin implementation lives under /admin, so load that current code directly
// from GitHub's public raw endpoint. A timestamp query prevents stale browser
// caching after each main-branch update.
const cacheVersion = Date.now();
const adminBase = "https://raw.githubusercontent.com/Bodyahmed77/fittrack.app/main/admin/";

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = `${adminBase}styles.css?v=${cacheVersion}`;
document.head.appendChild(style);

Promise.all([
  import(`${adminBase}app.js?v=${cacheVersion}`),
  import(`${adminBase}cardio.js?v=${cacheVersion}`),
  import(`${adminBase}runtime-enhancements.js?v=${cacheVersion}`),
]).catch(showBootError);
