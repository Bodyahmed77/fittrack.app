// ============================================================
// Fifty Fit — External Configuration
// ============================================================
export const EXERCISE_IMAGES = {
  bench_press: "bench", incline_db_press: "incline", chest_fly: "fly", dips: "dips", tricep_pushdown: "triceps", overhead_ext: "overhead", push_up: "pushup", zigzag_tricep_ext: "triceps", lat_pulldown: "lat", barbell_row: "row", seated_row: "row", single_arm_seated_row: "row", bicep_curl: "curl", behind_body_bicep_curl: "curl", hammer_curl: "curl", supported_db_curl: "curl", squat: "squat", hack_squat: "squat", leg_press: "legpress", leg_extension: "legext", abduction: "abduction", reverse_curl: "curl", face_pull: "facepull", lunges: "lunge", leg_curl: "legcurl", calf_raise: "calf", ohp: "ohp", lateral_raise: "latraise", rear_delt_fly: "fly", shrugs: "shrugs", deadlift: "deadlift", pull_up: "pullup", plank: "plank", treadmill: "cardio", bike: "cardio", crunches: "abs", leg_raise: "abs", jump_rope: "cardio", burpees: "burpees",
};

// TikTok values are intentionally kept as direct URLs. The exercise viewer
// should open these URLs in the normal in-app WebView, not TikTok's official
// player endpoint or an oEmbed/resolver service.
export const EXERCISE_VIDEOS = {
  bench_press: "7603190204740013313", incline_db_press: "7267987124610239762", chest_fly: "eozdVDA78K0", dips: "2z8JmcrW-As", tricep_pushdown: "7586888221125070094", zigzag_tricep_ext: "7586888221125070094", overhead_ext: "7527210325834206486", push_up: "IODxDxX7oi4", lat_pulldown: "7665886081329532174", barbell_row: "7532789627212631314", seated_row: "7639010632561478934", single_arm_seated_row: "7639010632561478934", bicep_curl: "7636460964870720788", behind_body_bicep_curl: "7636460964870720788", hammer_curl: "7623849292461051156", supported_db_curl: "7636460964870720788", squat: "7513352117692665094", hack_squat: "7513352117692665094", leg_press: "7545454872586423574", leg_extension: "7564750740061752598", abduction: "7419086233487281415", reverse_curl: "7214952400631778566", face_pull: "7474058570451946757", lunges: "7353289956699229472", leg_curl: "7521556521390460166", calf_raise: "7602285498962349342", ohp: "7663674671677705488", lateral_raise: "7486685939025054981", rear_delt_fly: "7630410819259387158", shrugs: "7500002250526395653", deadlift: "7380964646062263558", pull_up: "eGo4IYlbE5g", plank: "pSHjTRCQxIw", treadmill: "https://vt.tiktok.com/ZS4T2HfCY/", bike: "https://vt.tiktok.com/ZS4T249MW/", crunches: "7654453038815399171", leg_raise: "hdng3ubkBrI", jump_rope: "https://www.tiktok.com/@tiboinshape/video/7358498825012661537", burpees: "https://vt.tiktok.com/ZS4TjS16a/",
};

export const BILLING_PRODUCTS = { training: "training_pro", nutrition: "nutrition_pro", both: "both_pro", ai: "ai_coach_pro" };
export const FREE_AI_MESSAGES_PER_DAY = 3;
export const PRO_AI_MESSAGES_PER_DAY = 50;
export const AI_COACH_ENDPOINT = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach";
export const AI_REPORT_ENDPOINT = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_AI_REPORT_ENDPOINT) || (AI_COACH_ENDPOINT || "").replace("/functions/v1/ai-coach", "/functions/v1/ai-report");
export const VERIFY_PURCHASE_ENDPOINT = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_VERIFY_PURCHASE_ENDPOINT) || (AI_COACH_ENDPOINT || "").replace("/functions/v1/ai-coach", "/functions/v1/verify-purchase");
export const SUPABASE_ANON_KEY = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";
