/* Fifty Fit network safety guard.
 *
 * Firebase Auth/Firestore can expose cached state while the device is offline.
 * We therefore protect the initial bootstrap when the app starts offline, but
 * we do NOT lock the whole app every time a gym Wi-Fi connection briefly drops.
 * Once the app has reached an online state, later offline periods become a
 * lightweight banner; React screens can decide which server-backed actions
 * need a connection.
 */
(function installFiftyFitNetworkGuard() {
  if (window.__FIFTY_FIT_NETWORK_GUARD__) return;
  window.__FIFTY_FIT_NETWORK_GUARD__ = true;

  const style = document.createElement("style");
  style.textContent = `
    #fifty-fit-network-guard {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background: #050505;
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: center;
    }
    #fifty-fit-network-guard.is-blocking { display: flex; }
    #fifty-fit-network-guard .ff-network-card {
      width: min(420px, 100%);
      padding: 30px 24px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 24px;
      background: #101010;
      box-shadow: 0 20px 70px rgba(0,0,0,.45);
    }
    #fifty-fit-network-guard .ff-network-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 18px;
      display: grid;
      place-items: center;
      border-radius: 20px;
      background: rgba(255,255,255,.08);
      font-size: 30px;
    }
    #fifty-fit-network-guard h2 { margin: 0 0 10px; font-size: 22px; }
    #fifty-fit-network-guard p { margin: 0; color: #a3a3a3; line-height: 1.6; }
    #fifty-fit-network-guard .ff-network-status { margin-top: 20px; color: #fff; font-size: 13px; }
    #fifty-fit-network-banner {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: max(12px, env(safe-area-inset-bottom));
      z-index: 2147483646;
      display: none;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 14px;
      background: rgba(16,16,16,.96);
      color: #fff;
      box-shadow: 0 12px 40px rgba(0,0,0,.35);
      font: 600 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #fifty-fit-network-banner.is-visible { display: flex; }
    #fifty-fit-network-banner .ff-network-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 8px;
      border-radius: 50%;
      background: #f59e0b;
    }
  `;
  document.head.appendChild(style);

  const guard = document.createElement("div");
  guard.id = "fifty-fit-network-guard";
  guard.setAttribute("role", "alertdialog");
  guard.setAttribute("aria-live", "assertive");
  guard.innerHTML = `
    <div class="ff-network-card">
      <div class="ff-network-icon" aria-hidden="true">⌁</div>
      <h2>Internet connection required</h2>
      <p>Fifty Fit needs an internet connection to securely verify your account before opening the app.</p>
      <div class="ff-network-status">Waiting for connection…</div>
    </div>
  `;
  document.body.appendChild(guard);

  const banner = document.createElement("div");
  banner.id = "fifty-fit-network-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `<span class="ff-network-dot" aria-hidden="true"></span><span>You're offline. Your saved screens remain available; actions that need the server will resume when you're back online.</span>`;
  document.body.appendChild(banner);

  let hasBeenOnline = navigator.onLine;
  let startupGuard = !navigator.onLine;
  let startupTimer = null;

  const update = () => {
    const offline = !navigator.onLine;
    if (!offline) {
      hasBeenOnline = true;
      startupGuard = false;
      if (startupTimer) clearTimeout(startupTimer);
      startupTimer = null;
    }

    // Protect only the initial bootstrap when there is no trusted network
    // state yet. After the app has been online once, never lock the UI merely
    // because connectivity temporarily disappeared.
    const shouldBlock = offline && startupGuard && !hasBeenOnline;
    guard.classList.toggle("is-blocking", shouldBlock);
    banner.classList.toggle("is-visible", offline && !shouldBlock);
    document.documentElement.style.overflow = shouldBlock ? "hidden" : "";
    document.body.style.overflow = shouldBlock ? "hidden" : "";

    window.dispatchEvent(new CustomEvent("fiftyfit:network", {
      detail: { online: !offline },
    }));
  };

  // Give the native/web runtime a moment to report its initial state before
  // deciding that an offline startup is intentional.
  if (startupGuard) {
    startupTimer = setTimeout(() => {
      startupGuard = true;
      update();
    }, 1500);
  }

  window.addEventListener("offline", update, { passive: true });
  window.addEventListener("online", update, { passive: true });
  document.addEventListener("visibilitychange", update, { passive: true });
  update();
})();
