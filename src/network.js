// ============================================================
// Fifty Fit App — Network / Internet Connectivity
// ============================================================
// Provides a single, reliable source of truth for "is the device online?"
//
// Preferred path: the Capacitor Network plugin (`@capacitor/network`),
// which gives real native network state on Android/iOS.
//
// Fallback path: the browser's `navigator.onLine` flag plus the
// standard `online`/`offline` window events. This is used automatically
// when running in a plain browser (e.g. `npm run dev`) or when the
// Capacitor plugin isn't available.
//
// The whole module is intentionally dependency-light and avoids making
// unnecessary network requests — it only ever reflects the OS/browser
// connectivity signal, so there are no performance or battery concerns.
// ============================================================

// Lazily resolve the Capacitor Network plugin so a plain browser build
// (without the native plugin) still works without failing to import.
let networkPluginPromise = null;
function getNetworkPlugin() {
  // Only attempt the native import once per session.
  if (!networkPluginPromise) {
    networkPluginPromise = (async () => {
      try {
        const mod = await import("@capacitor/network");
        const plugin = mod.Network;
        // Guard: make sure the plugin actually exposes getStatus.
        return plugin && typeof plugin.getStatus === "function" ? plugin : null;
      } catch (e) {
        return null;
      }
    })();
  }
  return networkPluginPromise;
}

// True when the Capacitor Network plugin is present and usable.
let capacitorChecked = false;
let hasCapacitorNetwork = false;
async function useCapacitorNetwork() {
  if (!capacitorChecked) {
    hasCapacitorNetwork = Boolean(await getNetworkPlugin());
    capacitorChecked = true;
  }
  return hasCapacitorNetwork;
}

/**
 * Reads the current connectivity status.
 * @returns {Promise<boolean>} resolves with `true` when online.
 */
export async function isOnline() {
  if (await useCapacitorNetwork()) {
    try {
      const plugin = await getNetworkPlugin();
      const status = await plugin.getStatus();
      // `connected` reflects actual network access (not just a Wi-Fi link).
      return Boolean(status?.connected);
    } catch (e) {
      // Fall through to the web signal if the native call fails.
      console.warn("Capacitor Network status failed, using web fallback", e);
    }
  }
  return typeof navigator !== "undefined" ? Boolean(navigator.onLine) : true;
}

/**
 * Subscribes to connectivity changes and calls `callback(value)` whenever
 * the online state changes. Returns an unsubscribe function.
 *
 * - Uses the Capacitor Network plugin's `addListener("networkStatusChange")`
 *   when available (fires on native network transitions).
 * - Falls back to the browser `online`/`offline` events otherwise.
 *
 * @param {(online: boolean) => void} callback
 * @returns {() => void} function to remove all listeners.
 */
export function watchNetwork(callback) {
  const push = (value) => {
    try {
      callback(Boolean(value));
    } catch (e) {
      console.error("watchNetwork callback error", e);
    }
  };

  const cleanups = [];

  // Native listener (added asynchronously once the plugin resolves).
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

  // Always attach the lightweight web fallback listeners.
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
