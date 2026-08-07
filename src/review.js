// ============================================================
// In-App Review Wrapper
// ============================================================
// Native in-app review via @capacitor-community/in-app-review.
// Extend this later to switch to ReviewCat if needed.
// ============================================================

let plugin = null;
async function getPlugin() {
  if (plugin) return plugin;
  try {
    const mod = await import(
      /* @vite-ignore */ "@capacitor-community/in-app-review"
    );
    plugin = mod.AppReview;
    return plugin;
  } catch (e) {
    console.warn(
      "App Review plugin not available — running in preview mode",
      e,
    );
    return null;
  }
}

export async function requestReview() {
  const review = await getPlugin();
  if (!review) return { success: false, preview: true };
  try {
    await review.request();
    return { success: true, preview: false };
  } catch (e) {
    return { success: false, preview: false, error: e };
  }
}
