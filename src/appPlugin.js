// ============================================================
// Capacitor App Plugin Wrapper (@capacitor/app)
// ============================================================
// Thin, lazy wrapper around the official `@capacitor/app` plugin.
// Uses a dynamic import so a plain browser / CI build (without the
// native module resolvable) still works without failing to import.
// Mirrors the dynamic-import pattern used across this project
// (billing.js, review.js, googleAuth.js, network.js).
// ============================================================

let appPluginPromise = null;
function getAppPlugin() {
  if (!appPluginPromise) {
    appPluginPromise = (async () => {
      try {
        const mod = await import(/* @vite-ignore */ "@capacitor/app");
        const plugin = mod.App;
        return plugin && typeof plugin.addListener === "function"
          ? plugin
          : null;
      } catch (e) {
        console.warn(
          "Capacitor App plugin not available — running in web preview",
          e,
        );
        return null;
      }
    })();
  }
  return appPluginPromise;
}

/**
 * Register a native back-button handler (Android). Returns a cleanup
 * function. On web/preview (no plugin) it no-ops.
 * @param {(event?: any) => void} handler
 * @returns {() => void} cleanup function.
 */
export async function addBackButtonListener(handler) {
  const plugin = await getAppPlugin();
  if (!plugin) return () => {};
  try {
    const handle = await plugin.addListener("backButton", handler);
    return () => handle?.remove?.();
  } catch (e) {
    console.warn("Capacitor App backButton listener failed", e);
    return () => {};
  }
}

/**
 * Exit the native app. On web/preview it no-ops.
 */
export async function exitApp() {
  const plugin = await getAppPlugin();
  if (!plugin) return;
  try {
    await plugin.exitApp();
  } catch (e) {
    console.warn("Capacitor App exit failed (web preview)", e);
  }
}
