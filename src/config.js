// ============================================================
// Fifty Fit — External Configuration
// ============================================================
// Centralize all external assets (images, videos, product IDs)
// here so they can be updated easily without touching the app logic.
// ============================================================

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

// Direct TikTok URLs are kept for the normal in-app WebView.
// Numeric IDs use TikTok's public /video/<id> page URL, not the official player.
export const EXERCISE_VIDEOS = {
  bench_press: "https://www.tiktok.com/video/7603190204740013313",
  incline_db_press: "https://www.tiktok.com/video/7267987124610239762",
  chest_fly: "eozdVDA78K0",
  dips: "2z8JmcrW-As",
  tricep_pushdown: "https://www.tiktok.com/video/7586888221125070094",
  zigzag_tricep_ext: "https://www.tiktok.com/video/7586888221125070094",
  overhead_ext: "https://www.tiktok.com/video/7527210325834206486",
  push_up: "IODxDxX7oi4",
  lat_pulldown: "https://www.tiktok.com/video/7665886081329532174",
  barbell_row: "https://www.tiktok.com/video/7532789627212631314",
  seated_row: "https://www.tiktok.com/video/7639010632561478934",
  single_arm_seated_row: "https://www.tiktok.com/video/7639010632561478934",
  bicep_curl: "https://www.tiktok.com/video/7636460964870720788",
  behind_body_bicep_curl: "https://www.tiktok.com/video/7636460964870720788",
  hammer_curl: "https://www.tiktok.com/video/7623849292461051156",
  supported_db_curl: "https://www.tiktok.com/video/7636460964870720788",
  squat: "https://www.tiktok.com/video/7513352117692665094",
  hack_squat: "https://www.tiktok.com/video/7513352117692665094",
  leg_press: "https://www.tiktok.com/video/7545454872586423574",
  leg_extension: "https://www.tiktok.com/video/7564750740061752598",
  abduction: "https://www.tiktok.com/video/7419086233487281415",
  reverse_curl: "https://www.tiktok.com/video/7214952400631778566",
  face_pull: "https://www.tiktok.com/video/7474058570451946757",
  lunges: "https://www.tiktok.com/video/7353289956699229472",
  leg_curl: "https://www.tiktok.com/video/7521556521390460166",
  calf_raise: "https://www.tiktok.com/video/7602285498962349342",
  ohp: "https://www.tiktok.com/video/7663674671677705488",
  lateral_raise: "https://www.tiktok.com/video/7486685939025054981",
  rear_delt_fly: "https://www.tiktok.com/video/7630410819259387158",
  shrugs: "https://www.tiktok.com/video/7500002250526395653",
  deadlift: "https://www.tiktok.com/video/7380964646062263558",
  pull_up: "eGo4IYlbE5g",
  plank: "pSHjTRCQxIw",
  treadmill: "https://vt.tiktok.com/ZS4T2HfCY/",
  bike: "https://vt.tiktok.com/ZS4T249MW/",
  crunches: "https://www.tiktok.com/video/7654453038815399171",
  leg_raise: "hdng3ubkBrI",
  jump_rope: "https://www.tiktok.com/@tiboinshape/video/7358498825012661537",
  burpees: "https://vt.tiktok.com/ZS4TjS16a/",
};

// Google Play product IDs. Each duration is a separate subscription product
// because the current capacitor-billing bridge does not expose Play offerToken/base-plan selection.
export const BILLING_PRODUCTS = {
  training: {
    monthly: "training_pro_monthly",
    quarterly: "training_pro_quarterly",
    halfyearly: "training_pro_6months",
    yearly: "training_pro_yearly",
  },
  nutrition: {
    monthly: "nutrition_pro_monthly",
    quarterly: "nutrition_pro_quarterly",
    halfyearly: "nutrition_pro_6months",
    yearly: "nutrition_pro_yearly",
  },
  both: {
    monthly: "both_pro_monthly",
    quarterly: "both_pro_quarterly",
    halfyearly: "both_pro_6months",
    yearly: "both_pro_yearly",
  },
  ai: {
    monthly: "ai_coach_pro_monthly",
    quarterly: "ai_coach_pro_quarterly",
    halfyearly: "ai_coach_pro_6months",
    yearly: "ai_coach_pro_yearly",
  },
};

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

export const AI_COACH_PRICES = {
  eg: {
    currency: "EGP",
    currencyLabelAr: "جنيه",
    currencyLabelEn: "EGP",
    monthly: 50,
    quarterly: 129,
    halfyearly: 249,
    yearly: 399,
  },
  intl: {
    currency: "USD",
    currencyLabelAr: "دولار",
    currencyLabelEn: "USD",
    monthly: 4.99,
    quarterly: 12.99,
    halfyearly: 24.99,
    yearly: 39.99,
  },
};

export const DURATIONS = [
  { id: "monthly", label: "شهري", labelEn: "Monthly", months: 1 },
  { id: "quarterly", label: "3 شهور", labelEn: "3 Months", months: 3 },
  { id: "halfyearly", label: "6 شهور", labelEn: "6 Months", months: 6 },
  { id: "yearly", label: "سنوي", labelEn: "Yearly", months: 12 },
];

export const PAYWALL_PRICES = {
  eg: {
    currency: "EGP",
    currencyLabelAr: "جنيه",
    currencyLabelEn: "EGP",
    training: { monthly: 100, quarterly: 270, halfyearly: 750, yearly: 899 },
    nutrition: { monthly: 100, quarterly: 270, halfyearly: 750, yearly: 899 },
    both: { monthly: 150, quarterly: 399, halfyearly: 750, yearly: 1299 },
    ai: { monthly: 50, quarterly: 129, halfyearly: 249, yearly: 399 },
  },
  intl: {
    currency: "USD",
    currencyLabelAr: "دولار",
    currencyLabelEn: "USD",
    training: { monthly: 4.99, quarterly: 12.99, halfyearly: 24.99, yearly: 39.99 },
    nutrition: { monthly: 4.99, quarterly: 12.99, halfyearly: 24.99, yearly: 39.99 },
    both: { monthly: 7.99, quarterly: 19.99, halfyearly: 34.99, yearly: 59.99 },
    ai: { monthly: 4.99, quarterly: 12.99, halfyearly: 24.99, yearly: 39.99 },
  },
};

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
  ai: {
    title: "AI Coach Pro",
    titleAr: "مدرب ذكي برو",
    prices: { monthly: 50, quarterly: 129, halfyearly: 249, yearly: 399 },
    featuresAr: [
      "حتى 50 رسالة يومية للمدرب الذكي (بدلًا من 3)",
      "إجابات مبنية على خطتك ووزنك وتمارين اليوم",
      "إجابات بالعربية والإنجليزية",
    ],
    featuresEn: [
      "Up to 50 AI messages per day (instead of 3)",
      "Answers grounded in your plan, weight & today's exercises",
      "Arabic & English support",
    ],
  },
};
