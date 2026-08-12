// ============================================================
// Fifty Fit — External Configuration
// ============================================================
// Centralize all external assets (images, videos, product IDs)
// here so they can be updated easily without touching the app logic.
// ============================================================

// ------------------------------------------------------------
// EXERCISE IMAGES
// Every exercise is rendered with a consistent, hand-crafted SVG
// vector illustration (see the ExerciseVisual component in App.jsx).
// ------------------------------------------------------------
export const EXERCISE_IMAGES = {
  bench_press: "bench",
  incline_db_press: "incline",
  chest_fly: "fly",
  dips: "dips",
  tricep_pushdown: "triceps",
  overhead_ext: "overhead",
  push_up: "pushup",
  zigzag_tricep_ext: "triceps",
  lat_pulldown: "lat",
  barbell_row: "row",
  seated_row: "row",
  single_arm_seated_row: "row",
  bicep_curl: "curl",
  behind_body_bicep_curl: "curl",
  hammer_curl: "curl",
  supported_db_curl: "curl",
  squat: "squat",
  hack_squat: "squat",
  leg_press: "legpress",
  leg_extension: "legext",
  abduction: "abduction",
  reverse_curl: "curl",
  face_pull: "facepull",
  lunges: "lunge",
  leg_curl: "legcurl",
  calf_raise: "calf",
  ohp: "ohp",
  lateral_raise: "latraise",
  rear_delt_fly: "fly",
  shrugs: "shrugs",
  deadlift: "deadlift",
  pull_up: "pullup",
  plank: "plank",
  treadmill: "cardio",
  bike: "cardio",
  crunches: "abs",
  leg_raise: "abs",
  jump_rope: "cardio",
  burpees: "burpees",
};

// ------------------------------------------------------------
// EXERCISE VIDEO IDs (TikTok embeds / YouTube embeds)
// TikTok URL values are intentionally kept as direct URLs so the
// exercise viewer can load them in the normal in-app WebView.
// ------------------------------------------------------------
export const EXERCISE_VIDEOS = {
  bench_press: "7603190204740013313", // Chest press machine
  incline_db_press: "7267987124610239762", // Incline chest press machine
  chest_fly: "eozdVDA78K0", // YouTube
  dips: "2z8JmcrW-As", // YouTube
  tricep_pushdown: "7586888221125070094", // TikTok — zigzag tricep extension
  zigzag_tricep_ext: "7586888221125070094", // TikTok — zigzag tricep extension
  overhead_ext: "7527210325834206486", // Overhead tricep extension
  push_up: "IODxDxX7oi4", // YouTube — proper push-up
  lat_pulldown: "7665886081329532174", // Lat pulldown
  barbell_row: "7532789627212631314", // T-bar row
  seated_row: "7639010632561478934", // Seated row
  single_arm_seated_row: "7639010632561478934", // TikTok — single arm seated row
  bicep_curl: "7636460964870720788", // TikTok — behind-body bicep curl
  behind_body_bicep_curl: "7636460964870720788", // TikTok — behind-body bicep curl
  hammer_curl: "7623849292461051156", // Hammer curl
  supported_db_curl: "7636460964870720788", // TikTok — supported dumbbell curl
  squat: "7513352117692665094", // Smith machine squat
  hack_squat: "7513352117692665094", // Hack squat
  leg_press: "7545454872586423574", // Leg press
  leg_extension: "7564750740061752598", // Leg extension
  abduction: "7419086233487281415", // Abduction machine
  reverse_curl: "7214952400631778566", // Cable reverse curl
  face_pull: "7474058570451946757", // Face pull
  lunges: "7353289956699229472", // Bulgarian split squat
  leg_curl: "7521556521390460166", // Leg curl
  calf_raise: "7602285498962349342", // Standing calf raises
  ohp: "7663674671677705488", // Shoulder press machine
  lateral_raise: "7486685939025054981", // Lateral raise
  rear_delt_fly: "7630410819259387158", // Rear delt fly machine
  shrugs: "7500002250526395653", // Dumb shrugs
  deadlift: "7380964646062263558", // Romanian deadlift
  pull_up: "eGo4IYlbE5g", // YouTube — pull-up
  plank: "pSHjTRCQxIw", // YouTube — plank
  treadmill: "https://vt.tiktok.com/ZS4T2HfCY/", // TikTok
  bike: "https://vt.tiktok.com/ZS4T249MW/", // TikTok
  crunches: "7654453038815399171", // Abs rope crunches
  leg_raise: "hdng3ubkBrI", // YouTube
  jump_rope: "https://www.tiktok.com/@tiboinshape/video/7358498825012661537", // TikTok
  burpees: "https://vt.tiktok.com/ZS4TjS16a/", // TikTok
};

// ------------------------------------------------------------
// GOOGLE PLAY BILLING PRODUCT IDs
// Placeholder IDs — replace with real Play Console IDs after setup.
// ------------------------------------------------------------
export const BILLING_PRODUCTS = {
  training: "training_pro",
  nutrition: "nutrition_pro",
  both: "both_pro",
  ai: "ai_coach_pro",
};

// ------------------------------------------------------------
// AI COACH LIMITS
// ------------------------------------------------------------
export const FREE_AI_MESSAGES_PER_DAY = 3;
export const PRO_AI_MESSAGES_PER_DAY = 50;

export const AI_COACH_ENDPOINT =
  "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach";

export const AI_REPORT_ENDPOINT =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_AI_REPORT_ENDPOINT) ||
  (AI_COACH_ENDPOINT || "").replace(
    "/functions/v1/ai-coach",
    "/functions/v1/ai-report",
  );

export const VERIFY_PURCHASE_ENDPOINT =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_VERIFY_PURCHASE_ENDPOINT) ||
  (AI_COACH_ENDPOINT || "").replace(
    "/functions/v1/ai-coach",
    "/functions/v1/verify-purchase",
  );

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  "";
