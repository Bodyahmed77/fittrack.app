// ============================================================
// Fifty Fit App — External Configuration
// ============================================================
// Centralize all external assets (images, videos, product IDs)
// here so they can be updated easily without touching the app logic.
// ============================================================

// ------------------------------------------------------------
// EXERCISE IMAGES
// Every exercise is rendered with a consistent, hand-crafted SVG
// vector illustration (see the ExerciseVisual component in App.jsx).
// The `variant` below maps each exercise to its illustration so the
// whole app shares one clean, flat vector style — no external images,
// no broken placeholders, works fully offline.
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
// EXERCISE VIDEO IDs (TikTok Shorts / YouTube Shorts)
// Exercises with a corresponding TikTok video use the TikTok
// numeric video ID (embedded via https://www.tiktok.com/embed/v2/).
// The remaining exercises keep their YouTube Shorts video.
// ------------------------------------------------------------
export const EXERCISE_VIDEOS = {
  bench_press: "7603190204740013313", // Chest press machine
  incline_db_press: "7267987124610239762", // Incline chest press machine
  chest_fly: "eozdVDA78K0", // YouTube (no TikTok)
  dips: "2z8JmcrW-As", // YouTube (no TikTok)
  tricep_pushdown: "7586888221125070094", // Zigzag tricep extension
  zigzag_tricep_ext: "7586888221125070094", // Zigzag tricep extension
  overhead_ext: "7527210325834206486", // Overhead tricep extension
  push_up: "IODxDxX7oi4", // YouTube (no TikTok)
  lat_pulldown: "7665886081329532174", // Lat pulldown
  barbell_row: "7532789627212631314", // T-bar row
  seated_row: "7639010632561478934", // Seated row
  single_arm_seated_row: "7639010632561478934", // Single arm seated row
  bicep_curl: "7636460964870720788", // Behind body bicep curl
  behind_body_bicep_curl: "7636460964870720788", // Behind body bicep curl
  hammer_curl: "7623849292461051156", // Hammer curl
  supported_db_curl: "7636460964870720788", // Supported dumbbell curl
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
  pull_up: "eGo4IYlbE5g", // YouTube (no TikTok)
  plank: "pSHjTRCQxIw", // YouTube (no TikTok)
  treadmill: "KyXBjRmE-W8", // YouTube (no TikTok)
  bike: "zSNSNSBN8Og", // YouTube (no TikTok)
  crunches: "7654453038815399171", // Abs rope crunches
  leg_raise: "hdng3ubkBrI", // YouTube (no TikTok)
  jump_rope: "FJmRQ5iTXKE", // YouTube (no TikTok)
  burpees: "dZgVxmf6jkA", // YouTube (no TikTok)
};

// ------------------------------------------------------------
// GOOGLE PLAY BILLING PRODUCT IDs
// Placeholder IDs — replace with your real Play Console IDs.
// Using Google Play Billing ONLY (no RevenueCat).
// ------------------------------------------------------------
export const BILLING_PRODUCTS = {
  training: "training_pro",
  nutrition: "nutrition_pro",
  both: "both_pro",
};

// ------------------------------------------------------------
// PAYWALL OPTIONS
// Duration tiers: month / 3mo / 6mo / year
// ------------------------------------------------------------
export const DURATIONS = [
  { id: "monthly", label: "شهري", labelEn: "Monthly", months: 1 },
  { id: "quarterly", label: "3 شهور", labelEn: "3 Months", months: 3 },
  { id: "halfyearly", label: "6 شهور", labelEn: "6 Months", months: 6 },
  { id: "yearly", label: "سنوي", labelEn: "Yearly", months: 12 },
];

export const PAYWALL_PLANS = {
  training: {
    title: "Training Pro",
    titleAr: "تدريب برو",
    prices: { monthly: 100, quarterly: 270, halfyearly: 750, yearly: 899 },
    featuresAr: [
      "تمارين غير محدودة كل يوم",
      "خطة تمرين مخصصة حسب هدفك ووزنك وطولك",
      "سجل وزن كامل، من غير حذف",
      "مقارنات تقدم يومية وشهرية",
    ],
    featuresEn: [
      "Unlimited exercises per workout day",
      "Personalized workout plan by your goal, weight & height",
      "Full body-weight history, never deleted",
      "Daily & monthly progress comparisons",
    ],
  },
  nutrition: {
    title: "Nutrition Pro",
    titleAr: "تغذية برو",
    prices: { monthly: 100, quarterly: 270, halfyearly: 750, yearly: 899 },
    featuresAr: [
      "خطة غذائية كاملة مبنية على جسمك وهدفك",
      "أهداف يومية دقيقة للسعرات والبروتين والكارب والدهون",
      "بتتحدث مع تغيّر وزنك وهدفك",
    ],
    featuresEn: [
      "A complete diet plan built for your body & goal",
      "Exact daily targets for calories, protein, carbs & fat",
      "Updated as your weight and goal change",
    ],
  },
  both: {
    title: "Training + Nutrition",
    titleAr: "تدريب + تغذية",
    best: true,
    prices: { monthly: 150, quarterly: 399, halfyearly: 750, yearly: 1299 },
    featuresAr: ["كل حاجة في الخطتين فوق", "أفضل قيمة — وفّر أكتر"],
    featuresEn: ["Everything in both plans above", "Best value — save more"],
  },
};
