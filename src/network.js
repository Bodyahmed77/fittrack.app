// ============================================================
// Fifty Fit App — Network / Internet Connectivity
// ============================================================
// Native Capacitor networking remains the preferred path for the real
// Android/iOS application. The public Web Demo uses only browser signals.
// ============================================================

// IMPORTANT: imported modules execute before main.jsx can set a runtime
// window flag. Demo detection therefore must be available at module-evaluation
// time via Vite's build constant and the URL query itself.
const WEB_DEMO_BUILD = import.meta.env?.VITE_WEB_DEMO === "1";
const isWebDemo = () =>
  WEB_DEMO_BUILD ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1");

// Lazily resolve the Capacitor Network plugin only for the real native app.
let networkPluginPromise = null;
function getNetworkPlugin() {
  if (isWebDemo()) return Promise.resolve(null);
  if (!networkPluginPromise) {
    networkPluginPromise = (async () => {
      try {
        const mod = await import("@capacitor/network");
        const plugin = mod.Network;
        return plugin && typeof plugin.getStatus === "function" ? plugin : null;
      } catch (_) {
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
