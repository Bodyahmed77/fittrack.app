// ============================================================
// In-App Review Wrapper (@capacitor-community/in-app-review)
// ============================================================
// Google controls whether the native dialog actually appears.
// We only gate *when we ask* so we never spam the user.
// ============================================================

const REVIEW_STATE_KEY = "50fit-review-state";
const COOLDOWN_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks
const MIN_COMPLETED_WORKOUTS = 2;

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

function readState() {
  try {
    const raw = localStorage.getItem(REVIEW_STATE_KEY);
    if (!raw) return { lastAskedAt: 0, completedWorkouts: 0 };
    const parsed = JSON.parse(raw);
    return {
      lastAskedAt: Number(parsed.lastAskedAt) || 0,
      completedWorkouts: Number(parsed.completedWorkouts) || 0,
    };
  } catch (e) {
    return { lastAskedAt: 0, completedWorkouts: 0 };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
  } catch (e) {}
}

/** Count a meaningful completed workout toward review eligibility. */
export function recordMeaningfulWorkout() {
  const s = readState();
  s.completedWorkouts = (s.completedWorkouts || 0) + 1;
  writeState(s);
  return s.completedWorkouts;
}

/**
 * Request the native Google Play in-app review dialog only after meaningful
 * engagement and a long cooldown. Never mandatory; never on every launch.
 */
export async function maybeRequestReview(reason = "engagement") {
  const s = readState();
  const now = Date.now();
  if (s.completedWorkouts < MIN_COMPLETED_WORKOUTS) {
    return { success: false, skipped: "not_enough_engagement" };
  }
  if (s.lastAskedAt && now - s.lastAskedAt < COOLDOWN_MS) {
    return { success: false, skipped: "cooldown" };
  }

  const review = await getPlugin();
  if (!review) return { success: false, preview: true };

  try {
    await review.request();
    writeState({ ...s, lastAskedAt: now });
    return { success: true, preview: false, reason };
  } catch (e) {
    // Still mark asked so we do not hammer the API on failures.
    writeState({ ...s, lastAskedAt: now });
    return { success: false, preview: false, error: e };
  }
}

/** Direct request (e.g. after purchase). Still respects cooldown. */
export async function requestReview() {
  return maybeRequestReview("manual");
}
