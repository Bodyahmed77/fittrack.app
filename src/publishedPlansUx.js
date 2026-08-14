/**
 * Legacy plan-card injector — DISABLED.
 *
 * Home / Nutrition / Training plan cards are rendered exclusively by React
 * in App.jsx. The previous DOM-based injector duplicated plan cards on the
 * Android Home screen and broke layout / bottom navigation.
 *
 * Keep the export so existing call sites (main.jsx, index.html) do not throw.
 * The function is a no-op and performs no DOM injection.
 */
export function startPublishedPlansUx() {
  // Intentionally empty — React is the sole plan-card renderer.
  return () => {};
}
