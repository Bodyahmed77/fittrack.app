// ============================================================
// FitTrack AI Coach — compact per-request context (no chat history)
// ============================================================
// Call from AICoachDrawer with current app data + today's workout slice.
// Never include tokens, API keys, video URLs, or full logs.

/**
 * @param {object} data - app state from useAppData
 * @param {string} lang - "ar" | "en"
 * @param {object} workoutSlice
 * @param {string} workoutSlice.dayName - Mon..Sun
 * @param {string} [workoutSlice.dayTitle]
 * @param {string} [workoutSlice.planName]
 * @param {string} [workoutSlice.planId]
 * @param {string} [workoutSlice.todayDate] - YYYY-MM-DD local
 * @param {Array} workoutSlice.exercises - from getUsableExercises().list
 */
export function buildFitTrackAiContext(data, lang, workoutSlice = {}) {
  const ar = lang === "ar";
  const today =
    typeof workoutSlice.todayDate === "string" && workoutSlice.todayDate
      ? workoutSlice.todayDate
      : new Date().toISOString().slice(0, 10);

  const acc = data?.account || {};
  const bw = Array.isArray(data?.bodyWeight) ? data.bodyWeight : [];
  const currentWeight =
    bw.length > 0 ? bw[bw.length - 1]?.weight : acc.weight || null;

  let weightDelta = null;
  if (bw.length >= 2) {
    const prev = Number(bw[bw.length - 2]?.weight);
    const cur = Number(bw[bw.length - 1]?.weight);
    if (Number.isFinite(prev) && Number.isFinite(cur)) {
      weightDelta = Number((cur - prev).toFixed(1));
    }
  }

  const log = data?.logs?.[today] || {};
  const exercisesIn = Array.isArray(workoutSlice.exercises)
    ? workoutSlice.exercises
    : [];

  const compactExercises = exercisesIn.slice(0, 12).map((e) => {
    const sets = log[e.id]?.sets || [];
    const doneSets = sets.filter((s) => s.done).length;
    return {
      name: ar ? e.nameAr || e.name : e.name,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      completedSets: doneSets,
      finished: !!log[e.id]?.finished,
    };
  });

  const totalSets = compactExercises.reduce(
    (a, e) => a + (Number(e.targetSets) || 0),
    0,
  );
  const doneSets = compactExercises.reduce(
    (a, e) => a + (Number(e.completedSets) || 0),
    0,
  );

  const targets = data?.dailyTargets || null;
  const mealsToday = data?.meals?.[today] || {};
  let mealsLogged = 0;
  try {
    Object.values(mealsToday).forEach((m) => {
      mealsLogged += Array.isArray(m?.items) ? m.items.length : 0;
    });
  } catch (_) {
    /* ignore */
  }

  return {
    user: {
      name: acc.name || null,
      gender: acc.gender || null,
      age: acc.age || null,
      height: acc.height || null,
      weight:
        currentWeight != null && currentWeight !== "" ? currentWeight : null,
      goal: acc.goal || null,
      daysPerWeek: acc.daysPerWeek || null,
      activityLevel: acc.activityLevel || null,
    },
    workout: {
      planId: workoutSlice.planId || data?.activePlanId || null,
      planName: workoutSlice.planName || null,
      todayWeekday: workoutSlice.dayName || null,
      todayDate: today,
      dayTitle: workoutSlice.dayTitle || null,
      isRestDay: compactExercises.length === 0,
      exercises: compactExercises,
      setsDone: doneSets,
      setsTotal: totalSets,
      workoutPct: totalSets ? Math.round((doneSets / totalSets) * 100) : 0,
    },
    weight: {
      current:
        currentWeight != null && currentWeight !== "" ? currentWeight : null,
      recentDelta: weightDelta,
      entriesCount: bw.length,
    },
    nutrition: {
      hasPlan: !!data?.nutritionPlan,
      dailyTargets: targets
        ? {
            calories: targets.calories ?? targets.kcal ?? null,
            protein: targets.protein ?? null,
            carbs: targets.carbs ?? null,
            fat: targets.fat ?? null,
          }
        : null,
      mealsLoggedToday: mealsLogged,
    },
  };
}
