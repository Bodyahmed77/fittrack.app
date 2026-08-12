/* Fifty Fit network safety guard.
 *
 * Firebase authentication and Firestore can expose cached state while a device
 * is offline. For this app that is worse than simply blocking the UI because a
 * stale cached auth state can look like the user was signed into the wrong
 * account. Keep the whole app interaction blocked until the device reports a
 * network connection again.
 *
 * This is deliberately dependency-free so it runs before React and works in
 * the Capacitor WebView as well as the browser build.
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
    #fifty-fit-network-guard.is-visible { display: flex; }
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
    #fifty-fit-network-guard .ff-network-status {
      margin-top: 20px;
      color: #fff;
      font-size: 13px;
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
      <p>Fifty Fit needs an internet connection to securely verify your account and sync your progress.</p>
      <div class="ff-network-status">Waiting for connection…</div>
    </div>
  `;
  document.body.appendChild(guard);

  const update = () => {
    const offline = !navigator.onLine;
    guard.classList.toggle("is-visible", offline);
    document.documentElement.style.overflow = offline ? "hidden" : "";
    document.body.style.overflow = offline ? "hidden" : "";
  };

  window.addEventListener("offline", update, { passive: true });
  window.addEventListener("online", update, { passive: true });
  document.addEventListener("visibilitychange", update, { passive: true });
  update();
})();
