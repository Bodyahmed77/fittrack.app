const CACHE_VERSION = "20260902-live3";
let wrappedButton = null;
let wrapperObserver = null;
let refreshing = false;

function ensureLiveStyles() {
  if (document.getElementById("fiftyfit-live-refresh-style")) return;
  const style = document.createElement("style");
  style.id = "fiftyfit-live-refresh-style";
  style.textContent = `
    .fiftyfit-live-refresh-status { margin-inline-start: 8px; font-size: 11px; color: #7f8c8d; white-space: nowrap; }
    .fiftyfit-live-refresh-status.live { color: #68d391; }
    #refresh-customers.fiftyfit-refreshing { opacity: .72; pointer-events: none; }
  `;
  document.head.appendChild(style);
}

function stamp(message, live = false) {
  const node = document.getElementById("fiftyfit-live-refresh-status");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("live", live);
}

function setBusy(button, busy) {
  button.classList.toggle("fiftyfit-refreshing", busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
}

function wrapRefreshButton() {
  ensureLiveStyles();
  const button = document.getElementById("refresh-customers");
  if (!button || button === wrappedButton || typeof button.onclick !== "function") return;
  wrappedButton = button;

  if (!document.getElementById("fiftyfit-live-refresh-status")) {
    const status = document.createElement("span");
    status.id = "fiftyfit-live-refresh-status";
    status.className = "fiftyfit-live-refresh-status";
    status.textContent = "Live sync ready";
    button.parentElement?.appendChild(status);
  }

  const original = button.onclick;
  button.onclick = async function liveRefresh(event) {
    if (refreshing) return;
    refreshing = true;
    setBusy(button, true);
    stamp("Refreshing from Firestore…");
    const started = Date.now();
    try {
      await Promise.resolve(original.call(this, event));
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      stamp(`Updated ${new Date().toLocaleTimeString()} · ${elapsed}s`, true);
    } catch (error) {
      console.warn("Fifty Fit admin live refresh failed", error);
      stamp("Refresh failed — retry", false);
    } finally {
      setBusy(button, false);
      refreshing = false;
    }
  };

  if (!window.__fiftyFitLiveRefreshBound) {
    window.__fiftyFitLiveRefreshBound = true;
    window.addEventListener("online", () => document.getElementById("refresh-customers")?.click());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        document.getElementById("refresh-customers")?.click();
      }
    });
  }
}

function start() {
  ensureLiveStyles();
  wrapRefreshButton();
  wrapperObserver?.disconnect();
  wrapperObserver = new MutationObserver(() => wrapRefreshButton());
  wrapperObserver.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  setInterval(wrapRefreshButton, 4000);
}

if (!window.__fiftyFitLiveRefreshLoaded) {
  window.__fiftyFitLiveRefreshLoaded = CACHE_VERSION;
  start();
}
