// ============================================================
// Fifty Fit App — Network / Internet Connectivity
// ============================================================
// Provides a single, reliable source of truth for "is the device online?"
// Native Capacitor networking remains the preferred path for the Android/iOS
// application. The public Web Demo intentionally stays on the browser signal
// so a browser plugin shim can never break initial rendering.
// ============================================================

const isWebDemo = () =>
  typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ === true;

// Lazily resolve the Capacitor Network plugin for the real native app.
let networkPluginPromise = null;
function getNetworkPlugin() {
  if (isWebDemo()) return Promise.resolve(null);
  if (!networkPluginPromise) {
    networkPluginPromise = (async () => {
      try {
        const mod = await import("@capacitor/network");
        const plugin = mod.Network;
        return plugin && typeof plugin.getStatus === "function" ? plugin : null;
      } catch (e) {
        return null;
      }
    })();
  }
  return networkPluginPromise;
}

let capacitorChecked = false;
let hasCapacitorNetwork = false;
async function useCapacitorNetwork() {
  if (isWebDemo()) return false;
  if (!capacitorChecked) {
    hasCapacitorNetwork = Boolean(await getNetworkPlugin());
    capacitorChecked = true;
  }
  return hasCapacitorNetwork;
}

export async function isOnline() {
  // The public demo is self-contained; use the browser signal only.
  if (isWebDemo()) {
    return typeof navigator !== "undefined" ? Boolean(navigator.onLine) : true;
  }
  if (await useCapacitorNetwork()) {
    try {
      const plugin = await getNetworkPlugin();
      const status = await plugin.getStatus();
      return Boolean(status?.connected);
    } catch (e) {
      console.warn("Capacitor Network status failed, using web fallback", e);
    }
  }
  return typeof navigator !== "undefined" ? Boolean(navigator.onLine) : true;
}

export function watchNetwork(callback) {
  const push = (value) => {
    try {
      callback(Boolean(value));
    } catch (e) {
      console.error("watchNetwork callback error", e);
    }
  };

  const cleanups = [];

  // Never import/register the native Network plugin in the public demo.
  if (!isWebDemo()) {
    getNetworkPlugin().then((plugin) => {
      if (!plugin) return;
      try {
        const handle = plugin.addListener("networkStatusChange", (status) =>
          push(status?.connected),
        );
        cleanups.push(() => handle?.remove?.());
      } catch (e) {
        console.warn("Capacitor Network listener failed", e);
      }
    });
  }

  if (typeof window !== "undefined") {
    const on = () => push(true);
    const off = () => push(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    cleanups.push(() => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
