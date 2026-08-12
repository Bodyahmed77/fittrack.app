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
// EXERCISE VIDEO IDs (TikTok embeds / YouTube embeds)
// Every exercise in the library has a non-empty demo video ID.
// Numeric IDs are TikTok embeds; non-numeric IDs are YouTube IDs.
// Keep existing TikTok mappings when they are exercise-correct.
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
// Placeholder IDs — replace with your real Play Console IDs.
// Using Google Play Billing ONLY (no RevenueCat).
// ------------------------------------------------------------
export const BILLING_PRODUCTS = {
  training: "training_pro",
  nutrition: "nutrition_pro",
  both: "both_pro",
  // Separate AI Coach subscription (ongoing token cost — not bundled with Pro).
  ai: "ai_coach_pro",
};

// ------------------------------------------------------------
// AI COACH LIMITS (single source of truth — do not scatter)
// ------------------------------------------------------------
export const FREE_AI_MESSAGES_PER_DAY = 3;
export const PRO_AI_MESSAGES_PER_DAY = 50;

// Public backend URL only — never put GEMINI_API_KEY here.
// Override at build time with VITE_AI_ENDPOINT if needed.
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

// Server-side entitlement store. The ai-coach function grants quotas
// from this table ONLY, so every real purchase must be registered here.
// Same Supabase project as the AI coach endpoint — one host, two functions.
// Override at build time with VITE_VERIFY_PURCHASE_ENDPOINT if needed.
export const VERIFY_PURCHASE_ENDPOINT =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_VERIFY_PURCHASE_ENDPOINT) ||
  (AI_COACH_ENDPOINT || "").replace(
    "/functions/v1/ai-coach",
    "/functions/v1/verify-purchase",
  );

// Optional public Supabase anon/publishable key (safe in client).
// Required by Supabase gateway on some projects alongside Authorization.
// Set via VITE_SUPABASE_ANON_KEY at build time, or leave empty if the
// Edge Function has verify_jwt disabled and accepts Firebase tokens alone.
export const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  "";

// Display prices only. Google Play regional pricing is the purchase source
// of truth — the app must not invent a country via GPS/IP.
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

// ------------------------------------------------------------
// PAYWALL OPTIONS
// Duration catalog for future Google Play base-plan support; launch enables monthly only.
// ------------------------------------------------------------
export const DURATIONS = [
  { id: "monthly", label: "شهري", labelEn: "Monthly", months: 1 },
  { id: "quarterly", label: "3 شهور", labelEn: "3 Months", months: 3 },
  { id: "halfyearly", label: "6 شهور", labelEn: "6 Months", months: 6 },
  { id: "yearly", label: "سنوي", labelEn: "Yearly", months: 12 },
];

// Display prices by region. Real charged price comes from Google Play
// (Play Console regional pricing). Do NOT detect country via GPS/IP.
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
      "إجابات مبينة على خطتك ووزنك وتمارين اليوم",
      "إجابات بالعربية والإنجليزية",
    ],
    featuresEn: [
      "Up to 50 AI messages per day (instead of 3)",
      "Answers grounded in your plan, weight & today's exercises",
      "Arabic & English support",
    ],
  },
};
