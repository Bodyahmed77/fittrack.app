// ============================================================
// Fifty Fit App — External Configuration
// ============================================================
// Centralize all external assets (images, videos, product IDs)
// here so they can be updated easily without touching the app logic.
// ============================================================

// ------------------------------------------------------------
// EXERCISE IMAGES
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
// EXERCISE VIDEO IDs
// ------------------------------------------------------------
export const EXERCISE_VIDEOS = {
  bench_press: "7603190204740013313",
  incline_db_press: "7267987124610239762",
  chest_fly: "eozdVDA78K0",
  dips: "2z8JmcrW-As",
  tricep_pushdown: "7586888221125070094",
  zigzag_tricep_ext: "7586888221125070094",
  overhead_ext: "7527210325834206486",
  push_up: "IODxDxX7oi4",
  lat_pulldown: "7665886081329532174",
  barbell_row: "7532789627212631314",
  seated_row: "7639010632561478934",
  single_arm_seated_row: "7639010632561478934",
  bicep_curl: "7636460964870720788",
  behind_body_bicep_curl: "7636460964870720788",
  hammer_curl: "7623849292461051156",
  supported_db_curl: "7636460964870720788",
  squat: "7513352117692665094",
  hack_squat: "7513352117692665094",
  leg_press: "7545454872586423574",
  leg_extension: "7564750740061752598",
  abduction: "7419086233487281415",
  reverse_curl: "7214952400631778566",
  face_pull: "7474058570451946757",
  lunges: "7353289956699229472",
  leg_curl: "7521556521390460166",
  calf_raise: "7602285498962349342",
  ohp: "7663674671677705488",
  lateral_raise: "7486685939025054981",
  rear_delt_fly: "7630410819259387158",
  shrugs: "7500002250526395653",
  deadlift: "7380964646062263558",
  pull_up: "eGo4IYlbE5g",
  plank: "pSHjTRCQxIw",
  treadmill: "KyXBjRmE-W8",
  bike: "zSNSNSBN8Og",
  crunches: "7654453038815399171",
  leg_raise: "hdng3ubkBrI",
  jump_rope: "FJmRQ5iTXKE",
  burpees: "dZgVxmf6jkA",
};

// ------------------------------------------------------------
// GOOGLE PLAY BILLING PRODUCT IDs
// ------------------------------------------------------------
export const BILLING_PRODUCTS = {
  training: "training_pro",
  nutrition: "nutrition_pro",
  both: "both_pro",
};

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

// Standard/free plan: exactly four exercises per workout day.
// This is intentionally kept as a single cap so all workout templates
// remain intact for Pro users and the free plan only limits visible items.
export const FREE_EXERCISE_CAP = 4;
