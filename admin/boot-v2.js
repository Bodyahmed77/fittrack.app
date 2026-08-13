const root = document.getElementById("app");

function showBootError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  root.innerHTML = `<div class="login-page"><div class="login-card"><div class="brand center"><div class="brand-mark big">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div><h1>Admin could not start</h1><p class="muted">The page loaded, but the Firebase admin module could not start.</p><div class="error">${message.replace(/[&<>\"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}</div><p class="muted">Refresh this page once. If this message remains, send this exact error to the developer.</p></div></div>`;
}

const CACHE_VERSION = "20260813-1";
Promise.all([
  import(`./app.js?v=${CACHE_VERSION}`),
  import(`./cardio.js?v=${CACHE_VERSION}`),
]).catch(showBootError);
