// ============================================================
// Capacitor Local Notifications Wrapper (@capacitor/local-notifications)
// ============================================================
// Thin, lazy wrapper around the official `@capacitor/local-notifications`
// plugin. Uses a dynamic import so a plain browser / CI build (without
// the native module resolvable) still works without failing to import.
// Mirrors the dynamic-import pattern used across this project
// (billing.js, review.js, googleAuth.js, network.js, appPlugin.js).
// ============================================================

let notificationsPluginPromise = null;
function getNotificationsPlugin() {
  if (!notificationsPluginPromise) {
    notificationsPluginPromise = (async () => {
      try {
        const mod = await import(
          /* @vite-ignore */ "@capacitor/local-notifications"
        );
        const plugin = mod.LocalNotifications;
        return plugin && typeof plugin.schedule === "function" ? plugin : null;
      } catch (e) {
        console.warn(
          "Capacitor Local Notifications plugin not available — running in web preview",
          e,
        );
        return null;
      }
    })();
  }
  return notificationsPluginPromise;
}

export async function schedule(notifications) {
  const plugin = await getNotificationsPlugin();
  if (!plugin) return { preview: true };
  try {
    return await plugin.schedule({ notifications });
  } catch (e) {
    console.warn("LocalNotifications.schedule failed (web preview)", e);
    return { preview: true, error: e };
  }
}

export async function cancel(opts) {
  const plugin = await getNotificationsPlugin();
  if (!plugin) return { preview: true };
  try {
    return await plugin.cancel(opts);
  } catch (e) {
    console.warn("LocalNotifications.cancel failed (web preview)", e);
    return { preview: true, error: e };
  }
}

export async function requestPermissions() {
  const plugin = await getNotificationsPlugin();
  if (!plugin) return { display: "denied" };
  try {
    return await plugin.requestPermissions();
  } catch (e) {
    console.warn("LocalNotifications.requestPermissions failed", e);
    return { display: "denied" };
  }
}

export async function checkPermissions() {
  const plugin = await getNotificationsPlugin();
  if (!plugin) return { display: "denied" };
  try {
    return await plugin.checkPermissions();
  } catch (e) {
    console.warn("LocalNotifications.checkPermissions failed", e);
    return { display: "denied" };
  }
}
