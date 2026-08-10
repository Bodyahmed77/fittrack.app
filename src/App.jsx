import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  useRef,
} from "react";
import {
  Home as HomeIcon,
  Dumbbell,
  TrendingUp,
  Calendar,
  User,
  Bell,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  Settings as SettingsIcon,
  Info,
  LogOut,
  UserCircle,
  Target,
  Ruler,
  HelpCircle,
  Coffee,
  Sun,
  Moon,
  Apple,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sunrise,
  Moon as MoonIcon,
  ArrowRight,
  Crown,
  Trash2,
  Search,
  Camera,
  MessageCircle,
  Sparkles,
  X,
  Shield,
  Phone,
  WifiOff,
  RefreshCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "./recharts";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import logoSrc from "./assets/logo.png";
// Professional, exercise-specific SVG illustrations (offline-safe, bundled by Vite).
import bench_pressImg from "./assets/exercises/bench_press.svg";
import incline_db_pressImg from "./assets/exercises/incline_db_press.svg";
import chest_flyImg from "./assets/exercises/chest_fly.svg";
import dipsImg from "./assets/exercises/dips.svg";
import tricep_pushdownImg from "./assets/exercises/tricep_pushdown.svg";
import overhead_extImg from "./assets/exercises/overhead_ext.svg";
import push_upImg from "./assets/exercises/push_up.svg";
import zigzag_tricep_extImg from "./assets/exercises/zigzag_tricep_ext.svg";
import lat_pulldownImg from "./assets/exercises/lat_pulldown.svg";
import barbell_rowImg from "./assets/exercises/barbell_row.svg";
import seated_rowImg from "./assets/exercises/seated_row.svg";
import single_arm_seated_rowImg from "./assets/exercises/single_arm_seated_row.svg";
import bicep_curlImg from "./assets/exercises/bicep_curl.svg";
import behind_body_bicep_curlImg from "./assets/exercises/behind_body_bicep_curl.svg";
import hammer_curlImg from "./assets/exercises/hammer_curl.svg";
import supported_db_curlImg from "./assets/exercises/supported_db_curl.svg";
import squatImg from "./assets/exercises/squat.svg";
import hack_squatImg from "./assets/exercises/hack_squat.svg";
import leg_pressImg from "./assets/exercises/leg_press.svg";
import leg_extensionImg from "./assets/exercises/leg_extension.svg";
import abductionImg from "./assets/exercises/abduction.svg";
import reverse_curlImg from "./assets/exercises/reverse_curl.svg";
import face_pullImg from "./assets/exercises/face_pull.svg";
import lungesImg from "./assets/exercises/lunges.svg";
import leg_curlImg from "./assets/exercises/leg_curl.svg";
import calf_raiseImg from "./assets/exercises/calf_raise.svg";
import ohpImg from "./assets/exercises/ohp.svg";
import lateral_raiseImg from "./assets/exercises/lateral_raise.svg";
import rear_delt_flyImg from "./assets/exercises/rear_delt_fly.svg";
import shrugsImg from "./assets/exercises/shrugs.svg";
import deadliftImg from "./assets/exercises/deadlift.svg";
import pull_upImg from "./assets/exercises/pull_up.svg";
import plankImg from "./assets/exercises/plank.svg";
import treadmillImg from "./assets/exercises/treadmill.svg";
import bikeImg from "./assets/exercises/bike.svg";
import crunchesImg from "./assets/exercises/crunches.svg";
import leg_raiseImg from "./assets/exercises/leg_raise.svg";
import jump_ropeImg from "./assets/exercises/jump_rope.svg";
import burpeesImg from "./assets/exercises/burpees.svg";

const EXERCISE_IMG_MAP = {
  bench_press: bench_pressImg,
  incline_db_press: incline_db_pressImg,
  chest_fly: chest_flyImg,
  dips: dipsImg,
  tricep_pushdown: tricep_pushdownImg,
  overhead_ext: overhead_extImg,
  push_up: push_upImg,
  zigzag_tricep_ext: zigzag_tricep_extImg,
  lat_pulldown: lat_pulldownImg,
  barbell_row: barbell_rowImg,
  seated_row: seated_rowImg,
  single_arm_seated_row: single_arm_seated_rowImg,
  bicep_curl: bicep_curlImg,
  behind_body_bicep_curl: behind_body_bicep_curlImg,
  hammer_curl: hammer_curlImg,
  supported_db_curl: supported_db_curlImg,
  squat: squatImg,
  hack_squat: hack_squatImg,
  leg_press: leg_pressImg,
  leg_extension: leg_extensionImg,
  abduction: abductionImg,
  reverse_curl: reverse_curlImg,
  face_pull: face_pullImg,
  lunges: lungesImg,
  leg_curl: leg_curlImg,
  calf_raise: calf_raiseImg,
  ohp: ohpImg,
  lateral_raise: lateral_raiseImg,
  rear_delt_fly: rear_delt_flyImg,
  shrugs: shrugsImg,
  deadlift: deadliftImg,
  pull_up: pull_upImg,
  plank: plankImg,
  treadmill: treadmillImg,
  bike: bikeImg,
  crunches: crunchesImg,
  leg_raise: leg_raiseImg,
  jump_rope: jump_ropeImg,
  burpees: burpeesImg,
};
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isOnline as checkOnline, watchNetwork } from "./network";
import {
  EXERCISE_IMAGES,
  EXERCISE_VIDEOS,
  DURATIONS,
  PAYWALL_PLANS,
  FREE_AI_MESSAGES_PER_DAY,
  PRO_AI_MESSAGES_PER_DAY,
  AI_COACH_PRICES,
} from "./config";
import {
  purchase as billingPurchase,
  restorePurchases as billingRestore,
} from "./billing";
import {
  requestReview as requestInAppReview,
  maybeRequestReview,
  recordMeaningfulWorkout,
} from "./review";
import {
  aiUsageToday,
  generateCoachReply,
} from "./aiCoach";
import { APP_INFO, PRIVACY_POLICY_SECTIONS, TERMS_SECTIONS } from "./privacy";

// Fixed notification IDs so we can reliably cancel/replace them later.
const NOTIF_ID_DAILY_REMINDER = 1001;
const NOTIF_ID_SUB_EXPIRY = 1002;

async function scheduleDailyReminder(timeStr) {
  const [hour, minute] = (timeStr || "18:00").split(":").map(Number);
  await LocalNotifications.cancel({
    notifications: [{ id: NOTIF_ID_DAILY_REMINDER }],
  });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIF_ID_DAILY_REMINDER,
        title: "Fifty",
        body: "Don't forget today's workout! 💪",
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      },
    ],
  });
}
async function cancelDailyReminder() {
  await LocalNotifications.cancel({
    notifications: [{ id: NOTIF_ID_DAILY_REMINDER }],
  });
}
async function scheduleSubscriptionExpiryReminder(expiresAtISO) {
  await LocalNotifications.cancel({
    notifications: [{ id: NOTIF_ID_SUB_EXPIRY }],
  });
  if (!expiresAtISO) return;
  const fireDate = new Date(expiresAtISO + "T10:00:00");
  fireDate.setDate(fireDate.getDate() - 5);
  if (fireDate <= new Date()) return; // less than 5 days left already — nothing to schedule
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIF_ID_SUB_EXPIRY,
        title: "Fifty Pro",
        body: "Your Pro subscription ends in 5 days — renew to keep your plan and full history.",
        schedule: { at: fireDate },
      },
    ],
  });
}

function authErrorMessage(err, ar) {
  const code = err?.code || "";
  if (ar) {
    if (code === "auth/user-not-found")
      return "الإيميل ده مش مسجل — دوس إنشاء حساب تحت";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential")
      return "الإيميل أو كلمة السر غلط";
    if (code === "auth/invalid-email") return "اكتب بريد إلكتروني صحيح";
    if (code === "auth/email-already-in-use")
      return "فيه حساب بالإيميل ده بالفعل — جرب تسجل دخول بدل كده";
    if (code === "auth/weak-password")
      return "كلمة السر ضعيفة — استخدم 6 حروف على الأقل";
    if (code === "auth/network-request-failed")
      return "مفيش اتصال بالإنترنت — راجع الشبكة وحاول تاني";
    if (code === "auth/too-many-requests")
      return "محاولات كتير — استنى شوية وحاول تاني";
    return "حصل خطأ — حاول تاني";
  }
  if (code === "auth/user-not-found")
    return "This email isn't registered yet — tap Sign Up below";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Incorrect email or password";
  if (code === "auth/invalid-email") return "Enter a valid email address";
  if (code === "auth/email-already-in-use")
    return "An account already exists with this email — try logging in instead";
  if (code === "auth/weak-password")
    return "Password is too weak — use at least 6 characters";
  if (code === "auth/network-request-failed")
    return "No internet connection — check your network and try again";
  if (code === "auth/too-many-requests")
    return "Too many attempts — please wait a bit and try again";
  return "Something went wrong — please try again";
}

import {
  reauthenticateWithGoogleFlow,
  signInWithGoogleFlow,
  subscribeGoogleAuthSettled,
} from "./googleAuth";
import { googleSignInErrorMessage } from "./googleSignInMessages";

/* ============================== THEME ============================== */
const DARK = {
  mode: "dark",
  bg: "#000000",
  card: "#000000",
  card2: "#161616",
  border: "rgba(255,255,255,0.35)",
  green: "#ffffff",
  greenSoft: "rgba(255,255,255,0.10)",
  onAccent: "#000000",
  text: "#ffffff",
  sub: "#a3a3a3",
  sub2: "#6b6b6b",
  danger: "#ef4444",
  dangerSoft: "rgba(239,68,68,0.12)",
  positive: "#22c55e",
  overlay: "rgba(0,0,0,0.7)",
  gold: "#eab308",
  goldSoft: "rgba(234,179,8,0.14)",
};
const LIGHT = {
  mode: "light",
  bg: "#ffffff",
  card: "#ffffff",
  card2: "#f2f2f2",
  border: "rgba(0,0,0,0.22)",
  green: "#000000",
  greenSoft: "rgba(0,0,0,0.07)",
  onAccent: "#ffffff",
  text: "#000000",
  sub: "#5c5c5c",
  sub2: "#9a9a9a",
  danger: "#dc2626",
  dangerSoft: "rgba(220,38,38,0.10)",
  positive: "#16a34a",
  overlay: "rgba(0,0,0,0.4)",
  gold: "#b45309",
  goldSoft: "rgba(180,83,9,0.12)",
};

const UIContext = createContext(null);
function useUI() {
  return useContext(UIContext);
}

/* ============================== HELPERS ============================== */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_AR = {
  Mon: "إتن",
  Tue: "تلات",
  Wed: "أربع",
  Thu: "خمس",
  Fri: "جمعة",
  Sat: "سبت",
  Sun: "حد",
};
const todayIdx = (() => {
  const js = new Date().getDay();
  return js === 0 ? 6 : js - 1;
})();
const WHATSAPP_NUMBER = "201108178493";

// Local calendar YYYY-MM-DD — never use toISOString() for day keys
// (UTC conversion shifts the date in Egypt/UTC+ timezones and breaks charts).
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalISODate(d);
}
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function shortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function monthKey(iso) {
  return iso.slice(0, 7);
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
const LANG_STORAGE_KEY = "50fit-lang";
// The chosen language lives in localStorage (survives app restarts) and, once
// the user is signed in, in their Firestore profile (survives reinstalls).
function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "ar" || stored === "en" ? stored : null;
  } catch (e) {
    return null;
  }
}
function persistLanguage(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) {}
}
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function passwordIssues(pw, ar) {
  const issues = [];
  if (!pw || pw.length < 8)
    issues.push(ar ? "8 حروف على الأقل" : "8+ characters");
  if (!/[A-Z]/.test(pw || ""))
    issues.push(ar ? "حرف كابيتال" : "one uppercase letter");
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw || ""))
    issues.push(ar ? "رمز خاص" : "one special character");
  return issues;
}
function bmiInfo(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  let cat = "Normal";
  if (bmi < 18.5) cat = "Underweight";
  else if (bmi < 25) cat = "Normal";
  else if (bmi < 30) cat = "Overweight";
  else cat = "Obese";
  return { bmi: bmi.toFixed(1), cat };
}
function mondayOf(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return toLocalISODate(d);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}
function currentTimeLabel() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}
function createWeightEntry(
  weight,
  date = dateKey(0),
  time = currentTimeLabel(),
) {
  return {
    id: `${date}-${time}-${Number(weight)}`,
    weight: Number(weight),
    date,
    time,
  };
}
function compareWeightEntries(a, b) {
  const aDate = a?.date || dateKey(0);
  const bDate = b?.date || dateKey(0);
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  const aTime = a?.time || "00:00";
  const bTime = b?.time || "00:00";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return 0;
}
function normalizeBodyWeightEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && Number.isFinite(Number(entry.weight)))
    .map((entry, index) => ({
      ...entry,
      id:
        entry.id ||
        `${entry.date || dateKey(0)}-${entry.time || "00:00"}-${index}-${Number(
          entry.weight,
        )}`,
      weight: Number(entry.weight),
      date: entry.date || dateKey(0),
      time: entry.time || "00:00",
    }))
    .sort(compareWeightEntries);
}
function daysUntil(iso) {
  if (!iso) return 0;
  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}
function buildPersonalizedProPlan(data) {
  const goal = data.account?.goal || "maintain";
  const preferredDays = Number(
    data.account?.trainingDays ||
      data.account?.preferredDays ||
      data.account?.days ||
      0,
  );
  const workoutPlanId =
    preferredDays >= 6
      ? "six_day"
      : preferredDays === 5
      ? "five_day"
      : preferredDays === 4
      ? "four_day"
      : preferredDays === 3
      ? "three_day"
      : goal === "lose"
      ? "four_day"
      : goal === "muscle"
      ? "five_day"
      : "three_day";
  const nutritionFocus =
    goal === "lose"
      ? "calorie deficit + high protein"
      : goal === "muscle"
      ? "high protein + recovery"
      : "balanced maintenance";
  const workoutFocus =
    goal === "lose"
      ? "fat loss + conditioning"
      : goal === "muscle"
      ? "strength + hypertrophy"
      : "general fitness";
  const weight = Number(
    data.bodyWeight?.slice(-1)[0]?.weight || data.account?.weight || 70,
  );
  const height = Number(data.account?.height || 170);
  const age = Number(data.account?.age || 25);
  return {
    enabled: true,
    generatedAt: dateKey(0),
    workoutPlanId,
    workoutFocus,
    nutritionFocus,
    summary: { weight, height, age, goal },
    coachReady: true,
    source: "subscription",
  };
}

// Mifflin-St Jeor BMR → TDEE based on activity level and goal
const ACTIVITY_FACTORS = {
  none: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};
function calcTDEE({ weight, height, age, gender, activityLevel, goal }) {
  if (!weight || !height || !age) return null;
  const bmr =
    gender === "Female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
  const tdee = Math.round(bmr * (ACTIVITY_FACTORS[activityLevel] || 1.55));
  const target =
    goal === "lose"
      ? Math.round(tdee - 400)
      : goal === "muscle"
      ? Math.round(tdee + 250)
      : tdee;
  const protein = Math.round(weight * 2.0);
  const fat = Math.round((target * 0.25) / 9);
  const carbs = Math.round((target - protein * 4 - fat * 9) / 4);
  return { tdee, target, protein, fat, carbs };
}
function setsCompletedInRange(data, startISO, endISO) {
  let count = 0;
  Object.keys(data.logs).forEach((d) => {
    if (d < startISO || d > endISO) return;
    Object.values(data.logs[d]).forEach((ex) => {
      count += (ex.sets || []).filter((s) => s.done).length;
    });
  });
  return count;
}
// Calendar date of a weekday inside the current (Monday-anchored) week.
function dateForDay(dayName) {
  return addDays(mondayOf(dateKey(0)), DAYS.indexOf(dayName));
}

// Weekday name (Mon..Sun) for an ISO date string YYYY-MM-DD.
function weekdayOf(iso) {
  const js = new Date(iso + "T00:00:00").getDay();
  return DAYS[js === 0 ? 6 : js - 1];
}

// A day counts as trained when every exercise the user can actually open that
// day has been logged on the target calendar date.
function isDayCompleted(data, dayName, targetDate = dateForDay(dayName)) {
  const exercises = getUsableExercises(data, dayName).list;
  if (exercises.length === 0) return false;
  const log = data.logs[targetDate] || {};
  return exercises.every(
    (e) => log[e.id]?.finished || (log[e.id]?.sets || []).some((s) => s.done),
  );
}

// Returns 'done' | 'missed' | 'pending' | 'rest' for a given weekday in the
// current week (or for an explicit targetDate).
// Priority order:
// 1) Rest day → rest (never red)
// 2) Before workoutStartDate → pending (never red)
// 3) Completed → done (green)
// 4) Today → pending/current (never red while in progress)
// 5) Future → pending (never red)
// 6) Past scheduled + incomplete → missed (red)
function dayStatus(data, dayName, targetDate = dateForDay(dayName)) {
  const exercises = getUsableExercises(data, dayName).list;
  if (exercises.length === 0) return "rest";
  if (isDayCompleted(data, dayName, targetDate)) return "done";
  // Days before the user started the program were never theirs to miss.
  if (!data.workoutStartDate || targetDate < data.workoutStartDate)
    return "pending";
  const today = dateKey(0);
  // Current day stays neutral until completed — never red while in progress.
  if (targetDate === today) return "pending";
  // Future days are never marked missed.
  if (targetDate > today) return "pending";
  // Past scheduled workout day that was not completed → missed.
  return "missed";
}

// The day the program is currently on: today when today is a training day and
// not yet completed, otherwise the next scheduled training day (rest days are
// skipped, never treated as missed workouts).
function activeTrainingDay(data) {
  for (let offset = 0; offset < DAYS.length; offset += 1) {
    const day = DAYS[(todayIdx + offset) % DAYS.length];
    if (getUsableExercises(data, day).list.length === 0) continue;
    if (offset === 0 && isDayCompleted(data, day)) continue;
    return day;
  }
  return DAYS[todayIdx];
}

// C.green is the app's monochrome accent (white in dark mode, black in light
// mode), so progress deltas use dedicated semantic colours instead.
// More of a metric is an improvement: strength, completed sets, streaks.
function trendColor(C, delta) {
  if (delta > 0) return C.positive;
  if (delta < 0) return C.danger;
  return C.sub;
}
// Body weight is goal-aware: losing is progress when cutting, gaining is
// progress when building muscle, and any drift is neutral when maintaining.
function weightTrendColor(C, goal, delta) {
  if (!delta) return C.sub;
  const desired = goal === "lose" ? -1 : goal === "muscle" ? 1 : 0;
  if (desired === 0) return C.sub;
  return Math.sign(delta) === desired ? C.positive : C.danger;
}

/* ============================== EXERCISE LIBRARY ============================== */
// Images & videos centralized in src/config.js for easy updates.
const EX_IMG = EXERCISE_IMAGES;

const EX = {
  bench_press: {
    name: "Chest Press Machine",
    nameAr: "جهاز صدر مسطح",
    startWeight: 40,
    vid: EXERCISE_VIDEOS.bench_press,
    demoImage: EX_IMG.bench_press,
  },
  incline_db_press: {
    name: "Incline Press Machine",
    nameAr: "جهاز صدر عالي",
    startWeight: 16,
    vid: EXERCISE_VIDEOS.incline_db_press,
    demoImage: EX_IMG.incline_db_press,
  },
  chest_fly: {
    name: "Chest Fly",
    nameAr: "فراشة الصدر",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.chest_fly,
    demoImage: EX_IMG.chest_fly,
  },
  dips: {
    name: "Dips",
    nameAr: "متوازي",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.dips,
    demoImage: EX_IMG.dips,
  },
  tricep_pushdown: {
    name: "Triceps Pushdown",
    nameAr: "ضغط الترايسيبس",
    startWeight: 18,
    vid: EXERCISE_VIDEOS.tricep_pushdown,
    demoImage: EX_IMG.tricep_pushdown,
  },
  zigzag_tricep_ext: {
    name: "Zigzag Tricep Extension",
    nameAr: "تمديد الترايسيبس زجزاج",
    startWeight: 18,
    vid: EXERCISE_VIDEOS.zigzag_tricep_ext,
    demoImage: EX_IMG.zigzag_tricep_ext,
  },
  overhead_ext: {
    name: "Overhead Tricep Extension",
    nameAr: "تمديد الترايسيبس فوق الرأس",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.overhead_ext,
    demoImage: EX_IMG.overhead_ext,
  },
  push_up: {
    name: "Push Up",
    nameAr: "تمارين الضغط",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.push_up,
    demoImage: EX_IMG.push_up,
  },
  lat_pulldown: {
    name: "Lat Pulldown",
    nameAr: "سحب عالي",
    startWeight: 35,
    vid: EXERCISE_VIDEOS.lat_pulldown,
    demoImage: EX_IMG.lat_pulldown,
  },
  barbell_row: {
    name: "T-Bar Row",
    nameAr: "تجديف T-Bar",
    startWeight: 40,
    vid: EXERCISE_VIDEOS.barbell_row,
    demoImage: EX_IMG.barbell_row,
  },
  seated_row: {
    name: "Seated Row",
    nameAr: "سحب ارضي",
    startWeight: 30,
    vid: EXERCISE_VIDEOS.seated_row,
    demoImage: EX_IMG.seated_row,
  },
  single_arm_seated_row: {
    name: "Single Arm Seated Row",
    nameAr: "سحب ارضي بذراع واحدة",
    startWeight: 20,
    vid: EXERCISE_VIDEOS.single_arm_seated_row,
    demoImage: EX_IMG.single_arm_seated_row,
  },
  bicep_curl: {
    name: "Behind Body Bicep Curl",
    nameAr: "بايسبس خلف الجسم",
    startWeight: 15,
    vid: EXERCISE_VIDEOS.bicep_curl,
    demoImage: EX_IMG.bicep_curl,
  },
  behind_body_bicep_curl: {
    name: "Behind Body Bicep Curl",
    nameAr: "بايسبس خلف الجسم",
    startWeight: 15,
    vid: EXERCISE_VIDEOS.behind_body_bicep_curl,
    demoImage: EX_IMG.behind_body_bicep_curl,
  },
  hammer_curl: {
    name: "Hammer Curl",
    nameAr: "هامر كيرل",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.hammer_curl,
    demoImage: EX_IMG.hammer_curl,
  },
  supported_db_curl: {
    name: "Supported Dumbbell Curl",
    nameAr: "بايسبس دمبل مسنود",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.supported_db_curl,
    demoImage: EX_IMG.supported_db_curl,
  },
  squat: {
    name: "Smith Machine Squat",
    nameAr: "سكوات بجهاز السميث",
    startWeight: 40,
    vid: EXERCISE_VIDEOS.squat,
    demoImage: EX_IMG.squat,
  },
  hack_squat: {
    name: "Hack Squat",
    nameAr: "هاك سكوات",
    startWeight: 40,
    vid: EXERCISE_VIDEOS.hack_squat,
    demoImage: EX_IMG.hack_squat,
  },
  leg_press: {
    name: "Leg Press",
    nameAr: "ضغط الأرجل",
    startWeight: 60,
    vid: EXERCISE_VIDEOS.leg_press,
    demoImage: EX_IMG.leg_press,
  },
  leg_extension: {
    name: "Leg Extension",
    nameAr: "تمديد الأرجل",
    startWeight: 25,
    vid: EXERCISE_VIDEOS.leg_extension,
    demoImage: EX_IMG.leg_extension,
  },
  abduction: {
    name: "Abduction Machine",
    nameAr: "جهاز إبعاد الفخذ",
    startWeight: 20,
    vid: EXERCISE_VIDEOS.abduction,
    demoImage: EX_IMG.abduction,
  },
  reverse_curl: {
    name: "Cable Reverse Curl",
    nameAr: "ريست",
    startWeight: 12,
    vid: EXERCISE_VIDEOS.reverse_curl,
    demoImage: EX_IMG.reverse_curl,
  },
  face_pull: {
    name: "Face Pull",
    nameAr: "كتف خلفي",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.face_pull,
    demoImage: EX_IMG.face_pull,
  },
  lunges: {
    name: "Bulgarian Split Squat",
    nameAr: "سكوات بلغاري",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.lunges,
    demoImage: EX_IMG.lunges,
  },
  leg_curl: {
    name: "Leg Curl",
    nameAr: "خلفيات",
    startWeight: 20,
    vid: EXERCISE_VIDEOS.leg_curl,
    demoImage: EX_IMG.leg_curl,
  },
  calf_raise: {
    name: "Standing Calf Raise",
    nameAr: "رفع السمانة واقف",
    startWeight: 30,
    vid: EXERCISE_VIDEOS.calf_raise,
    demoImage: EX_IMG.calf_raise,
  },
  ohp: {
    name: "Shoulder Press Machine",
    nameAr: "جهاز ضغط الكتف",
    startWeight: 20,
    vid: EXERCISE_VIDEOS.ohp,
    demoImage: EX_IMG.ohp,
  },
  lateral_raise: {
    name: "Lateral Raise",
    nameAr: "الرفرفة الجانبية",
    startWeight: 6,
    vid: EXERCISE_VIDEOS.lateral_raise,
    demoImage: EX_IMG.lateral_raise,
  },
  rear_delt_fly: {
    name: "Rear Delt Fly",
    nameAr: "فراشة الكتف الخلفي",
    startWeight: 6,
    vid: EXERCISE_VIDEOS.rear_delt_fly,
    demoImage: EX_IMG.rear_delt_fly,
  },
  shrugs: {
    name: "Cable or Dumbbell Shrugs",
    nameAr: "هز الكتفين كيبل أو دمبل",
    startWeight: 30,
    vid: EXERCISE_VIDEOS.shrugs,
    demoImage: EX_IMG.shrugs,
  },
  deadlift: {
    name: "Romanian Deadlift",
    nameAr: "ديد ليفت الروماني",
    startWeight: 50,
    vid: EXERCISE_VIDEOS.deadlift,
    demoImage: EX_IMG.deadlift,
  },
  pull_up: {
    name: "Pull Up",
    nameAr: "العقلة",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.pull_up,
    demoImage: EX_IMG.pull_up,
  },
  plank: {
    name: "Plank",
    nameAr: "البلانك",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.plank,
    demoImage: EX_IMG.plank,
  },
  treadmill: {
    name: "Treadmill Walk/Run",
    nameAr: "جري على المشاية",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.treadmill,
    demoImage: EX_IMG.treadmill,
  },
  bike: {
    name: "Stationary Bike",
    nameAr: "دراجة ثابتة",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.bike,
    demoImage: EX_IMG.bike,
  },
  crunches: {
    name: "Abs Rope Crunches",
    nameAr: "بطن بالحبل",
    startWeight: 10,
    vid: EXERCISE_VIDEOS.crunches,
    demoImage: EX_IMG.crunches,
  },
  leg_raise: {
    name: "Hanging Leg Raise",
    nameAr: "سمانه",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.leg_raise,
    demoImage: EX_IMG.leg_raise,
  },
  jump_rope: {
    name: "Jump Rope",
    nameAr: "نط الحبل",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.jump_rope,
    demoImage: EX_IMG.jump_rope,
  },
  burpees: {
    name: "Burpees",
    nameAr: "بيربيس",
    startWeight: 0,
    vid: EXERCISE_VIDEOS.burpees,
    demoImage: EX_IMG.burpees,
  },
};
function mkEx(id, sets, reps) {
  return {
    id,
    name: EX[id].name,
    nameAr: EX[id].nameAr,
    targetSets: sets,
    targetReps: reps,
    startWeight: EX[id].startWeight,
    vid: EX[id].vid,
    demoImage: EX[id].demoImage,
  };
}

/* ============================== PLAN TEMPLATES ============================== */
const PLAN_TEMPLATES = {
  beginner: {
    id: "beginner",
    name: "Standard Plan",
    nameAr: "الخطة الأساسية",
    tagline: "Fixed plan · Free for everyone",
    taglineAr: "خطة ثابتة · مجانية للجميع",
    icon: "🏋️",
    pro: false,
    schedule: {
      Mon: {
        title: "Upper A",
        titleAr: "Upper A",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("lat_pulldown", 2, "6-10"),
        ],
      },
      Tue: {
        title: "Lower A",
        titleAr: "Lower A",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("leg_curl", 2, "8-12"),
          mkEx("leg_extension", 2, "6-10"),
          mkEx("abduction", 2, "6-10"),
        ],
      },
      Wed: {
        title: "Rest",
        titleAr: "Rest",
        exercises: [],
      },
      Thu: {
        title: "Upper B",
        titleAr: "Upper B",
        exercises: [
          mkEx("ohp", 2, "6-10"),
          mkEx("bench_press", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("single_arm_seated_row", 2, "6-10"),
        ],
      },
      Fri: {
        title: "Lower B",
        titleAr: "Lower B",
        exercises: [
          mkEx("rear_delt_fly", 2, "6-10"),
          mkEx("hack_squat", 2, "6-10"),
          mkEx("lunges", 2, "8-12"),
          mkEx("leg_curl", 2, "6-10"),
          mkEx("leg_extension", 2, "6-10"),
        ],
      },
      Sat: {
        title: "Rest",
        titleAr: "Rest",
        exercises: [],
      },
      Sun: {
        title: "Rest",
        titleAr: "Rest",
        exercises: [],
      },
    },
  },
  three_day: {
    id: "three_day",
    name: "3-Day Full Body",
    nameAr: "3 أيام جسم كامل",
    tagline: "3 training days · Pro",
    taglineAr: "3 أيام تدريب · برو",
    icon: "🗓️",
    pro: true,
    schedule: {
      Mon: {
        title: "Day 1",
        titleAr: "اليوم الأول",
        exercises: [
          mkEx("squat", 3, "6-10"),
          mkEx("bench_press", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("lateral_raise", 2, "8-12"),
          mkEx("behind_body_bicep_curl", 2, "6-10"),
          mkEx("overhead_ext", 2, "6-10"),
        ],
      },
      Tue: { title: "Rest", titleAr: "راحة", exercises: [] },
      Wed: {
        title: "Day 2",
        titleAr: "اليوم الثاني",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("rear_delt_fly", 2, "8-12"),
          mkEx("leg_press", 2, "8-12"),
          mkEx("calf_raise", 2, "8-12"),
          mkEx("crunches", 2, "8-12"),
        ],
      },
      Thu: { title: "Rest", titleAr: "راحة", exercises: [] },
      Fri: {
        title: "Day 3",
        titleAr: "اليوم الثالث",
        exercises: [
          mkEx("hack_squat", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("seated_row", 2, "6-10"),
          mkEx("face_pull", 2, "10-15"),
          mkEx("hammer_curl", 2, "6-10"),
          mkEx("tricep_pushdown", 2, "6-10"),
          mkEx("shrugs", 2, "8-12"),
        ],
      },
      Sat: { title: "Rest", titleAr: "راحة", exercises: [] },
      Sun: { title: "Rest", titleAr: "راحة", exercises: [] },
    },
  },
  four_day: {
    id: "four_day",
    name: "4-Day Upper / Lower",
    nameAr: "4 أيام Upper / Lower",
    tagline: "4 training days · Pro",
    taglineAr: "4 أيام تدريب · برو",
    icon: "💪",
    pro: true,
    schedule: {
      Mon: {
        title: "Upper A",
        titleAr: "Upper A",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("lateral_raise", 2, "8-10"),
          mkEx("supported_db_curl", 2, "6-10"),
          mkEx("zigzag_tricep_ext", 2, "6-10"),
          mkEx("shrugs", 2, "6-10"),
          mkEx("reverse_curl", 2, "6-10"),
        ],
      },
      Tue: {
        title: "Lower A",
        titleAr: "Lower A",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("leg_curl", 2, "8-12"),
          mkEx("leg_extension", 2, "6-10"),
          mkEx("abduction", 2, "6-10"),
          mkEx("calf_raise", 3, "8-12"),
          mkEx("crunches", 2, "6-10"),
          mkEx("rear_delt_fly", 2, "6-10"),
        ],
      },
      Wed: { title: "Rest", titleAr: "راحة", exercises: [] },
      Thu: {
        title: "Upper B",
        titleAr: "Upper B",
        exercises: [
          mkEx("ohp", 2, "6-10"),
          mkEx("bench_press", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("single_arm_seated_row", 2, "6-10"),
          mkEx("lateral_raise", 2, "8-12"),
          mkEx("behind_body_bicep_curl", 2, "6-10"),
          mkEx("overhead_ext", 2, "6-10"),
          mkEx("shrugs", 2, "6-10"),
          mkEx("crunches", 2, "6-10"),
        ],
      },
      Fri: {
        title: "Lower B",
        titleAr: "Lower B",
        exercises: [
          mkEx("rear_delt_fly", 2, "6-10"),
          mkEx("hack_squat", 2, "6-10"),
          mkEx("lunges", 2, "8-12"),
          mkEx("leg_curl", 2, "6-10"),
          mkEx("leg_extension", 2, "6-10"),
          mkEx("calf_raise", 3, "8-12"),
        ],
      },
      Sat: { title: "Rest", titleAr: "راحة", exercises: [] },
      Sun: { title: "Rest", titleAr: "راحة", exercises: [] },
    },
  },
  five_day: {
    id: "five_day",
    name: "5-Day Split",
    nameAr: "5 أيام Split",
    tagline: "5 training days · Pro",
    taglineAr: "5 أيام تدريب · برو",
    icon: "🏋️",
    pro: true,
    schedule: {
      Mon: {
        title: "Chest & Back",
        titleAr: "صدر وظهر",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("seated_row", 2, "6-10"),
          mkEx("face_pull", 2, "8-12"),
          mkEx("shrugs", 2, "8-12"),
        ],
      },
      Tue: {
        title: "Shoulders & Arms",
        titleAr: "كتف وترايسبس وبايسبس",
        exercises: [
          mkEx("ohp", 2, "6-10"),
          mkEx("lateral_raise", 3, "8-12"),
          mkEx("rear_delt_fly", 2, "8-12"),
          mkEx("supported_db_curl", 2, "6-10"),
          mkEx("reverse_curl", 2, "8-12"),
          mkEx("overhead_ext", 2, "6-10"),
          mkEx("zigzag_tricep_ext", 2, "6-10"),
          mkEx("crunches", 2, "8-12"),
        ],
      },
      Wed: {
        title: "Legs",
        titleAr: "أرجل",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("leg_press", 2, "8-12"),
          mkEx("leg_curl", 2, "8-12"),
          mkEx("leg_extension", 2, "8-12"),
          mkEx("calf_raise", 3, "8-12"),
        ],
      },
      Thu: { title: "Rest", titleAr: "راحة", exercises: [] },
      Fri: {
        title: "Chest & Back",
        titleAr: "صدر وظهر",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("seated_row", 2, "6-10"),
          mkEx("face_pull", 2, "8-12"),
          mkEx("shrugs", 2, "8-12"),
        ],
      },
      Sat: {
        title: "Shoulders & Arms",
        titleAr: "كتف وترايسبس وبايسبس",
        exercises: [
          mkEx("ohp", 2, "6-10"),
          mkEx("lateral_raise", 3, "8-12"),
          mkEx("rear_delt_fly", 2, "8-12"),
          mkEx("behind_body_bicep_curl", 2, "6-10"),
          mkEx("hammer_curl", 2, "8-12"),
          mkEx("reverse_curl", 2, "8-12"),
          mkEx("overhead_ext", 2, "6-10"),
          mkEx("zigzag_tricep_ext", 2, "8-12"),
          mkEx("crunches", 2, "8-12"),
        ],
      },
      Sun: { title: "Rest", titleAr: "راحة", exercises: [] },
    },
  },
  six_day: {
    id: "six_day",
    name: "6-Day Push / Pull / Legs",
    nameAr: "6 أيام Push / Pull / Legs",
    tagline: "6 training days · Pro",
    taglineAr: "6 أيام تدريب · برو",
    icon: "⚡",
    pro: true,
    schedule: {
      Mon: {
        title: "Push",
        titleAr: "Push",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("ohp", 2, "6-10"),
          mkEx("lateral_raise", 3, "6-10"),
          mkEx("shrugs", 2, "6-12"),
          mkEx("overhead_ext", 2, "6-10"),
        ],
      },
      Tue: {
        title: "Pull",
        titleAr: "Pull",
        exercises: [
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("seated_row", 2, "6-10"),
          mkEx("face_pull", 2, "6-12"),
          mkEx("behind_body_bicep_curl", 2, "6-10"),
          mkEx("hammer_curl", 2, "6-12"),
          mkEx("crunches", 2, "6-10"),
          mkEx("reverse_curl", 2, "8-12"),
        ],
      },
      Wed: {
        title: "Legs",
        titleAr: "أرجل",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("squat", 2, "6-10"),
          mkEx("leg_press", 2, "8-12"),
          mkEx("leg_curl", 2, "8-12"),
          mkEx("leg_extension", 2, "8-12"),
          mkEx("calf_raise", 3, "8-12"),
        ],
      },
      Thu: {
        title: "Push",
        titleAr: "Push",
        exercises: [
          mkEx("bench_press", 2, "6-10"),
          mkEx("incline_db_press", 2, "6-10"),
          mkEx("ohp", 2, "6-10"),
          mkEx("lateral_raise", 3, "6-10"),
          mkEx("shrugs", 2, "6-12"),
          mkEx("overhead_ext", 2, "6-10"),
        ],
      },
      Fri: {
        title: "Pull",
        titleAr: "Pull",
        exercises: [
          mkEx("lat_pulldown", 2, "6-10"),
          mkEx("barbell_row", 2, "6-10"),
          mkEx("seated_row", 2, "6-10"),
          mkEx("face_pull", 2, "6-12"),
          mkEx("behind_body_bicep_curl", 2, "6-10"),
          mkEx("hammer_curl", 2, "6-12"),
          mkEx("crunches", 2, "6-10"),
          mkEx("reverse_curl", 2, "8-12"),
        ],
      },
      Sat: {
        title: "Legs",
        titleAr: "أرجل",
        exercises: [
          mkEx("deadlift", 2, "6-10"),
          mkEx("squat", 2, "6-10"),
          mkEx("leg_press", 2, "8-12"),
          mkEx("leg_curl", 2, "8-12"),
          mkEx("leg_extension", 2, "8-12"),
          mkEx("calf_raise", 3, "8-12"),
        ],
      },
      Sun: { title: "Rest", titleAr: "راحة", exercises: [] },
    },
  },
};

const MEAL_ITEMS = [
  {
    id: "breakfast",
    name: "Breakfast",
    nameAr: "الفطار",
    icon: Coffee,
    kcal: 450,
  },
  { id: "lunch", name: "Lunch", nameAr: "الغدا", icon: Sun, kcal: 650 },
  { id: "dinner", name: "Dinner", nameAr: "العشا", icon: MoonIcon, kcal: 550 },
  { id: "snacks", name: "Snacks", nameAr: "سناكس", icon: Apple, kcal: 250 },
];

const FOOD_DB = [
  // أرقام موثوقة من USDA/MyFitnessPal — كل القيم لكل 100 جرام
  // قسم: الحبوب والنشويات
  {
    id: "rice_white",
    name: "White Rice (cooked)",
    nameAr: "أرز أبيض (مسلوق)",
    kcal: 130,
    protein: 2.7,
    carbs: 28.2,
    fat: 0.3,
  },
  {
    id: "rice_brown",
    name: "Brown Rice (cooked)",
    nameAr: "أرز أسمر (مسلوق)",
    kcal: 112,
    protein: 2.6,
    carbs: 23.5,
    fat: 0.9,
  },
  {
    id: "pasta_cooked",
    name: "Pasta (cooked)",
    nameAr: "مكرونة (مسلوقة)",
    kcal: 131,
    protein: 5.0,
    carbs: 25.1,
    fat: 1.1,
  },
  {
    id: "oats_dry",
    name: "Oats (dry)",
    nameAr: "شوفان (ناشف)",
    kcal: 389,
    protein: 16.9,
    carbs: 66.3,
    fat: 6.9,
  },
  {
    id: "quinoa_cooked",
    name: "Quinoa (cooked)",
    nameAr: "كينوا (مسلوقة)",
    kcal: 120,
    protein: 4.4,
    carbs: 21.3,
    fat: 1.9,
  },
  {
    id: "bread_white",
    name: "White Bread",
    nameAr: "عيش أبيض",
    kcal: 265,
    protein: 9.0,
    carbs: 49.0,
    fat: 3.2,
  },
  {
    id: "bread_baladi",
    name: "Baladi Bread",
    nameAr: "عيش بلدي",
    kcal: 275,
    protein: 9.5,
    carbs: 55.0,
    fat: 1.5,
  },
  {
    id: "bread_whole_wheat",
    name: "Whole Wheat Bread",
    nameAr: "عيش أسمر",
    kcal: 247,
    protein: 13.0,
    carbs: 41.0,
    fat: 3.4,
  },
  {
    id: "sweet_potato",
    name: "Sweet Potato (boiled)",
    nameAr: "بطاطا (مسلوقة)",
    kcal: 76,
    protein: 1.4,
    carbs: 17.7,
    fat: 0.1,
  },
  {
    id: "potato_boiled",
    name: "Potato (boiled)",
    nameAr: "بطاطس (مسلوقة)",
    kcal: 87,
    protein: 1.9,
    carbs: 20.1,
    fat: 0.1,
  },
  {
    id: "french_fries",
    name: "French Fries",
    nameAr: "بطاطس محمرة",
    kcal: 312,
    protein: 3.4,
    carbs: 41.4,
    fat: 14.7,
  },
  // قسم: البروتينات
  {
    id: "chicken_breast",
    name: "Chicken Breast (grilled)",
    nameAr: "صدر فراخ (مشوي)",
    aliases: ["بانية", "صدور فراخ", "فراخ", "chicken", "panne"],
    kcal: 165,
    protein: 31.0,
    carbs: 0.0,
    fat: 3.6,
  },
  {
    id: "chicken_thigh",
    name: "Chicken Thigh (grilled)",
    nameAr: "فخذ فراخ (مشوي)",
    aliases: ["ورك فراخ", "فراخ", "chicken"],
    kcal: 209,
    protein: 25.9,
    carbs: 0.0,
    fat: 10.9,
  },
  {
    id: "beef_lean",
    name: "Lean Beef (grilled)",
    nameAr: "لحم بقري (مشوي)",
    kcal: 215,
    protein: 26.1,
    carbs: 0.0,
    fat: 12.0,
  },
  {
    id: "ground_beef",
    name: "Ground Beef (85% lean)",
    nameAr: "لحم مفروم",
    kcal: 218,
    protein: 23.9,
    carbs: 0.0,
    fat: 13.2,
  },
  {
    id: "kofta",
    name: "Grilled Kofta",
    nameAr: "كفتة مشوية",
    kcal: 246,
    protein: 19.0,
    carbs: 2.0,
    fat: 17.5,
  },
  {
    id: "turkey_breast",
    name: "Turkey Breast",
    nameAr: "صدر ديك رومي",
    kcal: 135,
    protein: 29.9,
    carbs: 0.0,
    fat: 1.0,
  },
  {
    id: "egg",
    name: "Egg (whole)",
    nameAr: "بيضة كاملة",
    kcal: 155,
    protein: 12.6,
    carbs: 1.1,
    fat: 10.6,
  },
  {
    id: "egg_white",
    name: "Egg White",
    nameAr: "بياض البيضة",
    kcal: 52,
    protein: 10.9,
    carbs: 0.7,
    fat: 0.2,
  },
  {
    id: "tuna",
    name: "Tuna (canned in water)",
    nameAr: "تونة (معلبة بالماء)",
    aliases: ["سمك", "fish", "seafood", "مأكولات بحرية"],
    kcal: 116,
    protein: 25.5,
    carbs: 0.0,
    fat: 0.8,
  },
  {
    id: "salmon",
    name: "Salmon (grilled)",
    nameAr: "سالمون (مشوي)",
    aliases: ["سمك", "سلمون", "fish", "seafood", "مأكولات بحرية"],
    kcal: 208,
    protein: 20.4,
    carbs: 0.0,
    fat: 13.4,
  },
  {
    id: "shrimp",
    name: "Shrimp (boiled)",
    nameAr: "جمبري (مسلوق)",
    aliases: ["جمبري", "جمبرى", "prawns", "shrimp", "seafood", "مأكولات بحرية", "سمك"],
    kcal: 99,
    protein: 23.7,
    carbs: 0.2,
    fat: 0.3,
  },
  // قسم: البقوليات
  {
    id: "fava_beans",
    name: "Fava Beans / Ful",
    nameAr: "فول",
    kcal: 110,
    protein: 7.6,
    carbs: 18.0,
    fat: 0.4,
  },
  {
    id: "chickpeas_cooked",
    name: "Chickpeas (cooked)",
    nameAr: "حمص (مطبوخ)",
    kcal: 164,
    protein: 8.9,
    carbs: 27.4,
    fat: 2.6,
  },
  {
    id: "peanuts",
    name: "Peanuts",
    nameAr: "فول سوداني",
    kcal: 567,
    protein: 25.8,
    carbs: 16.1,
    fat: 49.2,
  },
  {
    id: "lentils_cooked",
    name: "Lentils (cooked)",
    nameAr: "عدس (مطبوخ)",
    kcal: 116,
    protein: 9.0,
    carbs: 20.1,
    fat: 0.4,
  },
  {
    id: "falafel",
    name: "Falafel",
    nameAr: "طعمية",
    kcal: 333,
    protein: 13.3,
    carbs: 31.8,
    fat: 17.8,
  },
  {
    id: "hummus",
    name: "Hummus",
    nameAr: "حمص بطحينة",
    kcal: 166,
    protein: 7.9,
    carbs: 14.3,
    fat: 9.6,
  },
  // قسم: الألبان والجبن
  {
    id: "milk",
    name: "Whole Milk",
    nameAr: "لبن كامل الدسم",
    kcal: 61,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.3,
  },
  {
    id: "milk_low_fat",
    name: "Low-Fat Milk (2%)",
    nameAr: "لبن قليل الدسم (٢٪)",
    kcal: 50,
    protein: 3.3,
    carbs: 4.8,
    fat: 2.0,
  },
  {
    id: "milk_skim",
    name: "Skimmed Milk",
    nameAr: "لبن خالي الدسم",
    kcal: 34,
    protein: 3.4,
    carbs: 5.0,
    fat: 0.1,
  },
  {
    id: "yogurt",
    name: "Plain Yogurt",
    nameAr: "زبادي سادة",
    kcal: 61,
    protein: 3.5,
    carbs: 4.7,
    fat: 3.3,
  },
  {
    id: "greek_yogurt",
    name: "Greek Yogurt (0% fat)",
    nameAr: "زبادي يوناني",
    kcal: 59,
    protein: 10.0,
    carbs: 3.6,
    fat: 0.4,
  },
  {
    id: "white_cheese",
    name: "White Cheese",
    nameAr: "جبنة بيضاء",
    kcal: 264,
    protein: 14.1,
    carbs: 3.8,
    fat: 21.4,
  },
  {
    id: "cottage_cheese",
    name: "Cottage Cheese",
    nameAr: "جبنة قريش",
    kcal: 98,
    protein: 11.1,
    carbs: 3.4,
    fat: 4.3,
  },
  // قسم: الزيوت والدهون
  {
    id: "olive_oil",
    name: "Olive Oil",
    nameAr: "زيت زيتون",
    kcal: 884,
    protein: 0.0,
    carbs: 0.0,
    fat: 100.0,
  },
  {
    id: "butter",
    name: "Butter",
    nameAr: "زبدة",
    kcal: 717,
    protein: 0.9,
    carbs: 0.1,
    fat: 81.1,
  },
  {
    id: "peanut_butter",
    name: "Peanut Butter (natural)",
    nameAr: "زبدة فول سوداني",
    kcal: 598,
    protein: 25.1,
    carbs: 13.4,
    fat: 51.4,
  },
  {
    id: "avocado",
    name: "Avocado",
    nameAr: "أفوكادو",
    kcal: 160,
    protein: 2.0,
    carbs: 8.5,
    fat: 14.7,
  },
  // قسم: الخضار
  {
    id: "tomato",
    name: "Tomato",
    nameAr: "طماطم",
    kcal: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
  },
  {
    id: "cucumber",
    name: "Cucumber",
    nameAr: "خيار",
    kcal: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
  },
  {
    id: "spinach",
    name: "Spinach",
    nameAr: "سبانخ",
    kcal: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
  },
  {
    id: "broccoli",
    name: "Broccoli",
    nameAr: "بروكلي",
    kcal: 34,
    protein: 2.8,
    carbs: 7.0,
    fat: 0.4,
  },
  {
    id: "salad_greens",
    name: "Mixed Salad Greens",
    nameAr: "خضار سلطة مشكلة",
    kcal: 15,
    protein: 1.4,
    carbs: 2.9,
    fat: 0.2,
  },
  {
    id: "molokhia",
    name: "Molokhia (cooked)",
    nameAr: "ملوخية (مطبوخة)",
    kcal: 50,
    protein: 4.8,
    carbs: 6.0,
    fat: 1.0,
  },
  // قسم: الفواكه
  {
    id: "banana",
    name: "Banana",
    nameAr: "موز",
    kcal: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
  },
  {
    id: "apple",
    name: "Apple",
    nameAr: "تفاح",
    kcal: 52,
    protein: 0.3,
    carbs: 13.8,
    fat: 0.2,
  },
  {
    id: "orange",
    name: "Orange",
    nameAr: "برتقال",
    kcal: 47,
    protein: 0.9,
    carbs: 11.8,
    fat: 0.1,
  },
  {
    id: "watermelon",
    name: "Watermelon",
    nameAr: "بطيخ",
    kcal: 30,
    protein: 0.6,
    carbs: 7.6,
    fat: 0.2,
  },
  {
    id: "mango",
    name: "Mango",
    nameAr: "مانجا",
    kcal: 60,
    protein: 0.8,
    carbs: 14.8,
    fat: 0.4,
  },
  {
    id: "dates",
    name: "Medjool Dates",
    nameAr: "تمر",
    kcal: 277,
    protein: 1.8,
    carbs: 74.9,
    fat: 0.2,
  },
  {
    id: "prickly_pear",
    name: "Prickly Pear (Cactus Fruit)",
    nameAr: "تين شوكي",
    kcal: 41,
    protein: 0.7,
    carbs: 9.6,
    fat: 0.5,
  },
  {
    id: "grapes",
    name: "Grapes",
    nameAr: "عنب",
    kcal: 69,
    protein: 0.7,
    carbs: 18.1,
    fat: 0.2,
  },
  {
    id: "strawberry",
    name: "Strawberries",
    nameAr: "فراولة",
    kcal: 32,
    protein: 0.7,
    carbs: 7.7,
    fat: 0.3,
  },
  // قسم: متفرقات
  {
    id: "honey",
    name: "Honey",
    nameAr: "عسل",
    kcal: 304,
    protein: 0.3,
    carbs: 82.4,
    fat: 0.0,
  },
  {
    id: "sugar",
    name: "Sugar",
    nameAr: "سكر",
    kcal: 387,
    protein: 0.0,
    carbs: 100.0,
    fat: 0.0,
  },
  {
    id: "chocolate_dark",
    name: "Dark Chocolate (70%+)",
    nameAr: "شوكولاتة داكنة (70%+)",
    kcal: 598,
    protein: 7.8,
    carbs: 45.9,
    fat: 42.6,
  },
  {
    id: "almonds",
    name: "Almonds",
    nameAr: "لوز",
    kcal: 579,
    protein: 21.2,
    carbs: 21.6,
    fat: 49.9,
  },
  {
    id: "tahini",
    name: "Tahini (Sesame Paste)",
    nameAr: "طحينة",
    kcal: 595,
    protein: 17.0,
    carbs: 21.2,
    fat: 53.8,
  },
  // القسم التالي مضاف من USDA FoodData Central (SR Legacy) — لكل 100 جرام
  // قسم: لحوم وأسماك إضافية
  {
    id: "chicken_whole_roasted",
    name: "Roast Chicken (meat only)",
    nameAr: "فراخ مشوية (لحم فقط)",
    aliases: ["فراخ", "chicken"],
    kcal: 190,
    protein: 28.9,
    carbs: 0.0,
    fat: 7.4,
  },
  {
    id: "chicken_drumstick",
    name: "Chicken Drumstick (roasted, meat only)",
    nameAr: "دبوس فراخ (مشوي)",
    aliases: ["فراخ", "chicken"],
    kcal: 172,
    protein: 28.3,
    carbs: 0.0,
    fat: 5.7,
  },
  {
    id: "chicken_liver",
    name: "Chicken Liver (cooked)",
    nameAr: "كبدة فراخ (مطبوخة)",
    kcal: 167,
    protein: 24.5,
    carbs: 0.9,
    fat: 6.5,
  },
  {
    id: "beef_liver",
    name: "Beef Liver (cooked)",
    nameAr: "كبدة بقري (مطبوخة)",
    kcal: 175,
    protein: 26.5,
    carbs: 5.1,
    fat: 4.7,
  },
  {
    id: "lamb_lean",
    name: "Lamb (cooked, lean)",
    nameAr: "لحم ضاني (مطبوخ)",
    kcal: 258,
    protein: 25.6,
    carbs: 0.0,
    fat: 16.5,
  },
  {
    id: "sardines_canned",
    name: "Sardines (canned in oil, drained)",
    nameAr: "سردين (معلب بالزيت)",
    aliases: ["سمك", "fish", "seafood", "مأكولات بحرية"],
    kcal: 208,
    protein: 24.6,
    carbs: 0.0,
    fat: 11.5,
  },
  {
    id: "mackerel",
    name: "Mackerel (cooked)",
    nameAr: "ماكريل (مطبوخ)",
    aliases: ["سمك", "fish", "seafood", "مأكولات بحرية"],
    kcal: 262,
    protein: 23.8,
    carbs: 0.0,
    fat: 17.8,
  },
  {
    id: "tilapia",
    name: "Tilapia (cooked)",
    nameAr: "بلطي (مطبوخ)",
    aliases: ["سمك", "fish", "seafood", "مأكولات بحرية"],
    kcal: 129,
    protein: 26.2,
    carbs: 0.0,
    fat: 2.7,
  },
  {
    id: "cod",
    name: "Cod (cooked)",
    nameAr: "سمك قد (مطبوخ)",
    aliases: ["white fish", "سمك أبيض", "fish", "seafood"],
    kcal: 105,
    protein: 22.8,
    carbs: 0.0,
    fat: 0.9,
  },
  // قسم: ألبان وأجبان إضافية
  {
    id: "mozzarella",
    name: "Mozzarella (part-skim)",
    nameAr: "موتزاريلا (نصف دسم)",
    kcal: 254,
    protein: 24.3,
    carbs: 2.8,
    fat: 15.9,
  },
  {
    id: "cheddar",
    name: "Cheddar Cheese",
    nameAr: "جبنة شيدر",
    kcal: 403,
    protein: 22.9,
    carbs: 3.1,
    fat: 33.1,
  },
  {
    id: "cream_cheese",
    name: "Cream Cheese",
    nameAr: "جبنة كريمي",
    kcal: 350,
    protein: 6.2,
    carbs: 5.5,
    fat: 34.4,
  },
  {
    id: "soy_milk",
    name: "Soy Milk (unsweetened)",
    nameAr: "لبن صويا (بدون سكر)",
    kcal: 33,
    protein: 2.9,
    carbs: 1.8,
    fat: 1.6,
  },
  // قسم: نشويات إضافية
  {
    id: "pasta_whole_wheat",
    name: "Whole Wheat Pasta (cooked)",
    nameAr: "مكرونة أسمر (مسلوقة)",
    kcal: 124,
    protein: 5.3,
    carbs: 26.5,
    fat: 0.5,
  },
  {
    id: "couscous_cooked",
    name: "Couscous (cooked)",
    nameAr: "كسكسي (مطبوخ)",
    kcal: 112,
    protein: 3.8,
    carbs: 23.2,
    fat: 0.2,
  },
  {
    id: "cornflakes",
    name: "Corn Flakes",
    nameAr: "كورن فليكس",
    kcal: 357,
    protein: 7.5,
    carbs: 84.1,
    fat: 0.4,
  },
  {
    id: "corn_cooked",
    name: "Sweet Corn (cooked)",
    nameAr: "ذرة حلوة (مسلوقة)",
    kcal: 96,
    protein: 3.4,
    carbs: 21.0,
    fat: 1.5,
  },
  // قسم: بقوليات إضافية
  {
    id: "kidney_beans_cooked",
    name: "Kidney Beans (cooked)",
    nameAr: "فاصوليا حمراء (مطبوخة)",
    kcal: 127,
    protein: 8.7,
    carbs: 22.8,
    fat: 0.5,
  },
  {
    id: "white_beans_cooked",
    name: "White Beans (cooked)",
    nameAr: "فاصوليا بيضاء (مطبوخة)",
    kcal: 139,
    protein: 9.7,
    carbs: 25.1,
    fat: 0.4,
  },
  {
    id: "black_beans_cooked",
    name: "Black Beans (cooked)",
    nameAr: "فاصوليا سوداء (مطبوخة)",
    kcal: 132,
    protein: 8.9,
    carbs: 23.7,
    fat: 0.5,
  },
  {
    id: "edamame",
    name: "Edamame (cooked)",
    nameAr: "فول صويا أخضر (مسلوق)",
    kcal: 122,
    protein: 11.9,
    carbs: 9.9,
    fat: 5.2,
  },
  {
    id: "green_peas",
    name: "Green Peas (cooked)",
    nameAr: "بسلة (مسلوقة)",
    kcal: 84,
    protein: 5.4,
    carbs: 15.6,
    fat: 0.2,
  },
  // قسم: خضار إضافية
  {
    id: "green_beans",
    name: "Green Beans (cooked)",
    nameAr: "فاصوليا خضراء (مسلوقة)",
    kcal: 35,
    protein: 1.9,
    carbs: 7.9,
    fat: 0.3,
  },
  {
    id: "carrot",
    name: "Carrot (raw)",
    nameAr: "جزر",
    kcal: 41,
    protein: 0.9,
    carbs: 9.6,
    fat: 0.2,
  },
  {
    id: "zucchini",
    name: "Zucchini (raw)",
    nameAr: "كوسة",
    kcal: 17,
    protein: 1.2,
    carbs: 3.1,
    fat: 0.3,
  },
  {
    id: "eggplant_cooked",
    name: "Eggplant (cooked)",
    nameAr: "باذنجان (مطبوخ)",
    kcal: 35,
    protein: 0.8,
    carbs: 8.7,
    fat: 0.2,
  },
  {
    id: "okra_cooked",
    name: "Okra (cooked)",
    nameAr: "بامية (مطبوخة)",
    kcal: 22,
    protein: 1.9,
    carbs: 4.5,
    fat: 0.2,
  },
  {
    id: "cabbage",
    name: "Cabbage (raw)",
    nameAr: "كرنب",
    kcal: 25,
    protein: 1.3,
    carbs: 5.8,
    fat: 0.1,
  },
  {
    id: "cauliflower",
    name: "Cauliflower (raw)",
    nameAr: "قرنبيط",
    kcal: 25,
    protein: 1.9,
    carbs: 5.0,
    fat: 0.3,
  },
  {
    id: "onion",
    name: "Onion (raw)",
    nameAr: "بصل",
    kcal: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
  },
  {
    id: "bell_pepper",
    name: "Green Bell Pepper (raw)",
    nameAr: "فلفل أخضر",
    kcal: 20,
    protein: 0.9,
    carbs: 4.6,
    fat: 0.2,
  },
  {
    id: "mushrooms",
    name: "White Mushrooms (raw)",
    nameAr: "مشروم",
    kcal: 22,
    protein: 3.1,
    carbs: 3.3,
    fat: 0.3,
  },
  // قسم: فواكه إضافية
  {
    id: "kiwi",
    name: "Kiwi",
    nameAr: "كيوي",
    kcal: 61,
    protein: 1.1,
    carbs: 14.7,
    fat: 0.5,
  },
  {
    id: "pineapple",
    name: "Pineapple",
    nameAr: "أناناس",
    kcal: 50,
    protein: 0.5,
    carbs: 13.1,
    fat: 0.1,
  },
  {
    id: "pomegranate",
    name: "Pomegranate",
    nameAr: "رمان",
    kcal: 83,
    protein: 1.7,
    carbs: 18.7,
    fat: 1.2,
  },
  {
    id: "guava",
    name: "Guava",
    nameAr: "جوافة",
    aliases: ["جوافة", "جوافه", "guava"],
    kcal: 68,
    protein: 2.6,
    carbs: 14.3,
    fat: 1.0,
  },
  {
    id: "peach",
    name: "Peach",
    nameAr: "خوخ",
    kcal: 39,
    protein: 0.9,
    carbs: 9.5,
    fat: 0.3,
  },
  {
    id: "pear",
    name: "Pear",
    nameAr: "كمثرى",
    kcal: 57,
    protein: 0.4,
    carbs: 15.2,
    fat: 0.1,
  },
  {
    id: "blueberries",
    name: "Blueberries",
    nameAr: "توت أزرق",
    kcal: 57,
    protein: 0.7,
    carbs: 14.5,
    fat: 0.3,
  },
  {
    id: "figs",
    name: "Figs (fresh)",
    nameAr: "تين طازج",
    kcal: 74,
    protein: 0.8,
    carbs: 19.2,
    fat: 0.3,
  },
  {
    id: "raisins",
    name: "Raisins",
    nameAr: "زبيب",
    kcal: 299,
    protein: 3.1,
    carbs: 79.2,
    fat: 0.5,
  },
  {
    id: "dried_apricots",
    name: "Dried Apricots",
    nameAr: "مشمش مجفف",
    kcal: 241,
    protein: 3.4,
    carbs: 62.6,
    fat: 0.5,
  },
  {
    id: "orange_juice",
    name: "Orange Juice (100%)",
    nameAr: "عصير برتقال طبيعي",
    kcal: 45,
    protein: 0.7,
    carbs: 10.4,
    fat: 0.2,
  },
  // قسم: مكسرات وبذور ودهون إضافية
  {
    id: "walnuts",
    name: "Walnuts",
    nameAr: "عين جمل",
    kcal: 654,
    protein: 15.2,
    carbs: 13.7,
    fat: 65.2,
  },
  {
    id: "cashews",
    name: "Cashews",
    nameAr: "كاجو",
    kcal: 553,
    protein: 18.2,
    carbs: 30.2,
    fat: 43.9,
  },
  {
    id: "pistachios",
    name: "Pistachios",
    nameAr: "فستق",
    kcal: 560,
    protein: 20.2,
    carbs: 27.2,
    fat: 45.3,
  },
  {
    id: "sunflower_seeds",
    name: "Sunflower Seeds",
    nameAr: "لب عباد الشمس",
    kcal: 584,
    protein: 20.8,
    carbs: 20.0,
    fat: 51.5,
  },
  {
    id: "chia_seeds",
    name: "Chia Seeds",
    nameAr: "بذور الشيا",
    kcal: 486,
    protein: 16.5,
    carbs: 42.1,
    fat: 30.7,
  },
  {
    id: "flaxseed",
    name: "Flaxseed",
    nameAr: "بذر الكتان",
    kcal: 534,
    protein: 18.3,
    carbs: 28.9,
    fat: 42.2,
  },
  {
    id: "coconut_oil",
    name: "Coconut Oil",
    nameAr: "زيت جوز الهند",
    kcal: 862,
    protein: 0.0,
    carbs: 0.0,
    fat: 100.0,
  },
  {
    id: "ghee",
    name: "Ghee (clarified butter)",
    nameAr: "سمنة",
    kcal: 876,
    protein: 0.3,
    carbs: 0.0,
    fat: 99.5,
  },
  // قسم: أكلات مصرية شائعة — القيم لكل 100 جرام (USDA FoodData Central)
  {
    id: "chicken_breast_raw",
    name: "Chicken Breast (raw, skinless)",
    nameAr: "صدر فراخ (ني)",
    aliases: ["بانية", "صدور فراخ", "فراخ", "chicken"],
    kcal: 120,
    protein: 22.5,
    carbs: 0.0,
    fat: 2.6,
  },
  {
    id: "chicken_panne",
    name: "Breaded Fried Chicken Breast (Panne)",
    nameAr: "بانية مقلية (صدر فراخ مغطى بالبقسماط)",
    aliases: ["بانية", "بانيه", "panne", "breaded chicken", "فراخ بانية"],
    kcal: 260,
    protein: 22.0,
    carbs: 9.0,
    fat: 13.7,
  },
  {
    id: "chicken_wings",
    name: "Chicken Wings (roasted, with skin)",
    nameAr: "أجنحة فراخ (مشوية بالجلد)",
    aliases: ["وينجز", "فراخ", "chicken", "wings"],
    kcal: 254,
    protein: 30.4,
    carbs: 0.0,
    fat: 16.8,
  },
  {
    id: "beef_steak",
    name: "Beef Sirloin Steak (grilled, lean)",
    nameAr: "ستيك بقري (مشوي)",
    aliases: ["ستيك", "steak", "لحمة مشوية"],
    kcal: 212,
    protein: 30.0,
    carbs: 0.0,
    fat: 9.4,
  },
  {
    id: "calamari_fried",
    name: "Calamari / Squid (fried)",
    nameAr: "كاليماري (مقلي)",
    aliases: ["كاليماري", "حبار", "سبيط", "seafood", "مأكولات بحرية", "سمك"],
    kcal: 175,
    protein: 17.9,
    carbs: 7.8,
    fat: 7.5,
  },
  {
    id: "egg_fried",
    name: "Egg (fried in oil)",
    nameAr: "بيض مقلي",
    aliases: ["بيض", "egg"],
    kcal: 196,
    protein: 13.6,
    carbs: 0.8,
    fat: 14.8,
  },
  {
    id: "bulgur_cooked",
    name: "Bulgur (cooked)",
    nameAr: "برغل (مطبوخ)",
    aliases: ["برغل", "bulgur"],
    kcal: 83,
    protein: 3.1,
    carbs: 18.6,
    fat: 0.2,
  },
  {
    id: "toast_white",
    name: "Toast Bread (white)",
    nameAr: "توست أبيض",
    aliases: ["توست", "خبز توست", "toast"],
    kcal: 293,
    protein: 9.0,
    carbs: 54.7,
    fat: 4.0,
  },
  {
    id: "romaine_lettuce",
    name: "Romaine Lettuce",
    nameAr: "خس",
    aliases: ["خص", "lettuce", "سلطة خضراء"],
    kcal: 17,
    protein: 1.2,
    carbs: 3.3,
    fat: 0.3,
  },
  {
    id: "arugula",
    name: "Arugula (rocket)",
    nameAr: "جرجير",
    aliases: ["rocket", "جرجير بلدي"],
    kcal: 25,
    protein: 2.6,
    carbs: 3.7,
    fat: 0.7,
  },
  {
    id: "romano_cheese",
    name: "Romano Cheese (Roumy)",
    nameAr: "جبنة رومي",
    aliases: ["رومي", "جبنه رومي", "roumy"],
    kcal: 387,
    protein: 31.8,
    carbs: 3.6,
    fat: 26.9,
  },
  {
    id: "cantaloupe",
    name: "Cantaloupe",
    nameAr: "كنتالوب",
    aliases: ["شمام", "melon"],
    kcal: 34,
    protein: 0.8,
    carbs: 8.2,
    fat: 0.2,
  },
  {
    id: "molasses",
    name: "Molasses (black honey)",
    nameAr: "عسل أسود",
    aliases: ["عسل اسود", "molasses"],
    kcal: 290,
    protein: 0.0,
    carbs: 74.7,
    fat: 0.1,
  },
];

// Arabic is typed inconsistently (hamza forms, ة/ه, ى/ي, diacritics), so both
// the query and the food names are folded to one form before matching.
function normalizeSearch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\s+/g, " ")
    .trim();
}
function foodMatches(food, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  return [food.name, food.nameAr, ...(food.aliases || [])].some(
    (n) => n && normalizeSearch(n).includes(q),
  );
}

const GOALS = [
  {
    id: "lose",
    label: "Lose Weight",
    labelAr: "خسارة الوزن",
    desc: "Burn fat, stay lean",
    descAr: "احرق الدهون وابقَ رشيق",
    icon: "🔥",
    planId: "fatloss",
  },
  {
    id: "muscle",
    label: "Build Muscle",
    labelAr: "بناء العضلات",
    desc: "Gain size & strength",
    descAr: "زيادة الحجم والقوة",
    icon: "💪",
    planId: "hypertrophy",
  },
  {
    id: "maintain",
    label: "Stay Fit",
    labelAr: "الحفاظ على اللياقة",
    desc: "General fitness habit",
    descAr: "عادة رياضية عامة",
    icon: "🏋️",
    planId: "beginner",
  },
];

const FREE_EXERCISE_CAP = 4;

/* ============================== DEFAULT STATE ============================== */
function freshState() {
  return {
    onboarded: false,
    workoutStartDate: null,
    account: {
      name: "",
      email: "",
      phone: "",
      gender: "",
      age: "",
      height: "",
      weight: "",
      goal: "",
      daysPerWeek: 4,
      activityLevel: "moderate",
      photo: "",
    },
    settings: {
      theme: "dark",
      notifications: true,
      reminderTime: "18:00",
      language: null,
    },
    profile: { level: 1, xp: 0, xpMax: 500 },
    entitlements: {
      nutritionPro: false,
      trainingPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
    },
    nutritionPlan: null,
    proPlan: null,
    dailyTargets: null,
    activePlanId: "beginner",
    customPlan: {},
    bodyWeight: [],
    logs: {},
    meals: {},
  };
}

/* ============================== AUTH + FIRESTORE STORAGE ============================== */
// Real accounts (Firebase Auth) + real database (Firestore). Each signed-in
// user's app data lives in the document users/{uid}. onSnapshot keeps it
// live-synced across devices; setData writes straight back to Firestore.
function useFirebaseSession() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = not checked yet, null = signed out
  useEffect(
    () => onAuthStateChanged(auth, (u) => setFirebaseUser(u || null)),
    [],
  );
  return firebaseUser;
}

function useAppData(uid) {
  const [data, setDataRaw] = useState(freshState());
  const [loaded, setLoaded] = useState(false);
  const verifiedEntitlementsRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      setLoaded(false);
      verifiedEntitlementsRef.current = null;
      return;
    }
    setLoaded(false);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const fresh = freshState();
        const parsed = snap.exists() ? snap.data() : {};
        const merged = {
          ...fresh,
          ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: {
            ...fresh.entitlements,
            ...(verifiedEntitlementsRef.current || {}),
          },
          customPlan: parsed.customPlan || {},
        };
        setDataRaw(merged);
        setLoaded(true);
      },
      (err) => {
        console.error("Firestore read failed", err);
        setLoaded(true);
      },
    );
    return unsub;
  }, [uid]);

  const setVerifiedEntitlements = useCallback((entitlements) => {
    verifiedEntitlementsRef.current = {
      nutritionPro: !!entitlements?.nutritionPro,
      trainingPro: !!entitlements?.trainingPro,
      aiCoachPro: !!entitlements?.aiCoachPro,
      proExpiresAt: entitlements?.proExpiresAt || null,
    };
    setDataRaw((current) => ({
      ...current,
      entitlements: verifiedEntitlementsRef.current,
    }));
  }, []);

  const setData = useCallback(
    async (next) => {
      verifiedEntitlementsRef.current = next.entitlements;
      setDataRaw(next);
      if (!uid) return;
      try {
        const persisted = Object.fromEntries(
          Object.entries(next).filter(([key]) => key !== "entitlements"),
        );
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      } catch (e) {
        console.error("save failed", e);
      }
    },
    [uid],
  );

  return { data, setData, setVerifiedEntitlements, loaded };
}

/* ============================== EXERCISE MERGE HELPERS ============================== */
function getMergedExercises(data, day) {
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const base = activePlan.schedule[day].exercises;
  const custom = data.customPlan[day] || { added: [], removedIds: [] };
  const removed = new Set(custom.removedIds || []);
  return [...base.filter((e) => !removed.has(e.id)), ...(custom.added || [])];
}
function getUsableExercises(data, day) {
  // Free plan caps the *default* plan exercises only. Custom exercises the
  // user adds themselves stay available without a Pro paywall.
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const base = activePlan.schedule[day]?.exercises || [];
  const custom = data.customPlan[day] || { added: [], removedIds: [] };
  const removed = new Set(custom.removedIds || []);
  const baseVisible = base.filter((e) => !removed.has(e.id));
  const customAdded = custom.added || [];
  const pro = data.entitlements.trainingPro;
  const freeBase = pro ? baseVisible : baseVisible.slice(0, FREE_EXERCISE_CAP);
  const lockedCount = pro
    ? 0
    : Math.max(0, baseVisible.length - FREE_EXERCISE_CAP);
  return {
    list: [...freeBase, ...customAdded],
    lockedCount,
  };
}

/* ============================== SHARED UI ============================== */
function chamfer(cut) {
  return `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, ${cut}px 100%, 0 calc(100% - ${cut}px))`;
}
function IconBtn({ children, onClick, style }) {
  const { C } = useUI();
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        background: C.card2,
        border: `1px solid ${C.border}`,
        clipPath: chamfer(7),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function TopBar({ title, onBack, right }) {
  const { C } = useUI();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 18px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <IconBtn onClick={onBack}>
            <ChevronLeft size={20} color={C.text} />
          </IconBtn>
        )}
        <span
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: C.text,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {title}
        </span>
      </div>
      <div>{right}</div>
    </div>
  );
}
function Card({ children, style, onClick }) {
  const { C } = useUI();
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        clipPath: chamfer(14),
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function GreenButton({
  children,
  onClick,
  disabled,
  style,
  variant = "solid",
}) {
  const { C } = useUI();
  const solid = variant === "solid";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "14px 0",
        border: solid ? "none" : `1.5px solid ${C.green}`,
        clipPath: chamfer(10),
        background: solid ? (disabled ? C.card2 : C.green) : "transparent",
        color: solid ? (disabled ? C.sub2 : C.onAccent) : C.green,
        fontSize: 14,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function Pill({ active, children, onClick }) {
  const { C } = useUI();
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 0",
        flex: 1,
        clipPath: chamfer(8),
        border: "none",
        cursor: "pointer",
        background: active ? C.green : "transparent",
        color: active ? C.onAccent : C.sub,
        fontWeight: 800,
        fontSize: 12.5,
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}
function TextField({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  rightEl,
  error,
}) {
  const { C } = useUI();
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: C.card2,
          border: `1px solid ${error ? C.danger : C.border}`,
          borderRadius: 13,
          padding: "13px 14px",
        }}
      >
        {Icon && <Icon size={17} color={C.sub} />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.text,
            fontSize: 14.5,
            minWidth: 0,
          }}
        />
        {rightEl}
      </div>
      {error && (
        <div
          style={{
            color: C.danger,
            fontSize: 11.5,
            marginTop: 5,
            marginLeft: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
function ToggleSwitch({ on, onClick }) {
  const { C } = useUI();
  return (
    <button
      onClick={onClick}
      style={{
        width: 46,
        height: 26,
        borderRadius: 20,
        border: on ? "none" : `1px solid ${C.border}`,
        cursor: "pointer",
        background: on ? C.green : "transparent",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: on ? C.onAccent : C.sub2,
          position: "absolute",
          top: 2,
          left: on ? 23 : 3,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}
function ProgressRing({ pct, size = 46, stroke = 5 }) {
  const { C } = useUI();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={C.border}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={C.green}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}
function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
}) {
  const { C } = useUI();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: 20,
          width: "100%",
          maxWidth: 340,
        }}
      >
        <div
          style={{
            color: C.text,
            fontWeight: 800,
            fontSize: 16,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: C.sub,
            fontSize: 13.5,
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.text,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: danger ? C.danger : C.green,
              color: danger ? "#fff" : C.onAccent,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
function Toast({ message }) {
  const { C } = useUI();
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(90px + env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        background: C.mode === "dark" ? "#22272e" : "#1f2937",
        color: "#fff",
        padding: "11px 20px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "85%",
        textAlign: "center",
      }}
    >
      <Check size={15} color={C.green} style={{ flexShrink: 0 }} /> {message}
    </div>
  );
}
// In-app exercise video player.
// Supports both TikTok Shorts (numeric video ID → TikTok embed) and
// YouTube Shorts (alphanumeric ID → no-cookie YouTube embed). Runs
// reliably inside a Capacitor WebView without triggering sign-in prompts.
function VideoPlayer({ videoId, ar }) {
  const { C } = useUI();
  const [show, setShow] = useState(false);
  const frameWrapRef = useRef(null);
  const isTikTok = !!videoId && /^\d+$/.test(videoId);

  // Block vertical pans inside TikTok embed (nested scroll) without killing taps/play.
  // Must use non-passive listener — React's synthetic onTouchMove is passive on many browsers.
  useEffect(() => {
    if (!show || !isTikTok) return undefined;
    const el = frameWrapRef.current;
    if (!el) return undefined;
    const blockPan = (e) => {
      if (e.touches && e.touches.length === 1) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", blockPan, { passive: false });
    return () => el.removeEventListener("touchmove", blockPan);
  }, [show, isTikTok]);

  if (!videoId) return null;
  const embedSrc = isTikTok
    ? `https://www.tiktok.com/embed/v2/${videoId}`
    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div
      style={{
        marginBottom: 14,
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {!show ? (
        <button
          onClick={() => setShow(true)}
          style={{
            width: "100%",
            maxWidth: 360,
            aspectRatio: "9/16",
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {!isTikTok && (
            <img
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt="video thumbnail"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.6,
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "11px solid transparent",
                borderBottom: "11px solid transparent",
                borderLeft: "18px solid #000",
                marginLeft: 4,
              }}
            />
          </div>
          <span
            style={{
              position: "relative",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {ar ? "شوف الشورت" : "Watch Short Demo"}
          </span>
        </button>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 360,
            aspectRatio: "9/16",
            borderRadius: 14,
            overflow: "hidden",
            background: "#000",
            border: `1px solid ${C.border}`,
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            isolation: "isolate",
            // Clip TikTok chrome (description / related) and block nested scroll.
            overscrollBehavior: "none",
            touchAction: "manipulation",
          }}
          ref={frameWrapRef}
        >
          {/* The iframe sandbox keeps the embed playable and interactive while
              denying top-level navigation, popups and deep links, so tapping
              the clip can no longer leave Fifty Fit for the TikTok app. */}
          <iframe
            src={embedSrc}
            title={ar ? "فيديو التمرين" : "Exercise video"}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="no-referrer"
            scrolling="no"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
              overflow: "hidden",
              overscrollBehavior: "none",
              // Prefer taps/play over free panning inside the embed.
              touchAction: "manipulation",
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button
            onClick={() => setShow(false)}
            aria-label={ar ? "إغلاق الفيديو" : "Close video"}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.7)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================== EXERCISE VISUAL ============================== */
// Self-contained, flat vector illustrations used for every exercise.
// Each variant is a hand-crafted SVG silhouette so the whole app keeps a
// single consistent 2D cartoon/vector style — no external images, works
// fully offline, and clearly represents the specific movement.
const EXERCISE_SVG = {
  bench: (
    <>
      <rect x="4" y="58" width="92" height="8" rx="4" fill="#94a3b8" />
      <rect x="4" y="84" width="92" height="8" rx="4" fill="#94a3b8" />
      <rect x="18" y="56" width="6" height="36" rx="3" fill="#64748b" />
      <rect x="76" y="56" width="6" height="36" rx="3" fill="#64748b" />
      <rect x="30" y="30" width="40" height="10" rx="5" fill="#1e3a2f" />
      <circle cx="34" cy="26" r="7" fill="#ffd6a8" />
      <circle cx="66" cy="26" r="7" fill="#ffd6a8" />
      <rect x="20" y="48" width="64" height="6" rx="3" fill="#1e3a2f" />
    </>
  ),
  incline: (
    <>
      <rect x="6" y="66" width="88" height="8" rx="4" fill="#94a3b8" />
      <rect x="16" y="62" width="7" height="36" rx="3" fill="#64748b" />
      <rect x="78" y="62" width="7" height="36" rx="3" fill="#64748b" />
      <rect
        x="28"
        y="34"
        width="44"
        height="10"
        rx="5"
        transform="rotate(-18 50 39)"
        fill="#1e3a2f"
      />
      <circle cx="33" cy="28" r="7" fill="#ffd6a8" />
      <circle cx="68" cy="30" r="7" fill="#ffd6a8" />
    </>
  ),
  fly: (
    <>
      <circle cx="50" cy="46" r="9" fill="#ffd6a8" />
      <rect x="46" y="54" width="8" height="24" rx="3" fill="#1e3a2f" />
      <path
        d="M50 60 L20 36 M50 60 L80 36"
        stroke="#1e3a2f"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="18" cy="33" r="9" fill="#94a3b8" />
      <circle cx="82" cy="33" r="9" fill="#94a3b8" />
    </>
  ),
  dips: (
    <>
      <rect x="14" y="22" width="8" height="62" rx="4" fill="#64748b" />
      <rect x="78" y="22" width="8" height="62" rx="4" fill="#64748b" />
      <rect x="10" y="16" width="80" height="8" rx="4" fill="#94a3b8" />
      <circle cx="42" cy="60" r="9" fill="#ffd6a8" />
      <circle cx="58" cy="60" r="9" fill="#ffd6a8" />
      <rect x="36" y="68" width="28" height="5" rx="2.5" fill="#1e3a2f" />
    </>
  ),
  triceps: (
    <>
      <circle cx="50" cy="30" r="9" fill="#ffd6a8" />
      <path
        d="M50 38 L44 62 L38 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 38 L56 62 L62 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="30" y="86" width="40" height="8" rx="4" fill="#94a3b8" />
    </>
  ),
  overhead: (
    <>
      <circle cx="50" cy="26" r="9" fill="#ffd6a8" />
      <path
        d="M50 34 L44 60 L50 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 34 L56 60 L50 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="52" y="84" width="7" height="7" rx="2" fill="#eab308" />
    </>
  ),
  pushup: (
    <>
      <circle cx="50" cy="30" r="9" fill="#ffd6a8" />
      <path
        d="M50 38 L50 58 M50 46 L34 58 M50 46 L66 58"
        stroke="#1e3a2f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 58 L50 84 M34 58 L30 84 M66 58 L70 84"
        stroke="#1e3a2f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="28" y="82" width="44" height="8" rx="4" fill="#94a3b8" />
    </>
  ),
  lat: (
    <>
      <rect x="30" y="14" width="8" height="70" rx="4" fill="#64748b" />
      <rect x="62" y="14" width="8" height="70" rx="4" fill="#64748b" />
      <rect x="24" y="8" width="52" height="8" rx="4" fill="#94a3b8" />
      <rect x="44" y="16" width="12" height="30" rx="4" fill="#1e3a2f" />
      <circle cx="50" cy="52" r="9" fill="#ffd6a8" />
      <path
        d="M50 60 L50 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="34" y="82" width="32" height="7" rx="3.5" fill="#1e3a2f" />
    </>
  ),
  row: (
    <>
      <circle cx="50" cy="34" r="9" fill="#ffd6a8" />
      <path
        d="M50 42 L44 70 L60 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 42 L56 70 L40 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="70" width="60" height="8" rx="4" fill="#94a3b8" />
      <rect x="14" y="66" width="8" height="16" rx="3" fill="#64748b" />
    </>
  ),
  curl: (
    <>
      <circle cx="50" cy="26" r="9" fill="#ffd6a8" />
      <path
        d="M44 34 L40 60 L30 74"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M56 34 L60 60 L70 74"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="56" y="72" width="20" height="8" rx="4" fill="#eab308" />
      <rect x="24" y="72" width="20" height="8" rx="4" fill="#eab308" />
    </>
  ),
  squat: (
    <>
      <circle cx="50" cy="28" r="9" fill="#ffd6a8" />
      <path
        d="M50 36 L50 52 M50 52 L34 84 M50 52 L66 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M34 84 L28 92 M66 84 L72 92"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="90" width="60" height="6" rx="3" fill="#94a3b8" />
      <rect x="44" y="40" width="12" height="14" rx="4" fill="#1e3a2f" />
    </>
  ),
  legpress: (
    <>
      <rect x="8" y="20" width="10" height="64" rx="4" fill="#64748b" />
      <rect x="82" y="20" width="10" height="64" rx="4" fill="#64748b" />
      <rect x="8" y="14" width="84" height="10" rx="5" fill="#94a3b8" />
      <circle cx="36" cy="58" r="8" fill="#ffd6a8" />
      <circle cx="64" cy="58" r="8" fill="#ffd6a8" />
      <rect x="46" y="64" width="8" height="24" rx="3" fill="#1e3a2f" />
    </>
  ),
  legext: (
    <>
      <circle cx="50" cy="30" r="9" fill="#ffd6a8" />
      <path
        d="M50 38 L50 60 M50 60 L34 86 M50 60 L66 86"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="28" y="84" width="44" height="8" rx="4" fill="#94a3b8" />
    </>
  ),
  abduction: (
    <>
      <circle cx="34" cy="36" r="8" fill="#ffd6a8" />
      <circle cx="66" cy="36" r="8" fill="#ffd6a8" />
      <path
        d="M34 44 L34 70 M66 44 L66 70"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M34 70 L20 88 M66 70 L80 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="16" y="86" width="68" height="6" rx="3" fill="#94a3b8" />
    </>
  ),
  facepull: (
    <>
      <circle cx="50" cy="32" r="9" fill="#ffd6a8" />
      <path
        d="M50 40 L44 66 L34 84 M50 40 L56 66 L66 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="26" y="82" width="48" height="8" rx="4" fill="#94a3b8" />
    </>
  ),
  lunge: (
    <>
      <circle cx="50" cy="30" r="9" fill="#ffd6a8" />
      <path
        d="M50 38 L50 58 M50 58 L62 84 M50 58 L34 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M62 84 L70 92 M34 84 L26 92"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="22" y="90" width="56" height="6" rx="3" fill="#94a3b8" />
    </>
  ),
  legcurl: (
    <>
      <rect x="6" y="68" width="88" height="8" rx="4" fill="#94a3b8" />
      <rect x="16" y="64" width="6" height="36" rx="3" fill="#64748b" />
      <rect x="78" y="64" width="6" height="36" rx="3" fill="#64748b" />
      <circle cx="50" cy="38" r="9" fill="#ffd6a8" />
      <path
        d="M50 46 L50 70 M50 46 L34 58 M50 46 L66 58"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M34 58 L30 74 M66 58 L70 74"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  calf: (
    <>
      <circle cx="50" cy="26" r="9" fill="#ffd6a8" />
      <path
        d="M50 34 L50 60 M50 60 L34 84 M50 60 L66 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M34 84 L28 92 M66 84 L72 92"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="90" width="60" height="6" rx="3" fill="#94a3b8" />
      <rect x="44" y="54" width="12" height="12" rx="3" fill="#64748b" />
    </>
  ),
  ohp: (
    <>
      <circle cx="50" cy="26" r="9" fill="#ffd6a8" />
      <path
        d="M50 34 L44 60 L34 26 M50 34 L56 60 L66 26"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="28" y="20" width="12" height="10" rx="4" fill="#eab308" />
      <rect x="60" y="20" width="12" height="10" rx="4" fill="#eab308" />
      <path
        d="M50 46 L50 84"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="32" y="82" width="36" height="7" rx="3.5" fill="#1e3a2f" />
    </>
  ),
  latraise: (
    <>
      <circle cx="50" cy="40" r="9" fill="#ffd6a8" />
      <path
        d="M50 48 L50 76"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 48 L26 30 M50 48 L74 30"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="22" width="12" height="8" rx="4" fill="#eab308" />
      <rect x="68" y="22" width="12" height="8" rx="4" fill="#eab308" />
      <rect x="32" y="82" width="36" height="7" rx="3.5" fill="#1e3a2f" />
    </>
  ),
  shrugs: (
    <>
      <circle cx="36" cy="38" r="8" fill="#ffd6a8" />
      <circle cx="64" cy="38" r="8" fill="#ffd6a8" />
      <path
        d="M36 46 L36 78 M64 46 L64 78"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="26" y="22" width="14" height="9" rx="4" fill="#64748b" />
      <rect x="60" y="22" width="14" height="9" rx="4" fill="#64748b" />
      <rect x="22" y="76" width="56" height="9" rx="4" fill="#94a3b8" />
    </>
  ),
  deadlift: (
    <>
      <circle cx="50" cy="32" r="9" fill="#ffd6a8" />
      <path
        d="M50 40 L50 62 M50 62 L34 86 M50 62 L66 86"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="14" y="84" width="16" height="10" rx="4" fill="#64748b" />
      <rect x="70" y="84" width="16" height="10" rx="4" fill="#64748b" />
      <rect x="24" y="74" width="8" height="16" rx="3" fill="#94a3b8" />
      <rect x="68" y="74" width="8" height="16" rx="3" fill="#94a3b8" />
      <rect x="30" y="70" width="40" height="6" rx="3" fill="#1e3a2f" />
    </>
  ),
  pullup: (
    <>
      <rect x="20" y="12" width="60" height="8" rx="4" fill="#94a3b8" />
      <rect x="24" y="20" width="6" height="64" rx="3" fill="#64748b" />
      <rect x="70" y="20" width="6" height="64" rx="3" fill="#64748b" />
      <circle cx="50" cy="40" r="9" fill="#ffd6a8" />
      <path
        d="M44 48 L44 62 L34 62 M56 48 L56 62 L66 62"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  plank: (
    <>
      <circle cx="50" cy="26" r="9" fill="#ffd6a8" />
      <path
        d="M50 34 L50 56 L34 88 M50 56 L66 88"
        stroke="#1e3a2f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="24" y="86" width="52" height="7" rx="3.5" fill="#94a3b8" />
    </>
  ),
  abs: (
    <>
      <rect x="30" y="14" width="8" height="70" rx="4" fill="#64748b" />
      <rect x="62" y="14" width="8" height="70" rx="4" fill="#64748b" />
      <rect x="24" y="8" width="52" height="8" rx="4" fill="#94a3b8" />
      <circle cx="50" cy="40" r="9" fill="#ffd6a8" />
      <path
        d="M50 48 L50 84 M42 48 L42 84 M58 48 L58 84"
        stroke="#1e3a2f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="36" y="42" width="28" height="4" rx="2" fill="#1e3a2f" />
    </>
  ),
  cardio: (
    <>
      <circle cx="36" cy="34" r="9" fill="#ffd6a8" />
      <circle cx="64" cy="34" r="9" fill="#ffd6a8" />
      <circle
        cx="36"
        cy="52"
        r="11"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="5"
      />
      <circle
        cx="64"
        cy="52"
        r="11"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="5"
      />
      <path
        d="M36 34 L36 44 M64 34 L64 44"
        stroke="#1e3a2f"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="10" y="80" width="80" height="6" rx="3" fill="#94a3b8" />
    </>
  ),
  burpees: (
    <>
      <circle cx="50" cy="30" r="9" fill="#ffd6a8" />
      <path
        d="M50 38 L50 58 M50 46 L34 30 M50 46 L66 30"
        stroke="#1e3a2f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 58 L34 84 M50 58 L66 84"
        stroke="#1e3a2f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="28" y="82" width="44" height="8" rx="4" fill="#94a3b8" />
    </>
  ),
};

function ExerciseVisual({ name, size = 52, done = false }) {
  const { C } = useUI();
  const src = EXERCISE_IMG_MAP[name];
  // Fallback to the old inline vector style if no dedicated SVG asset exists
  // (e.g. user-added custom exercises or a missing asset).
  if (!src) {
    const variant = EXERCISE_IMAGES[name] || "bench";
    const content = EXERCISE_SVG[variant] || EXERCISE_SVG.bench;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ display: "block", width: size, height: size }}
      >
        <rect
          width="100"
          height="100"
          rx="14"
          fill={done ? "#0d281f" : "#1e3a2f"}
        />
        {content}
      </svg>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: "hidden",
        background: done ? "#0d281f" : C.card2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

function AppLogo({ size = 74 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      <img
        src={logoSrc}
        alt="Fifty"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
function Avatar({ photo, size = 40 }) {
  const { C } = useUI();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.card2,
        border: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <User size={size * 0.48} color={C.sub} />
      )}
    </div>
  );
}
function ProBadge({ small }) {
  const { C } = useUI();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: C.goldSoft,
        color: C.gold,
        fontWeight: 800,
        fontSize: small ? 9.5 : 10.5,
        padding: small ? "2px 6px" : "3px 8px",
        borderRadius: 20,
      }}
    >
      <Crown size={small ? 9 : 10} /> PRO
    </span>
  );
}
const inputBoxStyle = (C, error) => ({
  width: "100%",
  background: C.card2,
  border: `1px solid ${error ? C.danger : C.border}`,
  borderRadius: 8,
  color: C.text,
  padding: "8px 6px",
  fontSize: 13.5,
  textAlign: "center",
  outline: "none",
});

/* ============================== SPLASH / WELCOME ============================== */
function SplashScreen() {
  const { C } = useUI();
  return (
    <div
      style={{
        height: "100vh",
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: C.bg,
      }}
    >
      <AppLogo size={84} />
      <div
        style={{
          color: C.text,
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: 0.3,
        }}
      >
        Fifty
      </div>
      <div style={{ color: C.sub, fontSize: 12.5 }}>Loading your progress…</div>
    </div>
  );
}

/* ============================== NO INTERNET SCREEN ============================== */
// Full-screen "No Internet Connection" gate shown whenever the device is
// offline. Respects the app's dark/light theme and RTL (Arabic) layout.
function NoInternetScreen({ onRetry, checking }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 30px",
        background: C.bg,
        textAlign: "center",
      }}
    >
      {/* Animated illustration */}
      <div
        style={{
          position: "relative",
          width: 132,
          height: 132,
          marginBottom: 30,
          animation: "noNetFloat 3s ease-in-out infinite",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: C.greenSoft,
            animation: "noNetPulse 2.6s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: "50%",
            background: C.card,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WifiOff size={58} color={C.green} strokeWidth={1.6} />
        </div>
      </div>
      <style>{`
        @keyframes noNetFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes noNetPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.9; }
        }
@keyframes noNetFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ animation: "noNetFadeIn 0.5s ease-out" }}>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>
          {ar ? "لا يوجد اتصال بالإنترنت" : "No Internet Connection"}
        </div>
        <div
          style={{
            color: C.sub,
            fontSize: 14,
            lineHeight: 1.6,
            marginTop: 12,
            maxWidth: 320,
          }}
        >
          {ar
            ? "يرجى الاتصال بالإنترنت لاستخدام التطبيق."
            : "Please connect to the internet to continue using the app."}
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          width: "100%",
          maxWidth: 320,
          animation: "noNetFadeIn 0.6s ease-out 0.1s backwards",
        }}
      >
        <GreenButton onClick={onRetry} disabled={checking}>
          <RefreshCcw
            size={17}
            style={{ animation: checking ? "spin 1s linear infinite" : "none" }}
          />
          {checking
            ? ar
              ? "جاري الفحص…"
              : "Checking…"
            : ar
            ? "إعادة المحاولة"
            : "Retry"}
        </GreenButton>
      </div>
    </div>
  );
}

/* ============================== NETWORK STATUS HOOK ============================== */
// Subscribes once to connectivity and always returns the current online
// state. Cleans up all listeners on unmount to avoid memory leaks.
function useNetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let mounted = true;
    // Initial check so the offline gate shows immediately on launch
    // even if no transition event fires afterwards.
    checkOnline().then((value) => {
      if (mounted) setOnline(value);
    });
    // Subscribe to connectivity changes (native + web fallback).
    const unsubscribe = watchNetwork((value) => {
      if (mounted) setOnline(value);
    });
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  return [online, setOnline];
}

function GoogleButton({ onClick, busy = false, ar = false }) {
  const { C } = useUI();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        width: "100%",
        padding: "13px 0",
        borderRadius: 13,
        border: `1px solid ${C.border}`,
        background: C.card,
        color: C.text,
        fontSize: 14.5,
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.7 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
        />
      </svg>
      {busy
        ? ar
          ? "جاري فتح حساب Google…"
          : "Opening Google…"
        : ar
          ? "تسجيل الدخول باستخدام Google"
          : "Continue with Google"}
    </button>
  );
}

function LanguageScreen({ onPick }) {
  const { C } = useUI();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        gap: 28,
      }}
    >
      <AppLogo size={72} />
      <div style={{ textAlign: "center" }}>
        <div style={{ color: C.text, fontSize: 19, fontWeight: 800 }}>
          Choose your language
        </div>
        <div style={{ color: C.sub, fontSize: 13.5, marginTop: 4 }}>
          اختر لغتك
        </div>
      </div>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          onClick={() => onPick("ar")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 20px",
            borderRadius: 16,
            cursor: "pointer",
            border: `1.5px solid ${C.border}`,
            background: C.card,
          }}
        >
          <span style={{ fontSize: 28 }}>🇸🇦</span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>
            العربية
          </span>
        </button>
        <button
          onClick={() => onPick("en")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 20px",
            borderRadius: 16,
            cursor: "pointer",
            border: `1.5px solid ${C.border}`,
            background: C.card,
          }}
        >
          <span style={{ fontSize: 28 }}>🇺🇸</span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>
            English
          </span>
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({ go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <AppLogo size={90} />
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.text, fontSize: 25, fontWeight: 800 }}>
            Fifty
          </div>
          <div
            style={{
              color: C.sub,
              fontSize: 14,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            {ar
              ? "تابع تمارينك ووزنك ووجباتك في مكان واحد."
              : "Track your workouts, weight and meals — all in one place."}
          </div>
        </div>
      </div>
      <div
        style={{
          paddingBottom: "calc(36px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <GreenButton onClick={() => go("signup")}>
          {ar ? "إنشاء حساب" : "Create Account"}{" "}
          <ArrowRight
            size={16}
            style={{ transform: ar ? "scaleX(-1)" : "none" }}
          />
        </GreenButton>
        <GreenButton variant="outline" onClick={() => go("login")}>
          {ar ? "تسجيل الدخول" : "Log In"}
        </GreenButton>
      </div>
    </div>
  );
}

/* ============================== LOGIN / SIGNUP ============================== */
function LoginScreen({ go, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setResetSent(false);
    if (!email || !isValidEmail(email)) {
      setError(ar ? "اكتب بريد إلكتروني صحيح" : "Enter a valid email address");
      return;
    }
    if (!password) {
      setError(ar ? "اكتب كلمة السر" : "Enter your password");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast(ar ? "أهلاً بيك تاني!" : "Welcome back!");
      // Root component reacts to the auth state change and routes automatically.
    } catch (err) {
      setError(authErrorMessage(err, ar));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError("");
    setResetSent(false);
    if (!email || !isValidEmail(email)) {
      setError(
        ar
          ? "اكتب إيميلك فوق الأول، وبعدين دوس نسيت كلمة السر"
          : "Enter your email above first, then tap Forgot password",
      );
      return;
    }
    try {
      // Firebase returns auth/user-not-found only when Email Enumeration
      // Protection is OFF in the Firebase Console. When it is ON, Firebase
      // intentionally returns success for unknown emails (security).
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        setError(
          ar
            ? "لا يوجد حساب مسجل بهذا البريد الإلكتروني."
            : "No account was found with this email address.",
        );
        return;
      }
      setError(authErrorMessage(err, ar));
    }
  };

  useEffect(() => {
    return subscribeGoogleAuthSettled(() => {
      setBusy(false);
    });
  }, []);

  const googleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogleFlow(ar ? "ar" : "en", freshState);
      showToast(ar ? "أهلاً بيك!" : "Welcome!");
    } catch (err) {
      showToast(googleSignInErrorMessage(err, ar));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div style={{ paddingTop: 40, paddingBottom: 20 }}>
        <IconBtn onClick={() => go("welcome")}>
          <ChevronLeft
            size={20}
            color={C.text}
            style={{ transform: ar ? "scaleX(-1)" : "none" }}
          />
        </IconBtn>
      </div>
      <AppLogo size={58} />
      <div
        style={{ color: C.text, fontSize: 23, fontWeight: 800, marginTop: 18 }}
      >
        {ar ? "أهلاً بيك تاني" : "Welcome back"}
      </div>
      <div
        style={{ color: C.sub, fontSize: 13.5, marginTop: 4, marginBottom: 26 }}
      >
        {ar
          ? "سجّل دخولك عشان تكمل تقدّمك"
          : "Log in to continue your progress"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <TextField
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={ar ? "البريد الإلكتروني" : "Email address"}
        />
        <TextField
          icon={Lock}
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={ar ? "كلمة السر" : "Password"}
          rightEl={
            <button
              onClick={() => setShowPw((s) => !s)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              {showPw ? (
                <EyeOff size={16} color={C.sub} />
              ) : (
                <Eye size={16} color={C.sub} />
              )}
            </button>
          }
          error={error}
        />
      </div>

      <div style={{ textAlign: ar ? "left" : "right", marginTop: 10 }}>
        <button
          onClick={forgotPassword}
          style={{
            background: "none",
            border: "none",
            color: C.green,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {ar ? "نسيت كلمة السر؟" : "Forgot password?"}
        </button>
      </div>
      {resetSent && (
        <div
          style={{
            color: C.green,
            fontSize: 12,
            marginTop: 6,
            textAlign: ar ? "left" : "right",
            lineHeight: 1.55,
          }}
        >
          {ar
            ? "تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. إذا لم تجد الرسالة، تحقق من مجلد الرسائل غير المرغوب فيها (Spam/Junk) والعروض الترويجية والتحديثات."
            : "Password reset instructions were sent to your email. If you don't see the message, check Spam/Junk and Promotions/Updates."}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <GreenButton onClick={submit} disabled={busy}>
          {busy
            ? ar
              ? "جاري الدخول…"
              : "Logging in…"
            : ar
            ? "تسجيل الدخول"
            : "Log In"}
        </GreenButton>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "18px 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ color: C.sub2, fontSize: 11.5 }}>
          {ar ? "أو" : "OR"}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <GoogleButton onClick={googleSignIn} busy={busy} ar={ar} />

      <div style={{ flex: 1 }} />
      <div
        style={{
          textAlign: "center",
          paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
          color: C.sub,
          fontSize: 13,
        }}
      >
        {ar ? "معندكش حساب؟" : "Don't have an account?"}{" "}
        <button
          onClick={() => go("signup")}
          style={{
            background: "none",
            border: "none",
            color: C.green,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {ar ? "إنشاء حساب" : "Sign Up"}
        </button>
      </div>
    </div>
  );
}

function SignUpScreen({ go, showToast, localLang }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = {};
    if (!name.trim()) e.name = ar ? "اكتب اسمك" : "Enter your name";
    if (!isValidEmail(email))
      e.email = ar ? "اكتب بريد إلكتروني صحيح" : "Enter a valid email address";
    if (!phone.trim() || phone.trim().replace(/\D/g, "").length < 8)
      e.phone = ar ? "اكتب رقم تليفون صحيح" : "Enter a valid phone number";
    const issues = passwordIssues(password, ar);
    if (issues.length)
      e.password = ar
        ? `كلمة السر محتاجة: ${issues.join("، ")}`
        : `Password needs: ${issues.join(", ")}`;
    if (confirm !== password)
      e.confirm = ar ? "كلمتا السر مش متطابقتين" : "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const initial = freshState();
      initial.account.name = name.trim();
      initial.account.email = email.trim();
      initial.account.phone = phone.trim();
      initial.settings.language = localLang || "en";
      initial.createdAt = new Date().toISOString();
      await setDoc(doc(db, "users", cred.user.uid), initial);
      showToast(ar ? "تم إنشاء الحساب!" : "Account created!");
      // Root component sees the new signed-in user and routes to onboarding automatically.
    } catch (err) {
      setErrors({ email: authErrorMessage(err, ar) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    return subscribeGoogleAuthSettled(() => {
      setBusy(false);
    });
  }, []);

  const googleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogleFlow(localLang, freshState);
      showToast(ar ? "أهلاً بيك!" : "Welcome!");
    } catch (err) {
      showToast(googleSignInErrorMessage(err, ar));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div style={{ paddingTop: 40, paddingBottom: 20 }}>
        <IconBtn onClick={() => go("welcome")}>
          <ChevronLeft
            size={20}
            color={C.text}
            style={{ transform: ar ? "scaleX(-1)" : "none" }}
          />
        </IconBtn>
      </div>
      <div style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>
        {ar ? "إنشاء حسابك" : "Create your account"}
      </div>
      <div
        style={{ color: C.sub, fontSize: 13.5, marginTop: 4, marginBottom: 22 }}
      >
        {ar ? "ابدأ رحلتك الرياضية" : "Start tracking your fitness journey"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <TextField
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ar ? "الاسم بالكامل" : "Full name"}
          error={errors.name}
        />
        <TextField
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={ar ? "البريد الإلكتروني" : "Email address"}
          error={errors.email}
        />
        <TextField
          icon={Phone}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={ar ? "رقم التليفون" : "Phone number"}
          error={errors.phone}
        />
        <TextField
          icon={Lock}
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={ar ? "كلمة السر" : "Password"}
          rightEl={
            <button
              onClick={() => setShowPw((s) => !s)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              {showPw ? (
                <EyeOff size={16} color={C.sub} />
              ) : (
                <Eye size={16} color={C.sub} />
              )}
            </button>
          }
          error={errors.password}
        />
        <div
          style={{ color: C.sub2, fontSize: 11, marginTop: -8, marginLeft: 2 }}
        >
          {ar
            ? "8 حروف على الأقل، حرف كابيتال، ورمز خاص (زي !@#$)"
            : "Min 8 characters, 1 uppercase letter, 1 special character (e.g. !@#$)"}
        </div>
        <TextField
          icon={Lock}
          type={showPw ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={ar ? "تأكيد كلمة السر" : "Confirm password"}
          error={errors.confirm}
        />
      </div>

      <div style={{ marginTop: 22 }}>
        <GreenButton onClick={submit} disabled={busy}>
          {busy
            ? ar
              ? "جاري إنشاء الحساب…"
              : "Creating account…"
            : ar
            ? "إنشاء حساب"
            : "Create Account"}
        </GreenButton>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "18px 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ color: C.sub2, fontSize: 11.5 }}>
          {ar ? "أو" : "OR"}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <GoogleButton onClick={googleSignIn} busy={busy} ar={ar} />

      <div style={{ flex: 1 }} />
      <div
        style={{
          textAlign: "center",
          paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
          color: C.sub,
          fontSize: 13,
        }}
      >
        {ar ? "عندك حساب بالفعل؟" : "Already have an account?"}{" "}
        <button
          onClick={() => go("login")}
          style={{
            background: "none",
            border: "none",
            color: C.green,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {ar ? "تسجيل الدخول" : "Log In"}
        </button>
      </div>
    </div>
  );
}

/* ============================== ONBOARDING ============================== */
function GeneratingPlan({ steps, activeIdx }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 30px",
        gap: 26,
      }}
    >
      <div style={{ position: "relative", width: 84, height: 84 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            border: `4px solid ${C.card2}`,
            borderTopColor: C.green,
            animation: "spin 1s linear infinite",
          }}
        />
        <Sparkles
          size={30}
          color={C.green}
          style={{ position: "absolute", top: 27, left: 27 }}
        />
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      <div
        style={{
          color: C.text,
          fontSize: 18,
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        {ar ? "جاري إعداد خطتك…" : "Building your plan…"}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: i <= activeIdx ? 1 : 0.35,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background:
                  i < activeIdx
                    ? C.green
                    : i === activeIdx
                    ? C.greenSoft
                    : C.card2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: i === activeIdx ? `2px solid ${C.green}` : "none",
              }}
            >
              {i < activeIdx && <Check size={13} color={C.onAccent} />}
            </div>
            <span
              style={{
                color: i <= activeIdx ? C.text : C.sub,
                fontSize: 13.5,
                fontWeight: i === activeIdx ? 700 : 500,
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GooglePhoneScreen({ data, setData, go, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [phone, setPhone] = useState(data?.account?.phone || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    const trimmed = (phone || "").trim();
    if (!trimmed || trimmed.replace(/\D/g, "").length < 8) {
      setError(ar ? "اكتب رقم تليفون صحيح" : "Enter a valid phone number");
      return;
    }
    setBusy(true);
    try {
      const next = clone(data);
      next.account = { ...next.account, phone: trimmed };
      // Keep name/email from Google if already present on the profile.
      setData(next);
      showToast(
        ar
          ? "تم حفظ رقم التليفون — كمّل بياناتك"
          : "Phone saved — continue setup",
      );
      go("onboarding");
    } catch (e) {
      setError(
        ar
          ? "تعذر حفظ الرقم — حاول تاني"
          : "Could not save phone — please try again",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div style={{ paddingTop: 48, paddingBottom: 12 }}>
        <AppLogo size={52} />
      </div>
      <div
        style={{ color: C.text, fontSize: 22, fontWeight: 800, marginTop: 8 }}
      >
        {ar ? "أكمل ملفك" : "Complete your profile"}
      </div>
      <div
        style={{
          color: C.sub,
          fontSize: 13.5,
          marginTop: 8,
          marginBottom: 20,
          lineHeight: 1.55,
        }}
      >
        {ar
          ? "رقم التليفون مطلوب للتواصل معك بخصوص خطط التغذية والتدريب اللي هتشتريها."
          : "Your phone number is required so we can contact you about purchased nutrition and training plans."}
      </div>
      <TextField
        icon={Phone}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={ar ? "رقم التليفون" : "Phone number"}
        error={error}
        type="tel"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 22,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 14,
          border: "none",
          background: C.text,
          color: C.bg,
          fontWeight: 800,
          fontSize: 15,
          opacity: busy ? 0.7 : 1,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy
          ? ar
            ? "جاري الحفظ…"
            : "Saving…"
          : ar
            ? "متابعة"
            : "Continue"}
      </button>
    </div>
  );
}

function OnboardingScreen({ data, setData, go, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState(4);
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genIdx, setGenIdx] = useState(0);
  const genSteps = ar
    ? [
        "جاري تحليل هدفك…",
        "جاري حساب أهدافك…",
        "جاري بناء خطة تمرينك…",
        "خلصنا تقريبًا…",
      ]
    : [
        "Analyzing your goal…",
        "Calculating your targets…",
        "Building your workout plan…",
        "Almost done…",
      ];

  useEffect(() => {
    if (!generating) return;
    if (genIdx >= genSteps.length) {
      const t = setTimeout(() => go("app"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGenIdx((i) => i + 1), 650);
    return () => clearTimeout(t);
  }, [generating, genIdx]); // eslint-disable-line

  const [activityLevel, setActivityLevel] = useState("moderate");
  const steps = ar
    ? ["النوع", "السن", "الطول", "الوزن", "الهدف", "النشاط", "الجدول"]
    : ["Gender", "Age", "Height", "Weight", "Goal", "Activity", "Schedule"];
  const total = steps.length;

  const next = () => {
    setErr("");
    if (step === 0 && !gender) {
      setErr(ar ? "من فضلك اختر نوعك" : "Please select your gender");
      return;
    }
    if (step === 1 && (!age || age < 10 || age > 100)) {
      setErr(ar ? "اكتب سن صحيح (10-100)" : "Enter a valid age (10-100)");
      return;
    }
    if (step === 2 && (!height || height < 100 || height > 250)) {
      setErr(ar ? "اكتب طول صحيح بالسنتيمتر" : "Enter a valid height in cm");
      return;
    }
    if (step === 3 && (!weight || weight < 30 || weight > 300)) {
      setErr(ar ? "اكتب وزن صحيح بالكيلوجرام" : "Enter a valid weight in kg");
      return;
    }
    if (step === 4 && !goal) {
      setErr(ar ? "من فضلك اختر هدفك" : "Please choose a goal");
      return;
    }
    if (step < total - 1) setStep(step + 1);
    else finish();
  };
  const prev = () => {
    setErr("");
    if (step > 0) setStep(step - 1);
  };

  const finish = () => {
    const next = clone(data);
    next.account = {
      ...next.account,
      gender,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
      goal,
      daysPerWeek: days,
      activityLevel,
    };
    next.activePlanId = "beginner";
    next.workoutStartDate = next.workoutStartDate || dateKey(0);
    next.bodyWeight = [createWeightEntry(Number(weight), dateKey(0))];
    const tdeeResult = calcTDEE({
      weight: Number(weight),
      height: Number(height),
      age: Number(age),
      gender,
      activityLevel,
      goal,
    });
    if (tdeeResult)
      next.dailyTargets = {
        kcal: tdeeResult.target,
        protein: tdeeResult.protein,
        carbs: tdeeResult.carbs,
        fat: tdeeResult.fat,
      };
    next.onboarded = true;
    setData(next);
    setGenerating(true);
  };

  if (generating) return <GeneratingPlan steps={genSteps} activeIdx={genIdx} />;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px calc(30px + env(safe-area-inset-bottom))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div
        style={{
          paddingTop: 32,
          paddingBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {step > 0 && (
          <IconBtn onClick={prev}>
            <ChevronLeft
              size={20}
              color={C.text}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </IconBtn>
        )}
        <div style={{ flex: 1, display: "flex", gap: 5 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: i <= step ? C.green : C.border,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>
        {ar ? `الخطوة ${step + 1} من ${total}` : `Step ${step + 1} of ${total}`}
      </div>

      <div style={{ flex: 1, marginTop: 6 }}>
        {step === 0 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              {ar ? "إيه نوعك؟" : "What's your gender?"}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { id: "Male", label: ar ? "ذكر" : "Male" },
                { id: "Female", label: ar ? "أنثى" : "Female" },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  style={{
                    flex: 1,
                    padding: "26px 0",
                    borderRadius: 16,
                    cursor: "pointer",
                    border: `1.5px solid ${
                      gender === g.id ? C.green : C.border
                    }`,
                    background: gender === g.id ? C.greenSoft : C.card,
                    color: C.text,
                    fontWeight: 700,
                    fontSize: 14.5,
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 8 }}>
                    {g.id === "Male" ? "🙋‍♂️" : "🙋‍♀️"}
                  </div>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              {ar ? "سنك كام؟" : "How old are you?"}
            </div>
            <TextField
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder={ar ? "السن (سنوات)" : "Age (years)"}
            />
          </div>
        )}
        {step === 2 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              {ar ? "طولك كام؟" : "What's your height?"}
            </div>
            <TextField
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={ar ? "الطول (سم)" : "Height (cm)"}
            />
          </div>
        )}
        {step === 3 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              {ar ? "وزنك الحالي كام؟" : "What's your current weight?"}
            </div>
            <TextField
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={ar ? "الوزن (كجم)" : "Weight (kg)"}
            />
          </div>
        )}
        {step === 4 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              {ar ? "إيه هدفك الأساسي؟" : "What's your main goal?"}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 16 }}>
              {ar
                ? "ده هيساعدنا نجهزلك خطة Pro مخصصة لما تكون جاهز تشترك."
                : "This helps us prepare your personalized Pro plan when you're ready to upgrade."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px",
                    borderRadius: 15,
                    cursor: "pointer",
                    border: `1.5px solid ${goal === g.id ? C.green : C.border}`,
                    background: goal === g.id ? C.greenSoft : C.card,
                    textAlign: ar ? "right" : "left",
                  }}
                >
                  <div style={{ fontSize: 24 }}>{g.icon}</div>
                  <div>
                    <div
                      style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}
                    >
                      {ar ? g.labelAr : g.label}
                    </div>
                    <div style={{ color: C.sub, fontSize: 12 }}>
                      {ar ? g.descAr : g.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              {ar ? "بتحرق قد إيه في يومك؟" : "How active are you daily?"}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 16 }}>
              {ar
                ? "ده بيساعدنا نحسب السعرات اللي محتاجها كل يوم بدقة."
                : "This helps us calculate your exact daily calorie needs."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  id: "none",
                  emoji: "🛋️",
                  label: ar ? "قليل جدًا" : "Sedentary",
                  desc: ar
                    ? "بقعد معظم اليوم، مش بتمرن"
                    : "Desk job, little or no exercise",
                },
                {
                  id: "light",
                  emoji: "🚶",
                  label: ar ? "نشاط خفيف" : "Lightly active",
                  desc: ar
                    ? "بتتمرن 1-3 أيام في الأسبوع"
                    : "Exercise 1–3 days/week",
                },
                {
                  id: "moderate",
                  emoji: "🏃",
                  label: ar ? "نشاط متوسط" : "Moderately active",
                  desc: ar
                    ? "بتتمرن 3-5 أيام في الأسبوع"
                    : "Exercise 3–5 days/week",
                },
                {
                  id: "high",
                  emoji: "💪",
                  label: ar ? "نشاط عالي" : "Very active",
                  desc: ar
                    ? "بتتمرن 6-7 أيام في الأسبوع"
                    : "Exercise 6–7 days/week",
                },
                {
                  id: "very_high",
                  emoji: "🔥",
                  label: ar ? "نشاط عالي جدًا" : "Extra active",
                  desc: ar
                    ? "عمل بدني + تمرين شاق كل يوم"
                    : "Physical job + intense training daily",
                },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={() => setActivityLevel(a.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: 14,
                    cursor: "pointer",
                    border: `1.5px solid ${
                      activityLevel === a.id ? C.green : C.border
                    }`,
                    background: activityLevel === a.id ? C.greenSoft : C.card,
                    textAlign: ar ? "right" : "left",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{a.emoji}</span>
                  <div>
                    <div
                      style={{ color: C.text, fontWeight: 700, fontSize: 14 }}
                    >
                      {a.label}
                    </div>
                    <div style={{ color: C.sub, fontSize: 12 }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 6 && (
          <div>
            <div
              style={{
                color: C.text,
                fontSize: 21,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              {ar ? "كام يوم تتمرن في الأسبوع؟" : "Workout days per week?"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 14,
                    cursor: "pointer",
                    border: `1.5px solid ${days === d ? C.green : C.border}`,
                    background: days === d ? C.greenSoft : C.card,
                    color: C.text,
                    fontWeight: 800,
                    fontSize: 17,
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <div
              style={{
                color: C.sub,
                fontSize: 12,
                marginTop: 14,
                lineHeight: 1.6,
              }}
            >
              {ar
                ? "هتبدأ بالخطة المجانية الأساسية النهاردة — تقدر تفتح خطة على حسب هدفك في أي وقت من صفحة الخطط."
                : "You'll start on our free Standard Plan today — you can unlock a plan built around your goal anytime from Plans."}
            </div>
          </div>
        )}
        {err && (
          <div style={{ color: C.danger, fontSize: 12.5, marginTop: 16 }}>
            {err}
          </div>
        )}
      </div>
      <GreenButton onClick={next}>
        {step === total - 1
          ? ar
            ? "إنهاء الإعداد"
            : "Finish Setup"
          : ar
          ? "التالي"
          : "Continue"}
      </GreenButton>
    </div>
  );
}

/* ============================== HOME SCREEN ============================== */
function HomeScreen({ data, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const today = dateKey(0);
  const bw = normalizeBodyWeightEntries(data.bodyWeight);
  const weightPoints = bw
    .slice(-6)
    .map((w) => ({ date: shortDate(w.date), kg: w.weight }));
  // Match the detailed chart: a single entry reads as a flat line at that real
  // weight rather than one isolated dot (repeated for rendering only).
  const singleWeightEntry = weightPoints.length === 1;
  const weightSeries = singleWeightEntry
    ? [weightPoints[0], { ...weightPoints[0], date: "" }]
    : weightPoints;
  const currentWeight = bw[bw.length - 1]?.weight ?? 0;
  const monthAgo = [...bw].reverse().find((w) => w.date <= dateKey(-28));
  const weightDelta = monthAgo
    ? Number((currentWeight - monthAgo.weight).toFixed(1))
    : 0;

  const dayName = DAYS[todayIdx];
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const dayTitle = ar
    ? activePlan.schedule[dayName].titleAr
    : activePlan.schedule[dayName].title;
  const { list: exercises } = getUsableExercises(data, dayName);
  const isRest = exercises.length === 0;

  const log = data.logs[today] || {};
  const totalSets = exercises.reduce((a, e) => a + e.targetSets, 0);
  const doneSets = exercises.reduce(
    (a, e) => a + (log[e.id]?.sets?.filter((s) => s.done).length || 0),
    0,
  );
  const workoutPct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  const isWorkoutDone = !isRest && workoutPct >= 100;

  const bench = strengthHistory(data, "bench_press");
  const benchDelta =
    bench.length >= 2
      ? bench[bench.length - 1].weight - bench[bench.length - 2].weight
      : 0;
  const firstName = (data.account.name || (ar ? "صديقنا" : "there")).split(
    " ",
  )[0];

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <div style={{ height: "env(safe-area-inset-top)" }} />
      <div style={{ height: 8 }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 18px 4px",
        }}
      >
        <div>
          <div style={{ color: C.sub, fontSize: 13 }}>
            {ar ? `${greeting(ar)}،` : `Good ${greeting(ar)},`}
          </div>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>
            {firstName} 💪
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <IconBtn onClick={() => go("reminders")}>
            <Bell size={17} color={C.text} />
          </IconBtn>
          <div onClick={() => go("profile")} style={{ cursor: "pointer" }}>
            <Avatar photo={data.account.photo} size={40} />
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <Card onClick={() => go("bodyweight")}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ color: C.sub, fontSize: 12.5 }}>
                {ar ? "الوزن الحالي" : "Current Weight"}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 800, color: C.green }}>
                  {currentWeight}
                </span>
                <span style={{ fontSize: 13, color: C.sub }}>
                  {ar ? "كجم" : "kg"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: weightTrendColor(
                    C,
                    data.account.goal,
                    weightDelta,
                  ),
                  marginTop: 4,
                }}
              >
                {weightDelta === 0
                  ? ar
                    ? "من غير تغيير"
                    : "No change"
                  : ar
                  ? `${weightDelta > 0 ? "+" : "-"}${Math.abs(
                      weightDelta,
                    )} خلال الشهر الماضي`
                  : `${weightDelta > 0 ? "+" : "-"}${Math.abs(
                      weightDelta,
                    )} last month`}
              </div>
            </div>
            <div style={{ width: 280, height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                {weightSeries.length > 0 ? (
                  // ComposedChart so the stroked line and its dots render next
                  // to the gradient area (AreaChart ignores <Line> children).
                  <ComposedChart
                    data={weightSeries}
                    margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
                  >
                    <defs>
                      <linearGradient
                        id="weightFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={C.green}
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="100%"
                          stopColor={C.green}
                          stopOpacity={0.15}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis hide dataKey="date" />
                    <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                    <Area
                      type="monotone"
                      dataKey="kg"
                      stroke="none"
                      fill="url(#weightFill)"
                      isAnimationActive={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke={C.green}
                      strokeWidth={2.8}
                      dot={
                        singleWeightEntry
                          ? false
                          : {
                              r: 3.5,
                              fill: C.green,
                              stroke: C.card,
                              strokeWidth: 2,
                            }
                      }
                      activeDot={{
                        r: 5.5,
                        fill: C.green,
                        stroke: C.card,
                        strokeWidth: 2,
                      }}
                      isAnimationActive={true}
                    />
                  </ComposedChart>
                ) : (
                  // No logged weights yet: a purely decorative baseline, never
                  // a data point.
                  <ComposedChart
                    data={[
                      { date: "a", kg: 1 },
                      { date: "b", kg: 1 },
                    ]}
                    margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
                  >
                    <XAxis hide dataKey="date" />
                    <YAxis hide domain={[0, 2]} />
                    <Line
                      type="linear"
                      dataKey="kg"
                      stroke={C.green}
                      strokeOpacity={0.35}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  color: C.sub,
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {ar
                  ? `تمرين النهاردة · ${activePlan.nameAr}`
                  : `Today's Workout · ${activePlan.name}`}{" "}
                {activePlan.pro && <ProBadge small />}
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: C.text,
                  marginTop: 3,
                }}
              >
                {dayTitle}
              </div>
              <div style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                {isRest
                  ? ar
                    ? "يوم راحة"
                    : "Recovery day"
                  : ar
                  ? `${exercises.length} تمارين`
                  : `${exercises.length} Exercises`}
              </div>
              {!isRest && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: isWorkoutDone ? C.greenSoft : C.card2,
                    color: isWorkoutDone ? C.green : C.sub,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {isWorkoutDone ? <Check size={13} /> : <Target size={13} />}
                  {isWorkoutDone
                    ? ar
                      ? "تم الانتهاء"
                      : "Completed"
                    : ar
                    ? "قيد التنفيذ"
                    : "In progress"}
                </div>
              )}
            </div>
            {!isRest && <ProgressRing pct={workoutPct} />}
          </div>
          <div style={{ marginTop: 14 }}>
            <GreenButton disabled={isRest} onClick={() => go("workout")}>
              {isRest
                ? ar
                  ? "يوم راحة"
                  : "Rest Day"
                : workoutPct > 0
                ? ar
                  ? "كمّل التمرين"
                  : "Continue Workout"
                : ar
                ? "ابدأ التمرين"
                : "Start Workout"}
            </GreenButton>
          </div>
        </Card>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {(() => {
          const totalKcal = dayKcal(data, today);
          const targets = data.dailyTargets;
          const kcalTarget = targets?.kcal || 2000;
          const kcalPct = Math.min(
            100,
            Math.round((totalKcal / kcalTarget) * 100),
          );
          const macros = dayMacros(data, today);
          const nutritionPro = data.entitlements.nutritionPro;
          return (
            <Card
              onClick={() => go("meals")}
              style={{ position: "relative", overflow: "hidden" }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: C.card2,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  🍽️
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ color: C.sub, fontSize: 11.5, fontWeight: 700 }}
                  >
                    {ar ? "تغذية النهاردة" : "TODAY'S NUTRITION"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{ color: C.text, fontSize: 18, fontWeight: 800 }}
                    >
                      {nutritionPro ? totalKcal : "—"}
                    </span>
                    <span style={{ color: C.sub, fontSize: 12 }}>
                      {nutritionPro
                        ? ` / ${kcalTarget} ${ar ? "سعرة" : "kcal"}`
                        : ar
                        ? "ادخل للبرو عشان تشوف السعرات والأهداف"
                        : "Unlock Pro to view calories & targets"}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  color={C.sub2}
                  style={{ transform: ar ? "scaleX(-1)" : "none" }}
                />
              </div>
              {nutritionPro ? (
                <>
                  <div
                    style={{
                      height: 5,
                      background: C.card2,
                      borderRadius: 3,
                      overflow: "hidden",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${kcalPct}%`,
                        background: C.green,
                        borderRadius: 3,
                        transition: "width 0.4s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 11,
                      color: C.sub,
                    }}
                  >
                    <span>
                      🥩 {macros.protein}
                      {ar ? "ج" : "g"}
                    </span>
                    <span>
                      🌾 {macros.carbs}
                      {ar ? "ج" : "g"}
                    </span>
                    <span>
                      🫙 {macros.fat}
                      {ar ? "ج" : "g"}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ color: C.sub, fontSize: 11.5 }}>
                  {ar
                    ? "افتح البرو عشان تفتح خطة غذائية مخصصة بدون ما تفتكرها مجرد أرقام"
                    : "Unlock Pro for a real personalized nutrition plan"}
                </div>
              )}
            </Card>
          );
        })()}
      </div>

      {!data.entitlements.trainingPro && !data.entitlements.nutritionPro && (
        <div style={{ padding: "14px 18px 0" }}>
          <Card
            onClick={() => go("paywall")}
            style={{
              background: C.goldSoft,
              border: `1px solid ${C.gold}55`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Crown size={22} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
                {ar ? "افتح Fifty Fit Pro" : "Unlock Fifty Fit Pro"}
              </div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar
                  ? "خطط مخصصة، تتبع كامل للأكل، والمزيد"
                  : "Personalized plans, full food tracking & more"}
              </div>
            </div>
            <ChevronRight
              size={18}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        </div>
      )}

      <div
        style={{
          padding: "18px 18px 4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>
          {ar ? "تقدّمك" : "Your Progress"}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => go("aiCoach")}
          style={{
            background: C.card2,
            border: `1px solid ${C.border}`,
            color: C.green,
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: 999,
          }}
        >
          <Sparkles size={13} />
          {ar ? "مدرب AI" : "AI Coach"}
        </button>
        <button
          onClick={() => go("progress")}
          style={{
            background: "none",
            border: "none",
            color: C.sub,
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          {ar ? "عرض الكل" : "See All"}{" "}
          <ChevronRight
            size={14}
            style={{ transform: ar ? "scaleX(-1)" : "none" }}
          />
        </button>
        </div>
      </div>
      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {bench.length > 0 ? (
          <MiniProgressRow
            label={ar ? "ضغط البنش" : "Bench Press"}
            value={`${bench[bench.length - 1].weight} ${ar ? "كجم" : "kg"}`}
            delta={benchDelta}
          />
        ) : (
          <MiniProgressRow
            label={ar ? "ضغط البنش" : "Bench Press"}
            value={ar ? "لسه معملتوش" : "Not logged yet"}
            delta={null}
          />
        )}
        <MiniProgressRow
          label={ar ? "وزن الجسم" : "Body Weight"}
          value={`${currentWeight} ${ar ? "كجم" : "kg"}`}
          delta={weightDelta}
          color={weightTrendColor(C, data.account.goal, weightDelta)}
        />
      </div>
      <div style={{ height: 10 }} />
    </div>
  );
}
function greeting(ar) {
  const h = new Date().getHours();
  if (ar) {
    if (h < 12) return "صباح الخير";
    if (h < 18) return "مساء الخير";
    return "مساء الخير";
  }
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
function MiniProgressRow({ label, value, delta, color }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <Card
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 16px",
      }}
    >
      <div>
        <div style={{ color: C.sub, fontSize: 12 }}>{label}</div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
          {value}
        </div>
      </div>
      {delta !== null && (
        <div
          dir="ltr"
          style={{
            color: color || trendColor(C, delta),
            fontSize: 12.5,
            fontWeight: 800,
          }}
        >
          {delta === 0
            ? "—"
            : `${delta > 0 ? "+" : "-"}${Math.abs(delta).toFixed(1)} ${
                ar ? "كجم" : "kg"
              }`}
        </div>
      )}
    </Card>
  );
}
function strengthHistory(data, exerciseId) {
  const out = [];
  Object.keys(data.logs)
    .sort()
    .forEach((date) => {
      const ex = data.logs[date]?.[exerciseId];
      const doneSets = ex?.sets?.filter((s) => s.done) || [];
      if (doneSets.length)
        out.push({
          date,
          weight: Math.max(...doneSets.map((s) => Number(s.weight) || 0)),
        });
    });
  return out;
}
function dayKcal(data, date) {
  const m = data.meals[date] || {};
  return MEAL_ITEMS.reduce(
    (sum, it) => sum + (m[it.id]?.items || []).reduce((s, i) => s + i.kcal, 0),
    0,
  );
}
function dayMacros(data, date) {
  const m = data.meals[date] || {};
  const totals = { protein: 0, carbs: 0, fat: 0 };
  MEAL_ITEMS.forEach((it) => {
    (m[it.id]?.items || []).forEach((i) => {
      totals.protein += i.protein || 0;
      totals.carbs += i.carbs || 0;
      totals.fat += i.fat || 0;
    });
  });
  return {
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  };
}

/* ============================== WORKOUT SCREEN ============================== */
function WorkoutScreen({
  data,
  setData,
  go,
  selectedDay,
  setSelectedDay,
  selectedIso,
  setSelectedIso,
  showToast,
}) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const dayTitle = ar
    ? activePlan.schedule[selectedDay].titleAr
    : activePlan.schedule[selectedDay].title;
  const { list: exercises, lockedCount } = getUsableExercises(
    data,
    selectedDay,
  );
  const activeDay = activeTrainingDay(data);
  const today = dateKey(0);
  // Align selection to the device local calendar day when this screen mounts.
  useEffect(() => {
    const iso = dateKey(0);
    if (selectedIso !== iso) {
      setSelectedIso(iso);
      setSelectedDay(weekdayOf(iso));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Logs are keyed by the actual calendar date of the selected strip day.
  // selectedIso is authoritative so week-boundary taps still land on the
  // correct date (not the same weekday in the current Monday week).
  const selectedDate = selectedIso || dateForDay(selectedDay);
  const log = data.logs[selectedDate] || {};
  const [showAdd, setShowAdd] = useState(false);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState("10-12");

  const removeExercise = (ex) => {
    const next = clone(data);
    if (!next.customPlan[selectedDay])
      next.customPlan[selectedDay] = { added: [], removedIds: [] };
    const cp = next.customPlan[selectedDay];
    const isCustom = (cp.added || []).some((a) => a.id === ex.id);
    if (isCustom) cp.added = cp.added.filter((a) => a.id !== ex.id);
    else {
      if (!cp.removedIds) cp.removedIds = [];
      cp.removedIds.push(ex.id);
    }
    setData(next);
    showToast(
      ar
        ? `تمت إزالة ${ar ? ex.nameAr || ex.name : ex.name} من النهاردة`
        : `${ex.name} removed from today`,
    );
  };

  const addCustomExercise = () => {
    if (!exName.trim()) {
      showToast(ar ? "اكتب اسم التمرين" : "Enter an exercise name");
      return;
    }
    const next = clone(data);
    if (!next.customPlan[selectedDay])
      next.customPlan[selectedDay] = { added: [], removedIds: [] };
    next.customPlan[selectedDay].added.push({
      id: uid(),
      name: exName.trim(),
      targetSets: Number(exSets) || 3,
      targetReps: exReps || "10-12",
      startWeight: 10,
    });
    setData(next);
    setExName("");
    setExSets(3);
    setExReps("10-12");
    setShowAdd(false);
    showToast(ar ? "تمت إضافة التمرين" : "Exercise added");
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "التمرين" : "Workout"} />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {/* Dynamic 7-day window anchored on today so the strip advances
              as calendar days pass (not a fixed dead-end range). */}
          {Array.from({ length: 7 }, (_, i) => {
            const offset = i - 2; // [today-2 ... today+4]
            const iso = dateKey(offset);
            const d = weekdayOf(iso);
            const isSelected = iso === selectedDate;
            const isToday = offset === 0;
            const isActiveDay = d === activeDay && iso === dateForDay(activeDay);
            const status = dayStatus(data, d, iso);
            const isDone = status === "done";
            const isMissed = status === "missed";
            const bg = isSelected
              ? isDone
                ? C.positive
                : isMissed
                ? C.danger
                : C.green
              : isDone
              ? C.positive
              : isMissed
              ? C.dangerSoft
              : C.card2;
            const fg = isSelected
              ? isDone || isMissed
                ? "#fff"
                : C.onAccent
              : isDone
              ? "#fff"
              : isMissed
              ? C.danger
              : isToday
              ? C.green
              : C.text;
            return (
              <button
                key={iso}
                onClick={() => {
                  setSelectedDay(d);
                  setSelectedIso(iso);
                }}
                style={{
                  minWidth: 44,
                  padding: "10px 0",
                  borderRadius: 12,
                  cursor: "pointer",
                  border:
                    (isToday || isActiveDay) && !isSelected
                      ? `1px solid ${C.green}`
                      : "1px solid transparent",
                  background: bg,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color:
                      isSelected && (isDone || isMissed)
                        ? "#fff"
                        : isSelected
                        ? C.onAccent
                        : isDone
                        ? C.positive
                        : isMissed
                        ? C.danger
                        : C.sub,
                    fontWeight: 600,
                  }}
                >
                  {ar ? DAY_LABELS_AR[d] : d}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: fg,
                    fontWeight: 700,
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </span>
                {isDone && (
                  <Check
                    size={12}
                    color="#fff"
                    strokeWidth={3}
                    style={{ position: "absolute", top: 2, right: 5 }}
                  />
                )}
                {isMissed && <span style={{ fontSize: 9, color: fg }}>!</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "18px 18px 6px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
          {dayTitle}
        </div>
        <div style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
          {ar
            ? `${exercises.length} تمارين · ${activePlan.nameAr}`
            : `${exercises.length} Exercises · ${activePlan.name}`}
        </div>
      </div>

      <div
        style={{
          padding: "6px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {exercises.length === 0 && lockedCount === 0 && (
          <Card
            style={{ textAlign: "center", padding: "30px 16px", color: C.sub }}
          >
            {ar
              ? "يوم راحة — الراحة جزء من البرنامج. 🌙"
              : "Rest day — recovery is part of the program. 🌙"}
          </Card>
        )}
        {exercises.map((ex, i) => {
          const exLog = log[ex.id];
          const done =
            exLog?.finished || (exLog?.sets || []).some((s) => s.done);
          const visual = (() => {
            const hay = `${ex.name || ""} ${ex.nameAr || ""}`.toLowerCase();
            if (/(bench|press|chest|fly|pec|dip)/.test(hay))
              return { icon: Target, color: "#60a5fa" };
            if (/(squat|leg|lunge|deadlift|hamstring|glute|calf)/.test(hay))
              return { icon: Sparkles, color: "#fb923c" };
            if (/(row|pull|back|lat|rear)/.test(hay))
              return { icon: ArrowRight, color: "#8b5cf6" };
            if (/(cardio|run|walk|bike|rope|plank|core|abs|crunch)/.test(hay))
              return { icon: Sun, color: "#38bdf8" };
            return { icon: Dumbbell, color: C.sub };
          })();
          const VisualIcon = visual.icon;
          const doneSets = (exLog?.sets || []).filter((s) => s.done);
          const bestSet = doneSets.length
            ? doneSets.reduce(
                (a, s) => (Number(s.weight) > Number(a.weight) ? s : a),
                doneSets[0],
              )
            : null;
          const completionLabel = done
            ? ar
              ? "مكتمل اليوم"
              : "Completed today"
            : ar
            ? "قيد التنفيذ"
            : "In progress";
          return (
            <Card
              key={ex.id}
              style={{
                padding: 0,
                overflow: "hidden",
                border: done
                  ? `1.5px solid ${C.green}`
                  : `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                }}
              >
                <div
                  onClick={() =>
                    go("exercise", { exerciseId: ex.id, day: selectedDay, date: selectedDate })
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      border: done
                        ? `1px solid ${C.green}55`
                        : `1px solid ${C.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <ExerciseVisual name={ex.id} size={52} done={done} />
                    {done && !ex.demoImage && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={22} color="#22c55e" strokeWidth={3} />
                      </div>
                    )}
                    {ex.demoImage && done && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={22} color="#22c55e" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}
                    >
                      {i + 1}. {ar ? ex.nameAr || ex.name : ex.name}
                    </div>
                    <div
                      style={{
                        color: done ? C.green : C.sub,
                        fontSize: 12,
                        fontWeight: done ? 700 : 400,
                      }}
                    >
                      {done
                        ? ar
                          ? `✓ مكتمل${
                              bestSet
                                ? ` · ${bestSet.weight} كجم × ${bestSet.reps}`
                                : ""
                            }`
                          : `✓ Done${
                              bestSet
                                ? ` · ${bestSet.weight}kg × ${bestSet.reps}`
                                : ""
                            }`
                        : ar
                        ? `${ex.targetSets} مجموعات`
                        : `${ex.targetSets} Sets`}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: done ? C.greenSoft : C.card2,
                        color: done ? C.green : C.sub,
                      }}
                    >
                      {done ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        <Dumbbell size={12} />
                      )}
                      {completionLabel}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeExercise(ex)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 6,
                  }}
                >
                  <Trash2 size={16} color={C.sub2} />
                </button>
                <ChevronRight
                  size={18}
                  color={done ? C.green : C.sub2}
                  onClick={() =>
                    go("exercise", { exerciseId: ex.id, day: selectedDay, date: selectedDate })
                  }
                  style={{
                    cursor: "pointer",
                    transform: ar ? "scaleX(-1)" : "none",
                  }}
                />
              </div>
              {done && (
                <div
                  style={{
                    background: C.greenSoft,
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(exLog?.sets || [])
                      .filter((s) => s.done)
                      .map((s, si) => (
                        <span
                          key={si}
                          style={{
                            background: C.green,
                            color: C.onAccent,
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 20,
                          }}
                        >
                          {s.weight}
                          {ar ? "ج" : "kg"} × {s.reps}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {lockedCount > 0 && (
          <Card
            onClick={() => go("paywall")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: C.goldSoft,
              border: `1px solid ${C.gold}55`,
            }}
          >
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
                {ar
                  ? `${lockedCount} تمرين تاني مقفول`
                  : `${lockedCount} more exercise${
                      lockedCount > 1 ? "s" : ""
                    } locked`}
              </div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar
                  ? `الخطة المجانية محدودة بـ ${FREE_EXERCISE_CAP} تمارين لليوم`
                  : `Free plan is capped at ${FREE_EXERCISE_CAP} exercises/day`}
              </div>
            </div>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        )}

        {showAdd ? (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              placeholder={ar ? "اسم التمرين" : "Exercise name"}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <TextField
                  type="number"
                  value={exSets}
                  onChange={(e) => setExSets(e.target.value)}
                  placeholder={ar ? "المجموعات" : "Sets"}
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  value={exReps}
                  onChange={(e) => setExReps(e.target.value)}
                  placeholder={ar ? "العدات (مثلاً 8-12)" : "Reps (e.g. 8-12)"}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <GreenButton
                variant="outline"
                onClick={() => setShowAdd(false)}
                style={{ flex: 1 }}
              >
                {ar ? "إلغاء" : "Cancel"}
              </GreenButton>
              <GreenButton onClick={addCustomExercise} style={{ flex: 1 }}>
                {ar ? "إضافة" : "Add"}
              </GreenButton>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 13,
              border: `1px dashed ${C.border}`,
              background: "transparent",
              color: C.green,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Plus size={16} />{" "}
            {ar ? "إضافة تمرين من عندك" : "Add Your Own Exercise"}
          </button>
        )}
      </div>

      {exercises.length > 0 &&
        (exercises.every(
          (e) =>
            log[e.id]?.finished || (log[e.id]?.sets || []).some((s) => s.done),
        ) ? (
          <div style={{ padding: "14px 18px 20px" }}>
            <GreenButton
              onClick={() => {
                showToast(
                  ar
                    ? "مبروك! خلصت تمرين اليوم 🎉"
                    : "Great job! Today's workout is complete 🎉",
                );
                // Meaningful engagement → optional Play review (cooldown-gated).
                try {
                  recordMeaningfulWorkout();
                  maybeRequestReview("workout_complete").catch(() => {});
                } catch (e) {}
              }}
              style={{
                background: C.green,
                color: C.onAccent,
                border: `1.5px solid ${C.green}`,
              }}
            >
              <Check size={16} strokeWidth={3} />{" "}
              {ar ? "تم اكتمال تمرين اليوم" : "Workout Complete"}
            </GreenButton>
          </div>
        ) : (
          <div style={{ padding: "14px 18px 20px" }}>
            <GreenButton
              onClick={() =>
                go("exercise", {
                  exerciseId: (
                    exercises.find(
                      (e) =>
                        !log[e.id]?.finished &&
                        !(log[e.id]?.sets || []).some((s) => s.done),
                    ) || exercises[0]
                  ).id,
                  day: selectedDay,
                  date: selectedDate,
                })
              }
            >
              {ar ? "ابدأ التمرين" : "Start Workout"}
            </GreenButton>
          </div>
        ))}
    </div>
  );
}

/* ============================== EXERCISE DETAIL SCREEN ============================== */
function ExerciseScreen({
  data,
  setData,
  back,
  exerciseId,
  day,
  logDateIso,
  showToast,
  awardXp,
}) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [tab, setTab] = useState("today");
  // Only exercises inside the user's entitlement can be opened, so a free
  // account can never reach exercise 5+ of the day through a stale link.
  const { list: exercises } = getUsableExercises(data, day);
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex) {
    return (
      <div dir={ar ? "rtl" : "ltr"}>
        <TopBar title={ar ? "التمرين" : "Exercise"} onBack={back} />
        <div style={{ padding: 18, color: C.sub, fontSize: 13.5 }}>
          {ar
            ? "التمرين ده مش متاح في خطتك الحالية."
            : "This exercise isn't available on your current plan."}
        </div>
      </div>
    );
  }
  // Persist sets against the calendar date of the selected strip day so
  // Start Workout can resume the next incomplete exercise for that day.
  // Prefer the explicit ISO from navigation (handles week-boundary taps).
  const logDate = logDateIso || dateForDay(day);

  const existingLog = data.logs[logDate]?.[exerciseId];
  const sets = existingLog?.sets?.length
    ? existingLog.sets
    : Array.from({ length: ex.targetSets }, () => ({
        weight: ex.startWeight,
        reps: 10,
        done: false,
      }));

  const updateSets = (newSets, finished) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    const nextFinished =
      typeof finished === "boolean" ? finished : newSets.some((s) => s.done);
    next.logs[logDate][exerciseId] = {
      sets: newSets,
      finished: nextFinished,
    };
    setData(next);
  };
  const toggleDone = (idx) =>
    updateSets(sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s)));
  const updateField = (idx, field, value) =>
    updateSets(sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const addSet = () => {
    const last = sets[sets.length - 1];
    const nextSets = [
      ...sets,
      {
        weight: last?.weight ?? ex.startWeight,
        reps: last?.reps ?? 10,
        done: false,
      },
    ];
    updateSets(nextSets);
  };
  const finish = () => {
    updateSets(sets, true);
    awardXp(35);
    showToast(ar ? "تم حفظ التمرين!" : "Exercise saved!");
    back();
  };

  const history = Object.keys(data.logs)
    .filter((d) => data.logs[d]?.[exerciseId]?.sets?.some((s) => s.done))
    .sort()
    .reverse()
    .map((d) => {
      const doneSets = data.logs[d][exerciseId].sets.filter((s) => s.done);
      const top = doneSets.reduce(
        (a, s) => (Number(s.weight) > Number(a.weight) ? s : a),
        doneSets[0],
      );
      return { date: d, weight: Number(top.weight), reps: Number(top.reps) };
    });

  // For Arabic (RTL), newest should be on the LEFT and oldest on the RIGHT.
  // `history` is already newest-first, so for RTL keep it as-is; for LTR reverse it.
  const chartData = (ar ? history : [...history].reverse())
    .slice(0, 8)
    .map((h) => ({ date: shortDate(h.date), kg: h.weight }));
  const doneCount = sets.filter((s) => s.done).length;
  const lastTop = history[0];
  const kgLabel = ar ? "كجم" : "kg";
  const repsLabel = ar ? "عدة" : "reps";
  const suggestion = lastTop
    ? `${(lastTop.weight + 2.5).toFixed(1)} ${kgLabel} × ${
        lastTop.reps + 2
      } ${repsLabel}`
    : `${ex.startWeight} ${kgLabel} × 10 ${repsLabel}`;

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar
        title={ar ? ex.nameAr || ex.name : ex.name}
        onBack={back}
        right={
          <IconBtn>
            <Info size={16} color={C.sub} />
          </IconBtn>
        }
      />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.card2,
            padding: 4,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Pill active={tab === "today"} onClick={() => setTab("today")}>
            {ar ? "النهاردة" : "Today"}
          </Pill>
          <Pill active={tab === "history"} onClick={() => setTab("history")}>
            {ar ? "السجل" : "History"}
          </Pill>
        </div>
      </div>

      {tab === "today" && (
        <div style={{ padding: "0 18px" }}>
          <Card
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 12,
                background: C.card2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Target size={26} color={C.green} />
            </div>
            <div>
              <div style={{ color: C.sub, fontSize: 12 }}>
                {ar ? "الهدف" : "Target"}
              </div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>
                {ar
                  ? `${ex.targetSets} مجموعات × ${ex.targetReps} عدة`
                  : `${ex.targetSets} Sets x ${ex.targetReps} Reps`}
              </div>
            </div>
          </Card>

          <VideoPlayer videoId={ex.vid} ar={ar} />

          <div
            style={{
              display: "flex",
              color: C.sub,
              fontSize: 11.5,
              padding: "0 4px 8px",
              fontWeight: 600,
            }}
          >
            <div style={{ width: 30 }}>{ar ? "#" : "Set"}</div>
            <div style={{ flex: 1 }}>{ar ? "الوزن (كجم)" : "Weight (kg)"}</div>
            <div style={{ flex: 1 }}>{ar ? "العدات" : "Reps"}</div>
            <div style={{ width: 40, textAlign: "center" }}>
              {ar ? "تم" : "Done"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sets.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "8px 10px",
                }}
              >
                <div style={{ width: 30, color: C.sub, fontWeight: 700 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <input
                    type="number"
                    value={s.weight}
                    onChange={(e) => updateField(idx, "weight", e.target.value)}
                    style={inputBoxStyle(C)}
                  />
                </div>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <input
                    type="number"
                    value={s.reps}
                    onChange={(e) => updateField(idx, "reps", e.target.value)}
                    style={inputBoxStyle(C)}
                  />
                </div>
                <div
                  style={{
                    width: 40,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => toggleDone(idx)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      border: `2px solid ${s.done ? C.green : C.border}`,
                      background: s.done ? C.green : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {s.done && <Check size={15} color={C.onAccent} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addSet}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "12px 0",
              borderRadius: 12,
              border: `1px dashed ${C.border}`,
              background: "transparent",
              color: C.green,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Plus size={16} /> {ar ? "إضافة مجموعة" : "Add Set"}
          </button>

          <Card
            style={{ marginTop: 14, background: C.greenSoft, border: "none" }}
          >
            <div style={{ color: C.sub, fontSize: 12 }}>
              {ar ? "اقتراح للمرة الجاية" : "Next Time Suggestion"}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  color: C.text,
                  fontWeight: 700,
                  fontSize: 15,
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  lineHeight: 1.4,
                }}
              >
                {suggestion}
              </span>
              <TrendingUp size={18} color={C.green} style={{ flexShrink: 0 }} />
            </div>
          </Card>

          <div style={{ margin: "16px 0 20px" }}>
            <GreenButton onClick={finish} disabled={doneCount === 0}>
              {ar ? "إنهاء التمرين" : "Finish Exercise"}{" "}
              {doneCount > 0 && `(${doneCount}/${sets.length})`}
            </GreenButton>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "0 18px 20px" }}>
          {chartData.length > 1 && (
            <Card style={{ marginBottom: 14 }}>
              <div
                style={{
                  color: C.text,
                  fontWeight: 700,
                  fontSize: 13.5,
                  marginBottom: 8,
                }}
              >
                {ar ? "التقدم عبر الوقت" : "Progress Over Time"}
              </div>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke={C.sub2}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={C.sub2}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={26}
                    />
                    <Tooltip
                      contentStyle={{
                        background: C.card2,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        fontSize: 12,
                        color: C.text,
                      }}
                      labelStyle={{ color: C.text, fontWeight: 700 }}
                      itemStyle={{ color: C.text }}
                    />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke={C.green}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: C.green }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {history.length === 0 && (
            <Card style={{ textAlign: "center", padding: 30, color: C.sub }}>
              {ar
                ? "لسه معملتش سجل للتمرين ده."
                : "No history yet for this exercise."}
            </Card>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((h) => (
              <Card
                key={h.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ color: C.text, fontWeight: 600, fontSize: 13.5 }}
                >
                  {fmtDate(h.date)}
                </span>
                <span style={{ color: C.sub, fontSize: 13 }}>
                  {h.weight} {kgLabel} × {h.reps} {repsLabel}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== PROGRESS SCREEN ============================== */
function ProgressScreen({ data, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [tab, setTab] = useState("strength");
  const pro = data.entitlements.trainingPro;

  const exercisePool = useMemo(() => {
    const map = new Map();
    Object.values(PLAN_TEMPLATES).forEach((p) =>
      Object.values(p.schedule).forEach((d) =>
        d.exercises.forEach((e) => map.set(e.id, e)),
      ),
    );
    return map;
  }, []);

  const strengthRows = [];
  exercisePool.forEach((ex, id) => {
    const hist = strengthHistory(data, id);
    if (hist.length >= 2)
      strengthRows.push({
        name: ex.name,
        nameAr: ex.nameAr,
        from: hist[0].weight,
        to: hist[hist.length - 1].weight,
      });
  });

  const bw = pro
    ? data.bodyWeight
    : data.bodyWeight.filter((w) => monthKey(w.date) === monthKey(dateKey(0)));

  const today = dateKey(0);
  const thisWeekStart = mondayOf(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const thisWeekCount = setsCompletedInRange(data, thisWeekStart, today);
  const lastWeekCount = setsCompletedInRange(data, lastWeekStart, lastWeekEnd);
  const weeklyTrend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i -= 1) {
      const start = addDays(thisWeekStart, -7 * i);
      // Current week (i===0) ends at today so the chart matches the
      // "sets completed" number under it; past weeks stay full Mon–Sun.
      const end = i === 0 ? today : addDays(start, 6);
      out.push({
        label: ar ? `أ${6 - i}` : `W${6 - i}`,
        count: setsCompletedInRange(data, start, end),
      });
    }
    return out;
  }, [data, ar, thisWeekStart, today]);

  const yesterday = dateKey(-1);
  const dayBefore = dateKey(-2);
  const yestCount = setsCompletedInRange(data, yesterday, yesterday);
  const dayBeforeCount = setsCompletedInRange(data, dayBefore, dayBefore);

  const thisMonthCount = setsCompletedInRange(
    data,
    monthKey(today) + "-01",
    today,
  );
  const lastMonthDate = addDays(monthKey(today) + "-01", -1);
  const lastMonthCount = setsCompletedInRange(
    data,
    monthKey(lastMonthDate) + "-01",
    lastMonthDate,
  );
  const kgLabel = ar ? "كجم" : "kg";

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "التقدم" : "Progress"} />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.card2,
            padding: 4,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Pill active={tab === "strength"} onClick={() => setTab("strength")}>
            {ar ? "القوة" : "Strength"}
          </Pill>
          <Pill
            active={tab === "bodyweight"}
            onClick={() => setTab("bodyweight")}
          >
            {ar ? "وزن الجسم" : "Body Weight"}
          </Pill>
        </div>
      </div>

      {tab === "strength" && (
        <div
          style={{
            padding: "0 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Card>
            <div
              style={{
                color: C.text,
                fontWeight: 700,
                fontSize: 13.5,
                marginBottom: 8,
              }}
            >
              {ar ? "اتجاه الأسبوع" : "Weekly Momentum"}
            </div>
            <div style={{ height: 120, marginBottom: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={C.green}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={C.green}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={C.sub2}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={C.sub2}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                    domain={[0, (max) => Math.max(4, Number(max) || 0)]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: C.card2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: C.text,
                    }}
                    labelStyle={{ color: C.text, fontWeight: 700 }}
                    itemStyle={{ color: C.text }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={C.green}
                    strokeWidth={2.2}
                    fill="url(#trendFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: C.sub, fontSize: 11.5 }}>
                  {ar ? "المجموعات المكتملة" : "Sets completed"}
                </div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>
                  {thisWeekCount}
                  <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>
                    {ar ? ` مقابل ${lastWeekCount}` : ` vs ${lastWeekCount}`}
                  </span>
                </div>
              </div>
              <div
                style={{
                  color: trendColor(C, thisWeekCount - lastWeekCount),
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {thisWeekCount >= lastWeekCount ? "↑" : "↓"}
                {Math.abs(thisWeekCount - lastWeekCount)}
              </div>
            </div>
          </Card>

          {pro ? (
            <>
              <Card>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 700,
                    fontSize: 13.5,
                    marginBottom: 8,
                  }}
                >
                  {ar ? "إمبارح مقابل اللي قبله" : "Yesterday vs Day Before"}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>
                    {yestCount}{" "}
                    <span
                      style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}
                    >
                      {ar ? `مقابل ${dayBeforeCount}` : `vs ${dayBeforeCount}`}
                    </span>
                  </div>
                  <div
                    style={{
                      color: trendColor(C, yestCount - dayBeforeCount),
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {yestCount >= dayBeforeCount ? "↑" : "↓"}{" "}
                    {Math.abs(yestCount - dayBeforeCount)}
                  </div>
                </div>
              </Card>
              <Card>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 700,
                    fontSize: 13.5,
                    marginBottom: 8,
                  }}
                >
                  {ar
                    ? "الشهر ده مقابل الشهر اللي فات"
                    : "This Month vs Last Month"}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>
                    {thisMonthCount}{" "}
                    <span
                      style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}
                    >
                      {ar ? `مقابل ${lastMonthCount}` : `vs ${lastMonthCount}`}
                    </span>
                  </div>
                  <div
                    style={{
                      color: trendColor(C, thisMonthCount - lastMonthCount),
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {thisMonthCount >= lastMonthCount ? "↑" : "↓"}{" "}
                    {Math.abs(thisMonthCount - lastMonthCount)}
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card
              onClick={() => go("paywall")}
              style={{
                background: C.goldSoft,
                border: `1px solid ${C.gold}55`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Crown size={20} color={C.gold} />
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                  {ar ? "مقارنات يومية وشهرية" : "Daily & monthly comparisons"}
                </div>
                <div style={{ color: C.sub, fontSize: 11.5 }}>
                  {ar ? "افتحها مع Training Pro" : "Unlock with Training Pro"}
                </div>
              </div>
              <ChevronRight
                size={16}
                color={C.sub2}
                style={{ transform: ar ? "scaleX(-1)" : "none" }}
              />
            </Card>
          )}

          {strengthRows.length === 0 && (
            <Card style={{ textAlign: "center", padding: 30, color: C.sub }}>
              {ar
                ? "سجّل مجموعات أكثر من مرة في التمرين عشان يظهر لك تقدم حقيقي في القوة."
                : "Log a few workouts with completed sets to see real strength progress here."}
            </Card>
          )}
          {strengthRows.map((r) => {
            const delta = r.to - r.from;
            const pct = Math.min(
              100,
              Math.max(12, ((delta || 0) / 20 + 0.5) * 100),
            );
            return (
              <Card key={r.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}
                  >
                    {ar ? r.nameAr || r.name : r.name}
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      color: trendColor(C, delta),
                      fontWeight: 700,
                      fontSize: 12.5,
                    }}
                  >
                    {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                    {Math.abs(delta).toFixed(1)} {kgLabel}
                  </span>
                </div>
                <div
                  dir="ltr"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: C.sub,
                    fontSize: 12,
                    marginBottom: 8,
                    justifyContent: ar ? "flex-start" : "flex-start",
                  }}
                >
                  <span>
                    {r.from} {kgLabel}
                  </span>
                  <span>→</span>
                  <span
                    style={{
                      color: trendColor(C, delta),
                      fontWeight: 700,
                    }}
                  >
                    {r.to} {kgLabel}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: C.card2,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: delta > 0 ? C.positive : delta < 0 ? C.danger : C.sub2,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "bodyweight" && (
        <div style={{ padding: "0 18px" }}>
          {!pro && (
            <Card
              onClick={() => go("paywall")}
              style={{
                marginBottom: 12,
                background: C.goldSoft,
                border: `1px solid ${C.gold}55`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Crown size={20} color={C.gold} />
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                  {ar
                    ? "الخطة المجانية بتحتفظ بشهر واحد بس"
                    : "Free plan keeps only this month's history"}
                </div>
                <div style={{ color: C.sub, fontSize: 11.5 }}>
                  {ar
                    ? "اشترك في Training Pro للاحتفاظ بكل السجل"
                    : "Upgrade to Training Pro to keep it all"}
                </div>
              </div>
              <ChevronRight
                size={16}
                color={C.sub2}
                style={{ transform: ar ? "scaleX(-1)" : "none" }}
              />
            </Card>
          )}
          <Card>
            {(() => {
              const chartBw = normalizeBodyWeightEntries(data.bodyWeight);
              const chartPoints = chartBw.map((w) => ({
                date: shortDate(w.date),
                label: `${fmtDate(w.date)} • ${w.time}`,
                kg: w.weight,
                time: w.time,
              }));
              const singleEntry = chartPoints.length === 1;
              const chartData = singleEntry
                ? [chartPoints[0], { ...chartPoints[0] }]
                : chartPoints;
              const minWeight = chartData.length
                ? Math.min(...chartData.map((d) => d.kg))
                : 0;
              const maxWeight = chartData.length
                ? Math.max(...chartData.map((d) => d.kg))
                : 0;
              return chartData.length >= 1 ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 12, bottom: 8, left: -12 }}
                    >
                      <CartesianGrid
                        stroke={C.border}
                        vertical={false}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="date"
                        stroke={C.sub2}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke={C.sub2}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        domain={[Math.max(0, minWeight - 2), maxWeight + 2]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: C.card2,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          color: C.text,
                        }}
                        labelStyle={{ color: C.text, fontWeight: 700 }}
                        itemStyle={{ color: C.text }}
                        labelFormatter={(value, payload) =>
                          payload?.[0]?.payload?.label || value
                        }
                        formatter={(value) => [
                          `${value} ${ar ? "كجم" : "kg"}`,
                          ar ? "الوزن" : "Weight",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="kg"
                        stroke={C.green}
                        strokeWidth={2.8}
                        dot={
                          singleEntry
                            ? false
                            : {
                                r: 4,
                                fill: C.green,
                                stroke: C.card,
                                strokeWidth: 2,
                              }
                        }
                        activeDot={{
                          r: 6,
                          fill: C.green,
                          stroke: C.card,
                          strokeWidth: 2,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: C.sub,
                    fontSize: 13,
                  }}
                >
                  {ar ? "سجّل أول وزن ليك." : "Log your first weight entry."}
                </div>
              );
            })()}
          </Card>
          <div style={{ marginTop: 12 }}>
            <GreenButton onClick={() => go("bodyweight")}>
              {ar ? "تسجيل وزن جديد" : "Log New Weight"}
            </GreenButton>
          </div>
        </div>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ============================== BODY WEIGHT SCREEN ============================== */
function BodyWeightScreen({ data, setData, back, showToast, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [view, setView] = useState("graph");
  const [newWeight, setNewWeight] = useState(
    data.bodyWeight[data.bodyWeight.length - 1]?.weight ?? 70,
  );
  const pro = data.entitlements.trainingPro;

  const allSorted = useMemo(
    () => normalizeBodyWeightEntries(data.bodyWeight),
    [data.bodyWeight],
  );
  const current = allSorted[allSorted.length - 1];
  const monthAgo = [...allSorted].reverse().find((w) => w.date <= dateKey(-28));
  const delta =
    current && monthAgo
      ? Number((current.weight - monthAgo.weight).toFixed(1))
      : 0;

  const save = () => {
    const today = dateKey(0);
    const val = Number(newWeight);
    if (!val || val < 20 || val > 400) {
      showToast(ar ? "اكتب وزن صحيح" : "Enter a valid weight");
      return;
    }
    const next = clone(data);
    next.bodyWeight = normalizeBodyWeightEntries([
      ...next.bodyWeight,
      createWeightEntry(val, today),
    ]);
    const tdeeResult = calcTDEE({
      weight: val,
      height: next.account.height,
      age: next.account.age,
      gender: next.account.gender,
      activityLevel: next.account.activityLevel || "moderate",
      goal: next.account.goal,
    });
    if (tdeeResult)
      next.dailyTargets = {
        kcal: tdeeResult.target,
        protein: tdeeResult.protein,
        carbs: tdeeResult.carbs,
        fat: tdeeResult.fat,
      };
    setData(next);
    showToast(ar ? `تم تسجيل الوزن: ${val} كجم` : `Weight logged: ${val} kg`);
  };

  const deleteEntry = (entryId) => {
    const next = clone(data);
    next.bodyWeight = next.bodyWeight.filter((w) => w.id !== entryId);
    setData(next);
  };

  const points = allSorted.map((w) => ({
    date: shortDate(w.date),
    label: `${fmtDate(w.date)} • ${w.time}`,
    kg: w.weight,
    time: w.time,
  }));
  // A single entry is drawn as a flat line at that real weight instead of one
  // lonely dot: the value is repeated for rendering only, never stored.
  const singleEntry = points.length === 1;
  const chartData = singleEntry ? [points[0], { ...points[0] }] : points;
  const minWeight = chartData.length
    ? Math.min(...chartData.map((d) => d.kg))
    : 0;
  const maxWeight = chartData.length
    ? Math.max(...chartData.map((d) => d.kg))
    : 0;

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "وزن الجسم" : "Body Weight"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.card2,
            padding: 4,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Pill active={view === "graph"} onClick={() => setView("graph")}>
            {ar ? "رسم بياني" : "Graph"}
          </Pill>
          <Pill active={view === "list"} onClick={() => setView("list")}>
            {ar ? "قائمة" : "List"}
          </Pill>
        </div>

        {/* Current weight header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.text }}>
              {current?.weight ?? 0}{" "}
              <span style={{ fontSize: 15, color: C.sub, fontWeight: 500 }}>
                {ar ? "كجم" : "kg"}
              </span>
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
              {current
                ? fmtDate(current.date)
                : ar
                ? "لسه معملتش أي تسجيل"
                : "No entries yet"}
            </div>
          </div>
          {monthAgo && (
            <div style={{ textAlign: ar ? "left" : "right" }}>
              <div
                style={{
                  color: weightTrendColor(C, data.account.goal, delta),
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}{" "}
                {ar ? "كجم" : "kg"}
              </div>
              <div style={{ color: C.sub2, fontSize: 11 }}>
                {ar ? "آخر 30 يوم" : "last 30 days"}
              </div>
            </div>
          )}
        </div>

        {view === "graph" ? (
          <Card>
            <div style={{ height: 220, position: "relative" }}>
              {allSorted.length === 0 && (
                /* Decorative baseline while there is no logged weight yet —
                   never a data point, no synthetic entry is added. */
                <div
                  style={{
                    position: "absolute",
                    left: 26,
                    right: 10,
                    top: "50%",
                    height: 1.5,
                    background: C.green,
                    opacity: 0.35,
                    borderRadius: 999,
                    pointerEvents: "none",
                  }}
                />
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 10, bottom: 8, left: -10 }}
                >
                  <CartesianGrid
                    stroke={C.border}
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    stroke={C.sub2}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={C.sub2}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tick={chartData.length > 0}
                    domain={[Math.max(0, minWeight - 2), maxWeight + 2]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: C.card2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.text,
                    }}
                    labelStyle={{ color: C.text, fontWeight: 700 }}
                    itemStyle={{ color: C.text }}
                    labelFormatter={(value, payload) =>
                      payload?.[0]?.payload?.label || value
                    }
                    formatter={(v) => [
                      `${v} ${ar ? "كجم" : "kg"}`,
                      ar ? "الوزن" : "Weight",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke={C.green}
                    strokeWidth={2.8}
                    dot={
                      singleEntry
                        ? false
                        : {
                            r: 4,
                            fill: C.green,
                            stroke: C.card,
                            strokeWidth: 2,
                          }
                    }
                    activeDot={{
                      r: 6,
                      fill: C.green,
                      stroke: C.card,
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {allSorted.length === 1 && (
              <div
                style={{
                  textAlign: "center",
                  color: C.sub2,
                  fontSize: 11.5,
                  marginTop: 8,
                }}
              >
                {ar
                  ? "سجّل وزن تاني عشان تشوف التغيير"
                  : "Log another weight to see your trend"}
              </div>
            )}
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allSorted.length === 0 && (
              <Card style={{ textAlign: "center", padding: 24, color: C.sub }}>
                {ar ? "لسه معملتش أي تسجيل." : "No entries yet."}
              </Card>
            )}
            {[...allSorted].reverse().map((w) => (
              <Card
                key={w.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span style={{ color: C.sub, fontSize: 13 }}>
                    {fmtDate(w.date)} • {w.time}
                  </span>
                  <span style={{ color: C.sub2, fontSize: 11.5 }}>
                    {ar ? "سجل جديد" : "New entry"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{ color: C.text, fontWeight: 700, fontSize: 14 }}
                  >
                    {w.weight} {ar ? "كجم" : "kg"}
                  </span>
                  <button
                    onClick={() => deleteEntry(w.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    <Trash2 size={15} color={C.sub2} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            color: C.sub,
            fontSize: 12.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {ar ? "إضافة وزن" : "Add Weight"}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <div
            style={{
              flex: 1,
              background: C.card,
              border: `1px solid ${C.border}`,
              clipPath: chamfer(10),
              padding: "13px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <input
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: C.text,
                fontSize: 18,
                fontWeight: 800,
                width: "70%",
              }}
            />
            <span style={{ color: C.sub, fontSize: 14 }}>
              {ar ? "كجم" : "kg"}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 12, marginBottom: 20 }}>
          <GreenButton onClick={save}>{ar ? "حفظ" : "Save"}</GreenButton>
        </div>
      </div>
    </div>
  );
}

/* ============================== MEALS SCREEN ============================== */
function MealsScreen({ data, setData, back, showToast, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const today = dateKey(0);
  const pro = data.entitlements.nutritionPro;
  const meals = data.meals[today] || {};
  const totalKcal = dayKcal(data, today);
  const macros = dayMacros(data, today);
  const plan = data.nutritionPlan;
  const targets = data.dailyTargets;
  const kcalTarget = targets?.kcal || 2000;
  const kcalPct = Math.min(100, Math.round((totalKcal / kcalTarget) * 100));

  const removeItem = (mealId, itemIdx) => {
    const next = clone(data);
    next.meals[today][mealId].items.splice(itemIdx, 1);
    setData(next);
  };
  const markPlanSeen = () => {
    if (!data.nutritionPlan?.unread) return;
    const next = clone(data);
    next.nutritionPlan.unread = false;
    setData(next);
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "التغذية" : "Nutrition"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        {!pro ? (
          <Card
            style={{
              marginBottom: 12,
              background: `${C.card}CC`,
              border: `1px solid ${C.border}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: C.gold, fontSize: 11.5, fontWeight: 800 }}>
                  {ar ? "Nutrition Pro" : "NUTRITION PRO"}
                </div>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 800,
                    fontSize: 15.5,
                    marginTop: 4,
                  }}
                >
                  {ar
                    ? "أهداف غذائية مخصصة ومشفرة برو"
                    : "Personalized nutrition targets, locked behind Pro"}
                </div>
                <div style={{ color: C.sub, fontSize: 12.5, marginTop: 6 }}>
                  {ar
                    ? "السعرات والبروتين والكربوهيدرات والدهون هتظهر هنا بعد ما تفتح البرو"
                    : "Calories, protein, carbs and fat appear here once you unlock Pro"}
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: C.goldSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Crown size={20} color={C.gold} />
              </div>
            </div>
            <div
              style={{
                height: 8,
                background: C.card2,
                borderRadius: 999,
                marginTop: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "72%",
                  height: "100%",
                  background: `linear-gradient(90deg, ${C.gold}, ${C.green})`,
                  borderRadius: 999,
                }}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => go("paywall")}
                style={{
                  background: C.green,
                  color: C.onAccent,
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {ar ? "اكتشف البرو" : "Unlock Pro"}
              </button>
            </div>
          </Card>
        ) : (
          <Card style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ color: C.sub, fontSize: 11.5, fontWeight: 700 }}>
                  {ar ? "السعرات اليوم" : "CALORIES TODAY"}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 5,
                    marginTop: 3,
                  }}
                >
                  <span
                    style={{ color: C.text, fontSize: 28, fontWeight: 900 }}
                  >
                    {totalKcal}
                  </span>
                  <span style={{ color: C.sub, fontSize: 13 }}>
                    / {kcalTarget} {ar ? "سعرة" : "kcal"}
                  </span>
                </div>
              </div>
              <ProgressRing pct={kcalPct} size={54} stroke={6} />
            </div>
            <div
              style={{
                height: 6,
                background: C.card2,
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${kcalPct}%`,
                  background: kcalPct > 100 ? C.danger : C.green,
                  borderRadius: 4,
                  transition: "width 0.4s",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                {
                  label: ar ? "بروتين" : "Protein",
                  val: macros.protein,
                  target: targets?.protein || 150,
                  color: "#60a5fa",
                },
                {
                  label: ar ? "كارب" : "Carbs",
                  val: macros.carbs,
                  target: targets?.carbs || 200,
                  color: "#f59e0b",
                },
                {
                  label: ar ? "دهون" : "Fat",
                  val: macros.fat,
                  target: targets?.fat || 65,
                  color: "#fb923c",
                },
              ].map((m) => (
                <div key={m.label} style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{ color: C.sub2, fontSize: 10, fontWeight: 700 }}
                    >
                      {m.label}
                    </span>
                    <span style={{ color: C.sub, fontSize: 10 }}>
                      {m.val}/{m.target}
                      {ar ? "ج" : "g"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: C.card2,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (m.val / m.target) * 100)}%`,
                        background: m.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {pro && plan ? (
          <Card
            onClick={markPlanSeen}
            style={{
              marginTop: 14,
              background: C.greenSoft,
              border: `1px solid ${C.green}55`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <Sparkles size={18} color={C.green} />
              <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>
                {ar ? "خطتك الغذائية المخصصة" : "Your Personalized Diet Plan"}
              </span>
              {plan.unread && (
                <span
                  style={{
                    background: C.green,
                    color: C.onAccent,
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 20,
                  }}
                >
                  {ar ? "جديد" : "NEW"}
                </span>
              )}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>
              {ar
                ? `الهدف: ${plan.targetKcal} سعرة · بروتين ${plan.targetProtein}ج · كارب ${plan.targetCarbs}ج · دهون ${plan.targetFat}ج`
                : `Target: ${plan.targetKcal} kcal · P ${plan.targetProtein}g · C ${plan.targetCarbs}g · F ${plan.targetFat}g`}
            </div>
            <div
              style={{
                color: C.text,
                fontSize: 12.5,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {plan.notes}
            </div>
          </Card>
        ) : (
          <Card
            onClick={() => go("paywall")}
            style={{
              marginTop: 14,
              background: C.goldSoft,
              border: `1px solid ${C.gold}55`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                {ar
                  ? "احصل على خطة غذائية كاملة مخصصة ليك"
                  : "Get a full diet plan made for you"}
              </div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar
                  ? "مخصصة حسب هدفك وجسمك — Nutrition Pro"
                  : "Personalized by your goal & body — Nutrition Pro"}
              </div>
            </div>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        )}

        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {MEAL_ITEMS.map((m) => {
            const Icon = m.icon;
            const items = meals[m.id]?.items || [];
            const mealKcal = items.reduce((s, i) => s + i.kcal, 0);
            return (
              <Card key={m.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: items.length ? 10 : 0,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 11,
                      background: items.length ? C.greenSoft : C.card2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={19} color={items.length ? C.green : C.sub} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ color: C.text, fontWeight: 700, fontSize: 14 }}
                    >
                      {ar ? m.nameAr : m.name}
                    </div>
                    <div style={{ color: C.sub, fontSize: 12 }}>
                      {items.length
                        ? ar
                          ? `${mealKcal} سعرة · ${items.length} صنف`
                          : `${mealKcal} kcal · ${items.length} item${
                              items.length > 1 ? "s" : ""
                            }`
                        : ar
                        ? "لسه ملحقتش تسجّل أكل"
                        : "No food logged"}
                    </div>
                  </div>
                  <button
                    onClick={() => go("foodPicker", { mealId: m.id })}
                    style={{
                      background: C.card2,
                      border: "none",
                      borderRadius: 9,
                      padding: "8px 12px",
                      color: C.green,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Plus size={13} /> {ar ? "إضافة" : "Add"}
                  </button>
                </div>
                {items.length > 0 && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: C.card2,
                          borderRadius: 9,
                          padding: "8px 10px",
                        }}
                      >
                        <div>
                          <div style={{ color: C.text, fontSize: 12.5 }}>
                            {it.name} · {it.grams}
                            {ar ? "ج" : "g"}
                          </div>
                          <div
                            style={{
                              color: C.sub2,
                              fontSize: 10.5,
                              marginTop: 1,
                            }}
                          >
                            {ar
                              ? `بروتين ${it.protein ?? 0}ج · كارب ${
                                  it.carbs ?? 0
                                }ج · دهون ${it.fat ?? 0}ج`
                              : `P ${it.protein ?? 0}g · C ${
                                  it.carbs ?? 0
                                }g · F ${it.fat ?? 0}g`}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: C.sub, fontSize: 12 }}>
                            {it.kcal} {ar ? "سعرة" : "kcal"}
                          </span>
                          <button
                            onClick={() => removeItem(m.id, idx)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <X size={13} color={C.sub2} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

function FoodPickerScreen({ data, setData, back, mealId, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);
  const today = dateKey(0);

  const results = FOOD_DB.filter((f) => foodMatches(f, query));
  const mealDef = MEAL_ITEMS.find((m) => m.id === mealId);
  const mealName = ar ? mealDef?.nameAr || "وجبة" : mealDef?.name || "Meal";
  const scale = selected ? Number(grams || 0) / 100 : 0;
  const kcalPreview = selected ? Math.round(selected.kcal * scale) : 0;
  const proteinPreview = selected ? Math.round(selected.protein * scale) : 0;
  const carbsPreview = selected ? Math.round(selected.carbs * scale) : 0;
  const fatPreview = selected ? Math.round(selected.fat * scale) : 0;

  const addItem = () => {
    if (!selected || !grams || grams <= 0) {
      showToast(ar ? "اكتب كمية صحيحة" : "Enter a valid amount");
      return;
    }
    const next = clone(data);
    if (!next.meals[today]) next.meals[today] = {};
    if (!next.meals[today][mealId]) next.meals[today][mealId] = { items: [] };
    if (!next.meals[today][mealId].items) next.meals[today][mealId].items = [];
    const foodName = ar ? selected.nameAr || selected.name : selected.name;
    next.meals[today][mealId].items.push({
      name: foodName,
      grams: Number(grams),
      kcal: kcalPreview,
      protein: proteinPreview,
      carbs: carbsPreview,
      fat: fatPreview,
    });
    setData(next);
    showToast(
      ar
        ? `تمت إضافة ${foodName} لـ${mealName}`
        : `${selected.name} added to ${mealName}`,
    );
    setSelected(null);
    setGrams(100);
    setQuery("");
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ paddingBottom: selected ? 200 : 0 }}>
      <TopBar
        title={ar ? `إضافة لـ${mealName}` : `Add to ${mealName}`}
        onBack={back}
      />
      <div style={{ padding: "0 18px" }}>
        <TextField
          icon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            ar
              ? "دور على أكلة (زي رز، فراخ، بطاطس)"
              : "Search foods (e.g. rice, chicken, potato)"
          }
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: 20,
          }}
        >
          {results.map((f) => (
            <Card
              key={f.id}
              onClick={() => {
                setSelected(f);
                setGrams(100);
              }}
              style={{
                padding: "12px 14px",
                border:
                  selected?.id === f.id
                    ? `1.5px solid ${C.green}`
                    : `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}
                >
                  {ar ? f.nameAr || f.name : f.name}
                </span>
                <span style={{ color: C.sub, fontSize: 12 }}>
                  {ar ? `${f.kcal} سعرة/100ج` : `${f.kcal} kcal/100g`}
                </span>
              </div>
              <div style={{ color: C.sub2, fontSize: 11, marginTop: 4 }}>
                {ar
                  ? `بروتين ${f.protein}ج · كارب ${f.carbs}ج · دهون ${f.fat}ج`
                  : `P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g`}
              </div>
            </Card>
          ))}
          {results.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: C.sub,
                fontSize: 13,
                padding: 20,
              }}
            >
              {ar
                ? `مفيش أكل بالاسم ده "${query}"`
                : `No foods match "${query}"`}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 430,
            background: C.card,
            borderTop: `1px solid ${C.border}`,
            padding: "14px 18px calc(14px + env(safe-area-inset-bottom))",
            zIndex: 100,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
              {ar ? selected.nameAr || selected.name : selected.name}
            </span>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={16} color={C.sub2} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: C.card2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                <input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: C.text,
                    fontSize: 14,
                  }}
                />
                <span style={{ color: C.sub, fontSize: 12.5 }}>
                  {ar ? "جرام" : "grams"}
                </span>
              </div>
            </div>
            <div
              style={{
                color: C.green,
                fontWeight: 800,
                fontSize: 15,
                minWidth: 76,
                textAlign: ar ? "left" : "right",
              }}
            >
              {kcalPreview} {ar ? "سعرة" : "kcal"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
              justifyContent: "flex-end",
              color: C.sub,
              fontSize: 11.5,
            }}
          >
            {ar ? (
              <>
                <span>بروتين {proteinPreview}ج</span>
                <span>كارب {carbsPreview}ج</span>
                <span>دهون {fatPreview}ج</span>
              </>
            ) : (
              <>
                <span>Protein {proteinPreview}g</span>
                <span>Carbs {carbsPreview}g</span>
                <span>Fat {fatPreview}g</span>
              </>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <GreenButton onClick={addItem}>
              {ar ? "إضافة للوجبة" : "Add to Meal"}
            </GreenButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== PLANS SCREEN ============================== */
function PlansScreen({ data, setData, go, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const pro = data.entitlements.trainingPro;
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "الخطط" : "Plans"} />
      <div style={{ padding: "0 18px 4px", color: C.sub, fontSize: 12.5 }}>
        {ar
          ? "الخطة الأساسية مجانية للأبد. الخطط المخصصة محتاجة Training Pro."
          : "The Standard Plan is free forever. Personalized plans need Training Pro."}
      </div>
      <div
        style={{
          padding: "10px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {Object.values(PLAN_TEMPLATES).map((p) => {
          const isActive = data.activePlanId === p.id;
          const locked = p.pro && !pro;
          return (
            <Card
              key={p.id}
              onClick={() =>
                locked ? go("paywall") : go("planDetail", { planId: p.id })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: isActive
                  ? `1.5px solid ${C.green}`
                  : `1px solid ${C.border}`,
                opacity: locked ? 0.9 : 1,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: C.card2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 21,
                }}
              >
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 700,
                    fontSize: 14.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {ar ? p.nameAr : p.name} {p.pro && <ProBadge small />}
                </div>
                <div style={{ color: C.sub, fontSize: 12 }}>
                  {ar ? p.taglineAr : p.tagline}
                </div>
                {isActive && (
                  <div
                    style={{
                      color: C.green,
                      fontSize: 11,
                      fontWeight: 700,
                      marginTop: 3,
                    }}
                  >
                    ✓ {ar ? "الخطة النشطة" : "Active Plan"}
                  </div>
                )}
              </div>
              {locked ? (
                <Crown size={16} color={C.gold} />
              ) : (
                <ChevronRight
                  size={18}
                  color={C.sub2}
                  style={{ transform: ar ? "scaleX(-1)" : "none" }}
                />
              )}
            </Card>
          );
        })}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

function PlanDetailScreen({ data, setData, back, planId, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [day, setDay] = useState(DAYS[todayIdx]);
  const plan = PLAN_TEMPLATES[planId];
  const isActive = data.activePlanId === planId;
  const daySchedule = plan.schedule[day];
  // Free accounts preview the same four exercises they can actually train.
  const trainingPro = data.entitlements.trainingPro;
  const visibleExercises = trainingPro
    ? daySchedule.exercises
    : daySchedule.exercises.slice(0, FREE_EXERCISE_CAP);
  const lockedCount = daySchedule.exercises.length - visibleExercises.length;

  const use = () => {
    const next = clone(data);
    next.activePlanId = planId;
    setData(next);
    showToast(
      ar
        ? `${plan.nameAr} بقت خطتك النشطة`
        : `${plan.name} is now your active plan`,
    );
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? plan.nameAr : plan.name} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: C.card2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 21,
            }}
          >
            {plan.icon}
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
              {ar ? plan.nameAr : plan.name}
            </div>
            <div style={{ color: C.sub, fontSize: 12 }}>
              {ar ? plan.taglineAr : plan.tagline}
            </div>
          </div>
        </Card>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 12,
          }}
        >
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              style={{
                minWidth: 46,
                padding: "8px 0",
                borderRadius: 10,
                cursor: "pointer",
                border: "none",
                background: day === d ? C.green : C.card2,
                color: day === d ? C.onAccent : C.sub,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {ar ? DAY_LABELS_AR[d] : d}
            </button>
          ))}
        </div>
        <div
          style={{
            color: C.text,
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 10,
          }}
        >
          {ar ? daySchedule.titleAr : daySchedule.title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {daySchedule.exercises.length === 0 && (
            <Card style={{ textAlign: "center", padding: 20, color: C.sub }}>
              {ar ? "يوم راحة" : "Rest day"}
            </Card>
          )}
          {visibleExercises.map((ex, i) => (
            <Card
              key={ex.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: C.card2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.sub,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  flex: 1,
                  color: C.text,
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                {ar ? ex.nameAr || ex.name : ex.name}
              </div>
              <div style={{ color: C.sub, fontSize: 12 }}>
                {ex.targetSets} × {ex.targetReps}
              </div>
            </Card>
          ))}
          {lockedCount > 0 && (
            <Card style={{ textAlign: "center", padding: 14, color: C.sub }}>
              {ar
                ? `${lockedCount} تمرين إضافي مع Training Pro`
                : `${lockedCount} more exercise${
                    lockedCount > 1 ? "s" : ""
                  } with Training Pro`}
            </Card>
          )}
        </div>
        <div style={{ margin: "18px 0 20px" }}>
          <GreenButton onClick={use} disabled={isActive}>
            {isActive
              ? ar
                ? "دي خطتك النشطة"
                : "This Is Your Active Plan"
              : ar
              ? "استخدم الخطة دي"
              : "Use This Plan"}
          </GreenButton>
        </div>
      </div>
    </div>
  );
}

/* ============================== PAYWALL ============================== */
function PaywallScreen({ data, setData, back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [selectedPlan, setSelectedPlan] = useState("both");
  const [selectedDuration, setSelectedDuration] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const planIds = ["training", "nutrition", "both"];
  const plan = PAYWALL_PLANS[selectedPlan];
  const duration = DURATIONS.find((d) => d.id === selectedDuration);
  const months = duration?.months || 1;
  const price = plan?.prices?.[selectedDuration] || 0;
  const currency = ar ? "جنيه" : "EGP";
  const durationLabel = ar ? duration?.label : duration?.labelEn;
  const selectedPlanActive =
    selectedPlan === "training"
      ? data.entitlements.trainingPro
      : selectedPlan === "nutrition"
      ? data.entitlements.nutritionPro
      : data.entitlements.trainingPro && data.entitlements.nutritionPro;

  // Apply the unlocked entitlement(s) to the data and persist.
  const unlockPlans = (next, planId) => {
    if (planId === "nutrition" || planId === "both")
      next.entitlements.nutritionPro = true;
    if (planId === "training" || planId === "both")
      next.entitlements.trainingPro = true;
  };

  const purchase = async (planId, durationId) => {
    setBusy(true);
    try {
      // 1) Try real Google Play Billing.
      //    - On Android, this returns { success: true } only after the user
      //      completes a real purchase.
      //    - In web preview / dev the plugin is missing, so `preview` is true
      //      and we allow a simulated unlock so the flow can be tested.
      const result = await billingPurchase(planId, durationId).catch(() => ({
        success: false,
        preview: true,
      }));

      // Only unlock after the native bridge returns an acknowledged purchase.
      const shouldUnlock = result?.success === true && result?.verified === true;
      if (!shouldUnlock) {
        showToast(
          ar
            ? "لم يتم إتمام عملية الشراء — حاول تاني"
            : "Purchase was not completed — please try again",
        );
        return;
      }

      // 2) Unlock entitlements locally (and persist via setData).
      const next = clone(data);
      unlockPlans(next, planId);
      next.entitlements.proExpiresAt = null;
      if (next.entitlements.trainingPro) {
        const personalizedPlan = buildPersonalizedProPlan(next);
        next.proPlan = personalizedPlan;
        next.activePlanId = personalizedPlan.workoutPlanId;
      }
      if (next.entitlements.nutritionPro) {
        const personalizedPlan = buildPersonalizedProPlan(next);
        next.nutritionPlan = {
          ...(next.nutritionPlan || {}),
          unread: true,
          generatedAt: dateKey(0),
          title: ar ? "خطة برو غذائية جاهزة" : "Pro nutrition plan is ready",
          titleAr: ar ? "خطة برو غذائية جاهزة" : "Pro nutrition plan is ready",
          summary: ar
            ? `خطة مبنية على هدفك (${personalizedPlan.nutritionFocus})`
            : `Plan tailored to your goal (${personalizedPlan.nutritionFocus})`,
        };
      }
      await setData(next);

      // 3) Show a clear confirmation message on success.
      //    For the Nutrition plan (or "both"), include the WhatsApp note.
      const isNutrition = planId === "nutrition" || planId === "both";
      if (isNutrition) {
        showToast(
          ar
            ? "تم تفعيل اشتراكك بنجاح. هنتواصل معاك على واتساب خلال 12 ساعة عشان نبعتلك خطتك الغذائية المخصصة."
            : "Your subscription was activated successfully. We will contact you via WhatsApp within 12 hours to send you your personalized nutrition plan.",
          7000,
        );
      } else {
        showToast(
          ar
            ? "تم تفعيل اشتراكك بنجاح! خطة التدريب المخصصة جاهزة."
            : "Your subscription was activated successfully! Your personalized training plan is ready.",
          4000,
        );
      }

      // 4) Trigger in-app review after a successful unlock.
      maybeRequestReview("purchase").catch(() => {});

      back();
    } catch (e) {
      showToast(
        ar
          ? "حصل خطأ في عملية الشراء — حاول تاني"
          : "Purchase failed — please try again",
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const res = await billingRestore().catch(() => ({
        restoredPlans: [],
        preview: true,
      }));
      const restored = res?.restoredPlans || [];
      if (res?.unsupported) {
        showToast(
          ar
            ? "استرجاع الاشتراك غير مدعوم في إصدار الفوترة الحالي"
            : "Subscription restore is unavailable in this billing build",
        );
        return;
      }
      if (restored.length === 0 && !res?.preview) {
        showToast(
          ar
            ? "مفيش اشتراكات سابقة نستردّها"
            : "No previous subscriptions to restore",
        );
        return;
      }
      // Grant the restored entitlements locally.
      const next = clone(data);
      restored.forEach((p) => unlockPlans(next, p));
      if (restored.length > 0) {
        next.entitlements.proExpiresAt = null;
        if (next.entitlements.trainingPro) {
          const personalizedPlan = buildPersonalizedProPlan(next);
          next.proPlan = personalizedPlan;
          next.activePlanId = personalizedPlan.workoutPlanId;
        }
        await setData(next);
        showToast(
          ar
            ? "تم استرجاع اشتراكك بنجاح!"
            : "Your subscription was restored successfully!",
        );
      } else if (res?.preview) {
        showToast(
          ar
            ? "الفوترة غير متاحة خارج تطبيق Android"
            : "Billing is unavailable outside the Android app",
        );
      }
    } catch (e) {
      showToast(
        ar
          ? "فشل استرجاع الاشتراكات — حاول تاني"
          : "Restore failed — please try again",
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title="Fifty Fit Pro" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Crown size={30} color={C.gold} />
          <div
            style={{
              color: C.text,
              fontSize: 18,
              fontWeight: 800,
              marginTop: 8,
            }}
          >
            {ar ? "استفد أكتر من Fifty Fit" : "Get more out of Fifty Fit"}
          </div>
          <div style={{ color: C.sub, fontSize: 12.5, marginTop: 4 }}>
            {ar
              ? "اختر خطتك ومدتها — تقدر تلغي في أي وقت"
              : "Choose your plan & duration — cancel anytime"}
          </div>
        </div>

        {/* Plan selector */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.card2,
            padding: 4,
            borderRadius: 12,
            marginBottom: 14,
          }}
        >
          {planIds.map((id) => {
            const p = PAYWALL_PLANS[id];
            return (
              <Pill
                key={id}
                active={selectedPlan === id}
                onClick={() => setSelectedPlan(id)}
              >
                {ar ? p.titleAr : p.title}
              </Pill>
            );
          })}
        </div>

        {/* Duration selector */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.card2,
            padding: 4,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDuration(d.id)}
              style={{
                flex: 1,
                padding: "9px 0",
                clipPath: chamfer(8),
                border: "none",
                cursor: "pointer",
                background: selectedDuration === d.id ? C.green : "transparent",
                color: selectedDuration === d.id ? C.onAccent : C.sub,
                fontWeight: 800,
                fontSize: 11.5,
                textTransform: "uppercase",
                letterSpacing: 0.2,
              }}
            >
              {ar ? d.label : d.labelEn}
            </button>
          ))}
        </div>

        {/* Selected plan card. The badge lives outside the Card because the
            Card's clip-path would crop anything overflowing its top edge. */}
        <div
          style={{
            position: "relative",
            paddingTop: plan?.best === true ? 16 : 0,
          }}
        >
          {plan?.best === true && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(90deg, #f59e0b, #fde68a)",
                color: "#1a1200",
                fontSize: 10.5,
                fontWeight: 800,
                lineHeight: 1.6,
                padding: "5px 14px",
                borderRadius: 999,
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.22)",
                whiteSpace: "nowrap",
                maxWidth: "92%",
                overflow: "visible",
                zIndex: 3,
              }}
            >
              {ar ? "أفضل قيمة 🏆" : "BEST VALUE 🏆"}
            </div>
          )}
          <Card
            style={{
              border:
                plan?.best === true
                  ? `1.5px solid ${C.gold}`
                  : `1px solid ${C.border}`,
              position: "relative",
              paddingTop: plan?.best === true ? 24 : 16,
            }}
          >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>
              {ar ? plan.titleAr : plan.title}
            </span>
            {selectedPlanActive ? (
              <span style={{ color: C.green, fontWeight: 800, fontSize: 13 }}>
                {ar ? "الاشتراك نشط" : "Subscription Active"}
              </span>
            ) : (
              <span
                style={{
                  color: C.green,
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {price} {currency}
                <span style={{ color: C.sub, fontSize: 11, fontWeight: 500 }}>
                  {" "}
                  / {durationLabel}
                </span>
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {(ar ? plan.featuresAr : plan.featuresEn).map((f) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <Check
                  size={14}
                  color={C.green}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.4 }}>
                  {f}
                </span>
              </div>
            ))}
          </div>
          <GreenButton
            onClick={() => purchase(selectedPlan, selectedDuration)}
            variant={plan?.best === true ? "solid" : "outline"}
            disabled={busy}
          >
            {busy
              ? ar
                ? "جاري الشراء…"
                : "Processing…"
              : ar
              ? `اشترك الآن — ${price} ${currency}`
              : `Subscribe now — ${price} ${currency}`}
          </GreenButton>
          </Card>
        </div>

        <div
          style={{
            textAlign: "center",
            color: C.sub2,
            fontSize: 11,
            margin: "16px 0 20px",
            lineHeight: 1.6,
          }}
        >
          {ar
            ? "الدفع يتم بشكل آمن عبر Google Play Billing. الاشتراك بيتجدد تلقائيًا وبتقدر تلغيه في أي وقت."
            : "Payments are processed securely via Google Play Billing. Subscriptions auto-renew and can be cancelled anytime."}
        </div>
        {(data.entitlements.trainingPro ||
          data.entitlements.nutritionPro ||
          data.entitlements.aiCoachPro) && (
          <div style={{ textAlign: "center", margin: "28px 0 4px" }}>
            <button
              onClick={() =>
                window.open(
                  "https://play.google.com/store/account/subscriptions?package=com.fittrack.app",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              style={{
                border: "none",
                background: "transparent",
                color: C.sub2,
                fontSize: 11,
                fontWeight: 500,
                textDecoration: "none",
                cursor: "pointer",
                padding: 0,
                opacity: 0.85,
              }}
            >
              {ar ? "إلغاء الاشتراك" : "Cancel subscription"}
            </button>
          </div>
        )}
        {(data.entitlements.trainingPro ||
          data.entitlements.nutritionPro ||
          data.entitlements.aiCoachPro) && (
          <div style={{ textAlign: "center", margin: "10px 0 24px" }}>
            <button
              onClick={restore}
              disabled={restoring}
              style={{
                border: "none",
                background: "transparent",
                color: C.sub2,
                fontSize: 11,
                fontWeight: 500,
                textDecoration: "none",
                cursor: restoring ? "wait" : "pointer",
                padding: 0,
                opacity: 0.85,
              }}
            >
              {restoring
                ? ar
                  ? "جاري الاسترجاع…"
                  : "Restoring…"
                : ar
                ? "استرجاع الاشتراك"
                : "Restore purchases"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================== AI COACH ============================== */
// Messages stay in component state only (cleared when the screen unmounts
// or the app session ends). Only a daily {date,count} counter is persisted.
function AICoachDrawer({ open, onClose, data, setData, showToast, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const today = dateKey(0);
  const usage = aiUsageToday(data, today);
  const [messages, setMessages] = useState([]); // session-only — cleared when drawer closes
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef(null);
  const inputBarRef = useRef(null);

  // Fresh conversation every time the drawer opens.
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
      setBusy(false);
      setKeyboardInset(0);
    }
  }, [open]);

  // Keep the composer above the Android/iOS keyboard without fixed px hacks.
  // visualViewport reports the visible area; the covered bottom is the keyboard.
  // Listeners are always removed on close/unmount to avoid leaks.
  useEffect(() => {
    if (!open) {
      setKeyboardInset(0);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    const vv = window.visualViewport;

    const update = () => {
      try {
        if (!vv) {
          setKeyboardInset(0);
          return;
        }
        // Prefer visualViewport math (works with Cap 7 edge-to-edge).
        const covered = Math.max(
          0,
          Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)),
        );
        setKeyboardInset(covered > 40 ? covered : 0);
      } catch (_) {
        setKeyboardInset(0);
      }
    };

    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    // focusin helps when IME opens before viewport settles
    window.addEventListener("focusin", update);
    update();
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("focusin", update);
    };
  }, [open]);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy, keyboardInset]);

  if (!open) return null;

  const toastForError = (e) => {
    const code = e?.code || "";
    if (code === "daily_limit") {
      return usage.hasPro || data.entitlements?.aiCoachPro
        ? ar
          ? "وصلت للحد اليومي (50 رسالة). حاول تاني بكرة."
          : "Daily limit reached (50 messages). Try again tomorrow."
        : ar
          ? "لقد استخدمت رسائلك المجانية الثلاث لهذا اليوم. يمكنك العودة غدًا أو الترقية إلى AI Coach Pro."
          : "You've used your 3 free AI messages for today. Come back tomorrow or upgrade to AI Coach Pro.";
    }
    if (code === "unauthenticated") {
      return ar
        ? "جلسة الدخول انتهت. سجل دخولك مرة تانية."
        : "Your session expired. Please sign in again.";
    }
    if (code === "forbidden") {
      return ar
        ? "مش مسموح بالوصول للمدرب الذكي."
        : "Access to AI Coach is not allowed.";
    }
    if (code === "quota") {
      return ar
        ? "المدرب الذكي وصل للحد المتاح حاليًا. حاول لاحقًا."
        : "AI Coach has reached its current quota. Please try later.";
    }
    if (code === "rate_limit") {
      return ar
        ? "المدرب الذكي مشغول حاليًا. حاول بعد شوية."
        : "AI Coach is busy right now. Try again shortly.";
    }
    if (code === "network") {
      return ar
        ? "تعذر الاتصال بالمدرب الذكي. تأكد من الإنترنت وحاول مرة تانية."
        : "Could not reach AI Coach. Check your internet and try again.";
    }
    if (code === "no_endpoint") {
      return ar
        ? "خدمة الذكاء الاصطناعي مش مفعّلة لسه"
        : "AI service is not configured yet";
    }
    // 500 / backend / empty / bad_request
    return ar
      ? "حصلت مشكلة في المدرب الذكي. حاول مرة تانية."
      : "Something went wrong with AI Coach. Please try again.";
  };

  const send = async () => {
    const textMsg = input.trim();
    if (!textMsg || busy) return;
    if (usage.remaining <= 0) {
      showToast(toastForError({ code: "daily_limit" }));
      return;
    }
    setInput("");
    const nextMsgs = [...messages, { role: "user", content: textMsg }];
    setMessages(nextMsgs);
    setBusy(true);
    try {
      const result = await generateCoachReply({
        messages: nextMsgs,
        lang,
        localDate: today,
        hasAiPro: !!data.entitlements?.aiCoachPro,
        userContext: {
          age: data.account?.age,
          gender: data.account?.gender,
          height: data.account?.height,
          weight:
            data.bodyWeight?.slice(-1)?.[0]?.weight || data.account?.weight,
          goal: data.account?.goal,
          plan: data.activePlanId,
        },
      });
      const reply = typeof result === "string" ? result : result?.reply || "";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (result?.usage) {
        const next = clone(data);
        next.aiUsage = {
          date: result.usage.date || today,
          count: result.usage.count ?? result.usage.used ?? 0,
        };
        setData(next);
      }
    } catch (e) {
      if (e?.code === "daily_limit" && e.usage) {
        const next = clone(data);
        next.aiUsage = {
          date: e.usage.date || today,
          count: e.usage.count ?? e.usage.used ?? 0,
        };
        setData(next);
      } else {
        // Roll back optimistic user bubble for non-limit failures
        setMessages((m) => m.slice(0, -1));
      }
      showToast(toastForError(e));
    } finally {
      setBusy(false);
    }
  };

  // Arabic: panel from right (start in RTL). English: from right edge still (LTR end).
  // Use physical right for LTR and physical left for RTL so it feels "side attached".
  const fromStart = ar; // RTL → slide from left in physical terms if we use insetInlineStart
  const panelSide = ar
    ? { left: 0, borderRight: `1px solid ${C.border}` }
    : { right: 0, borderLeft: `1px solid ${C.border}` };
  const showUpgrade = usage.remaining <= 0 && !usage.hasPro;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />
      {/* Side panel */}
      <div
        dir={ar ? "rtl" : "ltr"}
        style={{
          position: "absolute",
          top: 0,
          // Lift entire drawer above the soft keyboard (dynamic inset).
          bottom: keyboardInset,
          width: "min(360px, 92vw)",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 40px rgba(0,0,0,0.35)",
          transition: "bottom 0.12s ease-out",
          ...panelSide,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px 10px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Sparkles size={18} color={C.green} />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>
              {ar ? "مدرب AI" : "AI Coach"}
            </div>
            <div style={{ color: C.sub, fontSize: 11 }}>
              {ar
                ? usage.remaining === 0
                  ? "لا رسائل متبقية اليوم"
                  : usage.remaining === 1
                    ? "متبقي رسالة واحدة اليوم"
                    : usage.remaining === 2
                      ? "متبقي رسالتان اليوم"
                      : `متبقي ${usage.remaining} رسائل اليوم`
                : usage.remaining === 1
                  ? "1 AI message remaining today"
                  : `${usage.remaining} AI messages remaining today`}
              {usage.hasPro ? (ar ? " · Pro" : " · Pro") : ar ? " · مجاني" : " · Free"}
            </div>
          </div>
          <IconBtn onClick={onClose}>
            <X size={16} color={C.sub} />
          </IconBtn>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && !showUpgrade && (
            <div style={{ color: C.sub, fontSize: 13, textAlign: "center", marginTop: 24 }}>
              {ar
                ? "اسأل عن التمارين، التغذية، أو تقدمك — بالعربية أو الإنجليزية"
                : "Ask about workouts, nutrition, or progress — Arabic or English"}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                background: m.role === "user" ? C.green : C.card2,
                color: m.role === "user" ? "#04140a" : C.text,
                padding: "10px 12px",
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div style={{ color: C.sub, fontSize: 12 }}>{ar ? "بيفكر..." : "Thinking..."}</div>
          )}

          {showUpgrade && (
            <div
              style={{
                marginTop: 8,
                padding: 14,
                borderRadius: 14,
                background: C.card,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                {ar ? "وصلت للحد المجاني اليوم" : "You've hit today's free limit"}
              </div>
              <div style={{ color: C.sub, fontSize: 12.5, marginBottom: 12 }}>
                {ar
                  ? "اشترك في AI Coach Pro للحصول على حتى 50 رسالة يوميًا."
                  : "Subscribe to AI Coach Pro for up to 50 messages per day."}
              </div>
              {(() => {
                const region =
                  (data.settings?.region || data.account?.region || "").toLowerCase() === "eg" ||
                  lang === "ar"
                    ? "eg"
                    : "intl";
                const prices = AI_COACH_PRICES[region] || AI_COACH_PRICES.intl;
                const rows = [
                  { id: "monthly", label: ar ? "شهر" : "1 month", v: prices.monthly },
                  { id: "quarterly", label: ar ? "3 شهور" : "3 months", v: prices.quarterly },
                  { id: "halfyearly", label: ar ? "6 شهور" : "6 months", v: prices.halfyearly },
                  { id: "yearly", label: ar ? "سنة" : "1 year", v: prices.yearly },
                ];
                const cur = prices.currencyLabelAr && ar ? prices.currencyLabelAr : prices.currency;
                return rows.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderTop: `1px solid ${C.border}`,
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <span>{r.label}</span>
                    <span style={{ fontWeight: 700 }}>
                      {r.v} {cur}
                    </span>
                  </div>
                ));
              })()}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  go("paywall", { focus: "ai" });
                }}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: C.green,
                  color: "#04140a",
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                {ar ? "ترقية AI Coach Pro" : "Upgrade AI Coach Pro"}
              </button>
              <div style={{ color: C.sub2, fontSize: 10.5, marginTop: 8, textAlign: "center" }}>
                {ar
                  ? "الشراء يتم عبر Google Play — السعر النهائي من المتجر"
                  : "Purchases via Google Play — store price is final"}
              </div>
            </div>
          )}
        </div>

        <div
          ref={inputBarRef}
          style={{
            display: "flex",
            gap: 8,
            // Panel bottom already accounts for keyboardInset; keep safe-area only.
            padding: "10px 12px calc(12px + env(safe-area-inset-bottom))",
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            flexShrink: 0,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={ar ? "اكتب سؤالك..." : "Ask anything..."}
            disabled={busy || usage.remaining <= 0}
            style={{
              flex: 1,
              background: C.card2,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "10px 12px",
              color: C.text,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !input.trim() || usage.remaining <= 0}
            style={{
              background: C.green,
              color: "#04140a",
              border: "none",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              opacity: busy || !input.trim() || usage.remaining <= 0 ? 0.5 : 1,
            }}
          >
            {ar ? "إرسال" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AICoachSideTab({ onOpen, ar, C }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ar ? "مدرب AI" : "AI Coach"}
      style={{
        position: "fixed",
        top: "42%",
        zIndex: 900,
        writingMode: "vertical-rl",
        transform: ar ? "rotate(180deg)" : "none",
        ...(ar ? { left: 0 } : { right: 0 }),
        background: C.card2,
        color: C.green,
        border: `1px solid ${C.border}`,
        borderRadius: ar ? "0 12px 12px 0" : "12px 0 0 12px",
        padding: "12px 7px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.4,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Sparkles size={13} />
      {ar ? "AI" : "AI"}
    </button>
  );
}

/* ============================== PROFILE SCREEN ============================== */


function ProfileScreen({ data, go, isAdmin }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const p = data.profile;
  const pct = Math.round((p.xp / p.xpMax) * 100);
  const pro = data.entitlements.trainingPro || data.entitlements.nutritionPro;
  const menu = [
    {
      icon: UserCircle,
      label: ar ? "المعلومات الشخصية" : "Personal Information",
      to: "personalInfo",
    },
    { icon: Target, label: ar ? "الأهداف" : "Goals", to: "goals" },
    {
      icon: Ruler,
      label: ar ? "قياساتي" : "My Measurements",
      to: "measurements",
    },
    { icon: Bell, label: ar ? "التذكيرات" : "Reminders", to: "reminders" },
    {
      icon: SettingsIcon,
      label: ar ? "الإعدادات" : "Settings",
      to: "settings",
    },
    {
      icon: Sparkles,
      label: ar ? "مدرب AI" : "AI Coach",
      to: "aiCoach",
    },
    {
      icon: HelpCircle,
      label: ar ? "المساعدة والدعم" : "Help & Support",
      to: "help",
    },
    ...(isAdmin
      ? [{ icon: Shield, label: ar ? "الأدمن" : "Admin", to: "admin" }]
      : []),
  ];
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar
        title={ar ? "حسابي" : "Profile"}
        right={
          <IconBtn onClick={() => go("settings")}>
            <SettingsIcon size={16} color={C.sub} />
          </IconBtn>
        }
      />
      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Avatar photo={data.account.photo} size={92} />
        <div
          style={{
            color: C.text,
            fontSize: 19,
            fontWeight: 800,
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {data.account.name || (ar ? "رياضي" : "Athlete")}{" "}
          {pro && <ProBadge small />}
        </div>
        <div style={{ color: C.sub, fontSize: 12.5 }}>{data.account.email}</div>
        <div style={{ width: "100%", marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: C.text, fontWeight: 700 }}>
              {ar ? `مستوى ${p.level}` : `Level ${p.level}`}
            </span>
            <span style={{ color: C.sub }}>
              {ar ? `${p.xp} / ${p.xpMax} نقطة` : `${p.xp} / ${p.xpMax} XP`}
            </span>
          </div>
          <div
            style={{
              height: 8,
              background: C.card2,
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: C.green,
                borderRadius: 5,
              }}
            />
          </div>
        </div>
      </div>

      {pro ? (
        <div style={{ padding: "16px 18px 0" }}>
          <Card
            onClick={() => go("paywall")}
            style={{
              background: C.greenSoft,
              border: `1px solid ${C.green}55`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
                {ar ? "Pro مفعّل" : "Pro is active"}
              </div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar
                  ? `باقي ${daysUntil(
                      data.entitlements.proExpiresAt,
                    )} يوم الشهر ده`
                  : `${daysUntil(
                      data.entitlements.proExpiresAt,
                    )} days left this month`}
              </div>
            </div>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        </div>
      ) : (
        <div style={{ padding: "16px 18px 0" }}>
          <Card
            onClick={() => go("paywall")}
            style={{
              background: C.goldSoft,
              border: `1px solid ${C.gold}55`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
                {ar ? "اشترك في Pro" : "Upgrade to Pro"}
              </div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar
                  ? "افتح خطط مخصصة وتتبع أكل كامل"
                  : "Unlock personalized plans & full food tracking"}
              </div>
            </div>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        </div>
      )}

      <div
        style={{
          padding: "16px 18px 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {menu.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.label}
              onClick={() => {
                if (m.to === "__ai_drawer__") {
                  window.dispatchEvent(new CustomEvent("fiftyfit-open-ai"));
                  return;
                }
                go(m.to);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
              }}
            >
              <Icon size={18} color={C.sub} />
              <span
                style={{
                  flex: 1,
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {m.label}
              </span>
              <ChevronRight
                size={16}
                color={C.sub2}
                style={{ transform: ar ? "scaleX(-1)" : "none" }}
              />
            </Card>
          );
        })}
        <Card
          onClick={() => go("logout")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "13px 16px",
          }}
        >
          <LogOut size={18} color={C.danger} />
          <span
            style={{ flex: 1, color: C.danger, fontSize: 14, fontWeight: 600 }}
          >
            {ar ? "تسجيل الخروج" : "Logout"}
          </span>
        </Card>
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ============================== PERSONAL INFO / GOALS / MEASUREMENTS ============================== */
function PersonalInfoScreen({ data, setData, back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [name, setName] = useState(data.account.name);
  const [gender, setGender] = useState(data.account.gender);
  const [age, setAge] = useState(data.account.age);
  const [height, setHeight] = useState(data.account.height);
  const [photo, setPhoto] = useState(data.account.photo);
  const fileRef = useRef(null);

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(ar ? "اختار ملف صورة" : "Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.onerror = () =>
      showToast(ar ? "الصورة دي معرفتش أفتحها" : "Couldn't load that photo");
    reader.readAsDataURL(file);
  };

  const save = () => {
    const next = clone(data);
    next.account = {
      ...next.account,
      name,
      gender,
      age: Number(age),
      height: Number(height),
      photo,
    };
    setData(next);
    showToast(ar ? "تم تحديث البروفايل" : "Profile updated");
    back();
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar
        title={ar ? "المعلومات الشخصية" : "Personal Information"}
        onBack={back}
      />
      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}
        >
          <div style={{ position: "relative" }}>
            <Avatar photo={photo} size={84} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                position: "absolute",
                bottom: -2,
                [ar ? "left" : "right"]: -2,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: C.green,
                border: `2px solid ${C.card}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Camera size={14} color={C.onAccent} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              style={{ display: "none" }}
            />
          </div>
        </div>
        <div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>
            {ar ? "الاسم" : "Name"}
          </div>
          <TextField
            icon={User}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ar ? "الاسم بالكامل" : "Full name"}
          />
        </div>
        <div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>
            {ar ? "النوع" : "Gender"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { id: "Male", label: ar ? "ذكر" : "Male" },
              { id: "Female", label: ar ? "أنثى" : "Female" },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGender(g.id)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  cursor: "pointer",
                  border: `1.5px solid ${gender === g.id ? C.green : C.border}`,
                  background: gender === g.id ? C.greenSoft : C.card,
                  color: C.text,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>
            {ar ? "السن" : "Age"}
          </div>
          <TextField
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder={ar ? "السن" : "Age"}
          />
        </div>
        <div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>
            {ar ? "الطول (سم)" : "Height (cm)"}
          </div>
          <TextField
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={ar ? "الطول" : "Height"}
          />
        </div>
        <div style={{ marginTop: 6, marginBottom: 20 }}>
          <GreenButton onClick={save}>
            {ar ? "حفظ التغييرات" : "Save Changes"}
          </GreenButton>
        </div>
      </div>
    </div>
  );
}

function GoalsScreen({ data, setData, back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [goal, setGoal] = useState(data.account.goal);
  const pro = data.entitlements.trainingPro;
  const save = () => {
    const chosen = GOALS.find((g) => g.id === goal);
    const next = clone(data);
    next.account.goal = goal;
    if (pro && chosen) next.activePlanId = chosen.planId;
    setData(next);
    showToast(
      pro
        ? ar
          ? "اتحدّث الهدف والخطة"
          : "Goal & plan updated"
        : ar
        ? "اتحفظ الهدف — افتح Training Pro لخطة مبنية عليه"
        : "Goal saved — unlock Training Pro for a plan built around it",
    );
    back();
  };
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "الأهداف" : "Goals"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GOALS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px",
                borderRadius: 15,
                cursor: "pointer",
                border: `1.5px solid ${goal === g.id ? C.green : C.border}`,
                background: goal === g.id ? C.greenSoft : C.card,
                textAlign: ar ? "right" : "left",
              }}
            >
              <div style={{ fontSize: 24 }}>{g.icon}</div>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>
                  {ar ? g.labelAr : g.label}
                </div>
                <div style={{ color: C.sub, fontSize: 12 }}>
                  {ar ? g.descAr : g.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, marginBottom: 20 }}>
          <GreenButton onClick={save}>
            {ar ? "حفظ الهدف" : "Save Goal"}
          </GreenButton>
        </div>
      </div>
    </div>
  );
}

const BMI_CAT_AR = {
  Underweight: "نحافة",
  Normal: "طبيعي",
  Overweight: "زيادة وزن",
  Obese: "سمنة",
};

function MeasurementsScreen({ data, back, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const current = data.bodyWeight[data.bodyWeight.length - 1];
  const bmi = bmiInfo(current?.weight, data.account.height);
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "قياساتي" : "My Measurements"} onBack={back} />
      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Card style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: C.sub, fontSize: 13 }}>
            {ar ? "الطول" : "Height"}
          </span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
            {data.account.height || "—"} {ar ? "سم" : "cm"}
          </span>
        </Card>
        <Card style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: C.sub, fontSize: 13 }}>
            {ar ? "الوزن" : "Weight"}
          </span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
            {current?.weight ?? "—"} {ar ? "كجم" : "kg"}
          </span>
        </Card>
        {bmi && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ color: C.sub, fontSize: 13 }}>
                {ar ? "مؤشر كتلة الجسم" : "BMI"}
              </span>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
                {bmi.bmi}
              </span>
            </div>
            <div style={{ color: C.green, fontSize: 12.5, fontWeight: 600 }}>
              {ar ? BMI_CAT_AR[bmi.cat] || bmi.cat : bmi.cat}
            </div>
          </Card>
        )}
        <GreenButton variant="outline" onClick={() => go("bodyweight")}>
          {ar ? "تحديث الوزن" : "Update Weight"}
        </GreenButton>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== REMINDERS ============================== */
function RemindersScreen({ data, setData, back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [time, setTime] = useState(data.settings.reminderTime);
  const [on, setOn] = useState(data.settings.notifications);
  const [busy, setBusy] = useState(false);

  const requestPermission = async () => {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") {
        showToast(
          ar
            ? "تم رفض إذن الإشعارات — فعّله من إعدادات التطبيق في تليفونك"
            : "Notification permission was denied — enable it in your phone's app settings",
        );
        return false;
      }
      return true;
    } catch (e) {
      showToast(
        ar
          ? "الإشعارات مش متاحة هنا — محتاجة تطبيق أندرويد مثبت"
          : "Notifications aren't available here — this needs the installed Android app",
      );
      return false;
    }
  };

  const handleToggle = async () => {
    if (!on) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    setOn((s) => !s);
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          setBusy(false);
          return;
        }
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999,
            title: "Fifty Fit",
            body: ar
              ? "متنساش تمرين النهاردة! 💪"
              : "Don't forget today's workout! 💪",
            schedule: { at: new Date(Date.now() + 3000) },
          },
        ],
      });
      showToast(
        ar
          ? "الإشعار التجريبي هيظهر خلال ثواني"
          : "Test notification will appear in a few seconds",
      );
    } catch (e) {
      showToast(
        ar
          ? "معرفناش نجدول إشعار تجريبي — محتاج تطبيق أندرويد مثبت"
          : "Couldn't schedule a test notification — this needs the installed Android app",
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const next = clone(data);
    next.settings.reminderTime = time;
    next.settings.notifications = on;
    setData(next);
    try {
      if (on) await scheduleDailyReminder(time);
      else await cancelDailyReminder();
    } catch (e) {
      /* not running in the native app yet — settings still saved */
    }
    showToast(
      on
        ? ar
          ? `تم ضبط التذكير اليومي الساعة ${time}`
          : `Daily reminder set for ${time}`
        : ar
        ? "التذكيرات مقفولة"
        : "Reminders turned off",
    );
    back();
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "التذكيرات" : "Reminders"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
              {ar ? "تذكير التمرين اليومي" : "Daily Workout Reminder"}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
              {ar ? "يفكّرك تسجّل تمرينك" : "Get nudged to log your session"}
            </div>
          </div>
          <ToggleSwitch on={on} onClick={handleToggle} />
        </Card>
        {on && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>
              {ar ? "وقت التذكير" : "Reminder Time"}
            </div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                width: "100%",
                background: C.card2,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                color: C.text,
                padding: "10px 12px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <div style={{ marginTop: 10 }}>
              <GreenButton variant="outline" onClick={sendTest} disabled={busy}>
                {busy
                  ? ar
                    ? "جاري الإرسال…"
                    : "Sending…"
                  : ar
                  ? "إرسال إشعار تجريبي"
                  : "Send Test Notification"}
              </GreenButton>
            </div>
          </Card>
        )}
        <GreenButton onClick={save}>{ar ? "حفظ" : "Save"}</GreenButton>
      </div>
    </div>
  );
}

/* ============================== HELP ============================== */
function HelpScreen({ back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const faqs = ar
    ? [
        {
          q: "إزاي بتتحسب نسبة التمرين؟",
          a: "هي عدد المجموعات اللي علّمتها 'تم' مقسومة على إجمالي المجموعات المخططة لتمارين اليوم.",
        },
        {
          q: "إزاي بتتحسب نسبة الوجبات؟",
          a: "كل وجبة من الأربع وجبات اليومية اللي تسجلها بتساوي 25% من تتبع التغذية اليومي.",
        },
        {
          q: "أقدر أغيّر خطتي النشطة؟",
          a: "أيوة — روح الخطط، افتح أي خطة، ودوس 'استخدم الخطة دي'.",
        },
        {
          q: "إيه الفرق بين المجاني والـ Pro؟",
          a: "المجاني بيديك 4 تمارين لليوم، خطة ثابتة واحدة، سجل وزن الشهر ده، ومقارنة أسبوعية. الـ Pro بيفتح خطط مخصصة، تتبع أكل كامل، تمارين غير محدودة، وسجل كامل.",
        },
      ]
    : [
        {
          q: "How is my workout percentage calculated?",
          a: "It's the number of sets you marked done divided by the total sets planned for that day's exercises.",
        },
        {
          q: "How is my meal percentage calculated?",
          a: "Each of the 4 daily meals you log counts as 25% of your daily nutrition tracking.",
        },
        {
          q: "Can I change my active plan?",
          a: "Yes — go to Plans, open any plan, and tap 'Use This Plan'.",
        },
        {
          q: "What's the difference between Free and Pro?",
          a: "Free gives you 4 exercises/day, one fixed plan, this month's weight history and a weekly comparison. Pro unlocks personalized plans, full food tracking, unlimited exercises and full history.",
        },
      ];
  const openWhatsApp = () => {
    try {
      window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank");
    } catch (e) {
      showToast(
        ar
          ? "معرفناش نفتح واتساب — حاول تاني"
          : "Couldn't open WhatsApp — try again",
      );
    }
  };
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "المساعدة والدعم" : "Help & Support"} onBack={back} />
      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Card
          onClick={openWhatsApp}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 20,
            background: "rgba(37,211,102,0.14)",
            border: "1.5px solid rgba(37,211,102,0.5)",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: "#25D366",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MessageCircle size={30} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>
              {ar ? "كلمنا على واتساب" : "Chat with us on WhatsApp"}
            </div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>
              {ar
                ? "بنرد عادةً خلال كام ساعة"
                : "We usually reply within a few hours"}
            </div>
            <div
              style={{
                color: "#25D366",
                fontSize: 13,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              +{WHATSAPP_NUMBER}
            </div>
          </div>
          <ChevronRight
            size={20}
            color={C.sub2}
            style={{ transform: ar ? "scaleX(-1)" : "none" }}
          />
        </Card>
        {faqs.map((f) => (
          <Card key={f.q}>
            <div
              style={{
                color: C.text,
                fontWeight: 700,
                fontSize: 13.5,
                marginBottom: 6,
              }}
            >
              {f.q}
            </div>
            <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.6 }}>
              {f.a}
            </div>
          </Card>
        ))}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== LEGAL / ABOUT SCREENS ============================== */
function LegalDocScreen({ back, title, sections }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={title} onBack={back} />
      <div style={{ padding: "0 18px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sections.map((s) => (
            <div key={s.title}>
              <div
                style={{
                  color: C.text,
                  fontWeight: 800,
                  fontSize: 15,
                  marginBottom: 6,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  color: C.sub,
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {s.body}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: `1px solid ${C.border}`,
            color: C.sub2,
            fontSize: 11.5,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {APP_INFO.name} · {APP_INFO.version}
        </div>
      </div>
    </div>
  );
}

function AboutScreen({ back, go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "عن التطبيق" : "About"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 0 20px",
          }}
        >
          <AppLogo size={84} />
          <div
            style={{
              color: C.text,
              fontSize: 20,
              fontWeight: 800,
              marginTop: 12,
            }}
          >
            {APP_INFO.name}
          </div>
          <div style={{ color: C.sub, fontSize: 12.5, marginTop: 4 }}>
            {ar ? "ارفع تقدمك الرياضي" : "Level up your fitness journey"}
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "4px 12px",
              borderRadius: 999,
              background: C.greenSoft,
              color: C.green,
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            {ar ? "الإصدار" : "Version"} {APP_INFO.version}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>🏢</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar ? "المطور" : "Developer"}
              </div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
                {APP_INFO.developer}
              </div>
            </div>
          </Card>
          <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mail size={18} color={C.sub} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar ? "الدعم" : "Support"}
              </div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
                {APP_INFO.email}
              </div>
            </div>
          </Card>
          <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MessageCircle size={18} color={C.sub} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {ar ? "واتساب" : "WhatsApp"}
              </div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
                +{APP_INFO.whatsapp}
              </div>
            </div>
          </Card>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Card
            onClick={() => go("privacy")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Shield size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "سياسة الخصوصية" : "Privacy Policy"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card
            onClick={() => go("terms")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Info size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "شروط الاستخدام" : "Terms of Service"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountScreen({
  data,
  setData,
  back,
  firebaseUser,
  resetAfterDelete,
}) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doDelete = async () => {
    setError("");
    if (confirm.trim().toLowerCase() !== "delete") {
      setError(
        ar ? "اكتب DELETE لتأكيد الحذف" : "Type DELETE to confirm deletion",
      );
      return;
    }
    setBusy(true);
    try {
      const providerId = firebaseUser?.providerData?.[0]?.providerId;
      if (firebaseUser && providerId === "password") {
        if (!password) {
          setError(ar ? "اكتب كلمة السر الحالية" : "Enter your current password");
          return;
        }
        await reauthenticateWithCredential(
          firebaseUser,
          EmailAuthProvider.credential(firebaseUser.email, password),
        );
      } else if (firebaseUser && providerId === "google.com") {
        await reauthenticateWithGoogleFlow(firebaseUser);
      }

      // Delete the application document only after recent authentication
      // succeeds, so a failed account deletion does not orphan user data.
      if (firebaseUser?.uid) {
        await deleteDoc(doc(db, "users", firebaseUser.uid));
      }
      if (firebaseUser) {
        await deleteUser(firebaseUser);
      }
      resetAfterDelete();
    } catch (e) {
      setError(
        ar
          ? "تعذّر حذف الحساب. سجّل خروجك وحاول تاني، أو اتواصل مع الدعم."
          : "Couldn't delete your account. Please log out, log back in, and try again, or contact support.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "حذف الحساب" : "Delete Account"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card
          style={{
            background: C.dangerSoft,
            border: `1px solid ${C.danger}55`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Trash2 size={20} color={C.danger} />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>
              {ar ? "حذف الحساب نهائي" : "Permanent account deletion"}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
              {ar
                ? "هيتم حذف بيانات Fifty Fit: التمارين، الوزن، والوجبات. حذف الحساب لا يلغي اشتراك Google Play؛ ألغِه من Google Play."
                : "This permanently deletes your Fifty Fit data: workouts, weight, and meals. Deleting your account does not cancel Google Play subscriptions; cancel them through Google Play."}
            </div>
          </div>
        </Card>

        <div
          style={{
            color: C.text,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          {ar ? "اكتب DELETE للتأكيد" : "Type DELETE to confirm"}
        </div>
        <TextField
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={ar ? "DELETE" : "DELETE"}
          error={error}
        />
        {firebaseUser?.providerData?.[0]?.providerId === "password" && (
          <TextField
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={ar ? "كلمة السر الحالية" : "Current password"}
          />
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <GreenButton variant="outline" onClick={back} style={{ flex: 1 }}>
            {ar ? "إلغاء" : "Cancel"}
          </GreenButton>
          <button
            onClick={doDelete}
            disabled={busy}
            style={{
              flex: 1,
              padding: "14px 0",
              clipPath: chamfer(10),
              border: "none",
              background: busy ? C.card2 : C.danger,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              cursor: busy ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Trash2 size={16} />
            {busy
              ? ar
                ? "جاري الحذف…"
                : "Deleting…"
              : ar
              ? "حذف حسابي"
              : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== SETTINGS ============================== */
function SettingsScreen({ data, setData, back, go, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const pro = data.entitlements.trainingPro || data.entitlements.nutritionPro;
  const setTheme = (mode) => {
    const next = clone(data);
    next.settings.theme = mode;
    setData(next);
  };
  const setLang = (l) => {
    const next = clone(data);
    next.settings.language = l;
    persistLanguage(l);
    setData(next);
  };
  const toggleNotif = () => {
    const next = clone(data);
    next.settings.notifications = !next.settings.notifications;
    setData(next);
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "الإعدادات" : "Settings"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div
          style={{
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            margin: "6px 0 10px",
          }}
        >
          {ar ? "اللغة" : "LANGUAGE"}
        </div>
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setLang("ar")}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                border: `1.5px solid ${
                  (data.settings.language || "ar") === "ar" ? C.green : C.border
                }`,
                background:
                  (data.settings.language || "ar") === "ar"
                    ? C.greenSoft
                    : "transparent",
              }}
            >
              <span style={{ fontSize: 22 }}>🇸🇦</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                العربية
              </span>
            </button>
            <button
              onClick={() => setLang("en")}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                border: `1.5px solid ${
                  data.settings.language === "en" ? C.green : C.border
                }`,
                background:
                  data.settings.language === "en" ? C.greenSoft : "transparent",
              }}
            >
              <span style={{ fontSize: 22 }}>🇺🇸</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                English
              </span>
            </button>
          </div>
        </Card>

        <div
          style={{
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            margin: "6px 0 10px",
          }}
        >
          {ar ? "المظهر" : "APPEARANCE"}
        </div>
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setTheme("dark")}
              style={{
                flex: 1,
                padding: "16px 0",
                borderRadius: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                border: `1.5px solid ${
                  data.settings.theme === "dark" ? C.green : C.border
                }`,
                background:
                  data.settings.theme === "dark" ? C.greenSoft : "transparent",
              }}
            >
              <MoonIcon size={20} color={C.text} />
              <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                {ar ? "غامق" : "Dark"}
              </span>
            </button>
            <button
              onClick={() => setTheme("light")}
              style={{
                flex: 1,
                padding: "16px 0",
                borderRadius: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                border: `1.5px solid ${
                  data.settings.theme === "light" ? C.green : C.border
                }`,
                background:
                  data.settings.theme === "light" ? C.greenSoft : "transparent",
              }}
            >
              <Sunrise size={20} color={C.text} />
              <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                {ar ? "فاتح" : "Light"}
              </span>
            </button>
          </div>
        </Card>

        <div
          style={{
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            margin: "6px 0 10px",
          }}
        >
          {ar ? "الإشعارات" : "NOTIFICATIONS"}
        </div>
        <Card
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
              {ar ? "الإشعارات" : "Push Notifications"}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
              {ar ? "تذكيرات وتحديثات التقدم" : "Reminders & progress updates"}
            </div>
          </div>
          <ToggleSwitch
            on={data.settings.notifications}
            onClick={toggleNotif}
          />
        </Card>

        <div
          style={{
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            margin: "6px 0 10px",
          }}
        >
          {ar ? "الحساب" : "ACCOUNT"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <Card
            onClick={() => go("personalInfo")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <UserCircle size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "تعديل المعلومات الشخصية" : "Edit Personal Information"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card
            onClick={() => go("paywall")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Crown size={18} color={C.gold} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {pro
                ? ar
                  ? "إدارة الاشتراك"
                  : "Manage Subscription"
                : ar
                ? "خطط البرو"
                : "View Pro Plans"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: C.sub, fontSize: 11.5 }}>
              {ar ? "مسجّل دخول بـ" : "Signed in as"}
            </span>
            <span style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>
              {data.account.email}
            </span>
          </Card>
        </div>

        <div
          style={{
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            margin: "6px 0 10px",
          }}
        >
          {ar ? "عن التطبيق والتطبيق القانوني" : "ABOUT & LEGAL"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <Card
            onClick={() => go("about")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Info size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "عن التطبيق" : "About"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card
            onClick={() => go("privacy")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Shield size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "سياسة الخصوصية" : "Privacy Policy"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card
            onClick={() => go("terms")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <HelpCircle size={18} color={C.sub} />
            <span
              style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}
            >
              {ar ? "شروط الاستخدام" : "Terms of Service"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
          <Card
            onClick={() => go("deleteAccount")}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Trash2 size={18} color={C.danger} />
            <span
              style={{
                flex: 1,
                color: C.danger,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {ar ? "حذف الحساب" : "Delete Account"}
            </span>
            <ChevronRight
              size={16}
              color={C.sub2}
              style={{ transform: ar ? "scaleX(-1)" : "none" }}
            />
          </Card>
        </div>

        <Card
          onClick={() => go("logout")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <LogOut size={18} color={C.danger} />
          <span
            style={{ flex: 1, color: C.danger, fontSize: 14, fontWeight: 600 }}
          >
            {ar ? "تسجيل الخروج" : "Logout"}
          </span>
        </Card>
        <div
          style={{
            textAlign: "center",
            color: C.sub2,
            fontSize: 11.5,
            margin: "18px 0",
          }}
        >
          Fifty Fit · {ar ? "الإصدار" : "Version"} 1.0.0
        </div>
      </div>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const items = [
    { id: "home", label: ar ? "الرئيسية" : "Home", icon: HomeIcon },
    { id: "workout", label: ar ? "التمرين" : "Workout", icon: Dumbbell },
    { id: "progress", label: ar ? "التقدم" : "Progress", icon: TrendingUp },
    { id: "plans", label: ar ? "الخطط" : "Plans", icon: Calendar },
    { id: "profile", label: ar ? "حسابي" : "Profile", icon: User },
  ];
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        background: C.card,
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        padding: "10px 6px calc(12px + env(safe-area-inset-bottom))",
        zIndex: 20,
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 0",
              minHeight: 38,
            }}
          >
            {isActive ? (
              <div
                style={{
                  width: 46,
                  height: 32,
                  borderRadius: 20,
                  background: C.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={19} color={C.onAccent} strokeWidth={2.4} />
              </div>
            ) : (
              <>
                <Icon size={21} color={C.sub2} strokeWidth={1.8} />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    color: C.sub2,
                    marginTop: 4,
                  }}
                >
                  {it.label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================== ADMIN SCREEN ============================== */
// A lightweight, self-contained admin tool for the app owner. It lets an
// authorized admin (a user whose uid has a document in the `admins` collection,
// see firestore.rules) look up a user by email and manage their account:
//   - view account details (name, email, phone, joined info)
//   - grant/revoke Pro (training + nutrition) entitlements
//   - edit the user's saved name/phone
// The Firestore rules already enforce that ONLY admins can read/write any
// user's document, and that no client can ever modify the `admins` collection,
// so normal users can never reach this screen or the data it manages.
function AdminScreen({ back, showToast }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null); // { uid, ref, data }
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const searchByEmail = async () => {
    const q = (email || "").trim().toLowerCase();
    if (!isValidEmail(q)) {
      showToast(ar ? "اكتب بريد إلكتروني صحيح" : "Enter a valid email");
      return;
    }
    setSearching(true);
    setNotFound(false);
    setResult(null);
    try {
      // Emails are stored lowercased on signup, so query with the raw typed
      // value (trimmed) to match the stored account.email field.
      const snap = await getDocs(
        query(collection(db, "users"), where("account.email", "==", q)),
      );
      if (snap.empty) {
        setNotFound(true);
        showToast(
          ar ? "مفيش مستخدم بالإيميل ده" : "No user found with that email",
        );
        return;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      setResult({ uid: docSnap.id, ref: docSnap.ref, data });
      setEditName(data.account?.name || "");
      setEditPhone(data.account?.phone || "");
    } catch (e) {
      console.error("admin search failed", e);
      showToast(
        ar
          ? "حصل خطأ في البحث — تأكد من صلاحيات الأدمن"
          : "Search failed — check your admin access",
      );
    } finally {
      setSearching(false);
    }
  };

  const proActive =
    !!result?.data?.entitlements?.trainingPro ||
    !!result?.data?.entitlements?.nutritionPro;

  const setPro = async (on) => {
    if (!result) return;
    setSaving(true);
    try {
      const next = clone(result.data);
      next.entitlements = next.entitlements || {};
      if (on) {
        // Grant a 30-day Pro subscription from today.
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        next.entitlements.trainingPro = true;
        next.entitlements.nutritionPro = true;
        next.entitlements.proExpiresAt = expires.toISOString().slice(0, 10);
      } else {
        next.entitlements.trainingPro = false;
        next.entitlements.nutritionPro = false;
        next.entitlements.proExpiresAt = null;
      }
      await setDoc(result.ref, next);
      setResult({ ...result, data: next });
      showToast(on ? "Pro granted for 30 days" : "Pro removed");
    } catch (e) {
      console.error("admin setPro failed", e);
      showToast(ar ? "فشل التحديث — تأكد من الصلاحيات" : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const next = clone(result.data);
      next.account = {
        ...next.account,
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      await setDoc(result.ref, next);
      setResult({ ...result, data: next });
      showToast(ar ? "تم حفظ بيانات المستخدم" : "User details saved");
    } catch (e) {
      console.error("admin save failed", e);
      showToast(ar ? "فشل الحفظ" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "الأدمن" : "Admin"} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card style={{ marginBottom: 14, background: C.card2, border: "none" }}>
          <div style={{ color: C.sub, fontSize: 12.5, marginBottom: 8 }}>
            {ar
              ? "ابحث عن مستخدم بالإيميل لإدارته"
              : "Search a user by email to manage them"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <TextField
                icon={Search}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ar ? "بريد المستخدم" : "User email"}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <GreenButton onClick={searchByEmail} disabled={searching}>
              {searching
                ? ar
                  ? "جاري البحث…"
                  : "Searching…"
                : ar
                ? "بحث"
                : "Search"}
            </GreenButton>
          </div>
        </Card>

        {notFound && (
          <Card style={{ textAlign: "center", padding: 24, color: C.sub }}>
            {ar
              ? "مفيش مستخدم مسجل بالإيميل ده."
              : "No registered user with that email."}
          </Card>
        )}

        {result && (
          <>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>
                {ar ? "المستخدم" : "User"}
              </div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>
                {result.data.account?.name || "—"}
              </div>
              <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>
                {result.data.account?.email || "—"}
              </div>
              <div style={{ color: C.sub2, fontSize: 12, marginTop: 2 }}>
                {result.uid}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: proActive ? C.goldSoft : C.card2,
                  color: proActive ? C.gold : C.sub,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {proActive ? <Crown size={13} /> : <User size={13} />}
                {proActive
                  ? ar
                    ? "برو مفعّل"
                    : "Pro Active"
                  : ar
                  ? "مش برو"
                  : "Not Pro"}
              </div>
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <div style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>
                {ar ? "صلاحيات البرو" : "Pro Entitlements"}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <GreenButton
                  variant="outline"
                  onClick={() => setPro(true)}
                  disabled={saving || proActive}
                  style={{ flex: 1 }}
                >
                  <Crown size={15} /> {ar ? "منح برو" : "Grant Pro"}
                </GreenButton>
                <GreenButton
                  variant="outline"
                  onClick={() => setPro(false)}
                  disabled={saving || !proActive}
                  style={{ flex: 1, borderColor: C.danger, color: C.danger }}
                >
                  <X size={15} /> {ar ? "إزالة برو" : "Remove Pro"}
                </GreenButton>
              </div>
              {proActive && result.data.entitlements?.proExpiresAt && (
                <div style={{ color: C.sub2, fontSize: 11.5, marginTop: 8 }}>
                  {ar
                    ? `ينتهي في ${result.data.entitlements.proExpiresAt}`
                    : `Expires ${result.data.entitlements.proExpiresAt}`}
                </div>
              )}
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <div
                style={{
                  color: C.sub,
                  fontSize: 12,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {ar ? "تعديل البيانات" : "Edit Details"}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <TextField
                  icon={User}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={ar ? "الاسم" : "Name"}
                />
                <TextField
                  icon={Phone}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder={ar ? "رقم التليفون" : "Phone"}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <GreenButton onClick={saveAccount} disabled={saving}>
                  {ar ? "حفظ البيانات" : "Save Details"}
                </GreenButton>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== APP ROOT ============================== */
export default function GymApp() {
  const [online, setOnline] = useNetworkStatus(); // live internet status (true = online)
  const [checking, setChecking] = useState(false);
  const firebaseUser = useFirebaseSession(); // undefined = checking, null = signed out, object = signed in
  const { data, setData, setVerifiedEntitlements, loaded } = useAppData(
    firebaseUser?.uid,
  );
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!firebaseUser) {
      setIsAdmin(false);
      return;
    }
    getDoc(doc(db, "admins", firebaseUser.uid))
      .then((snap) => setIsAdmin(snap.exists()))
      .catch(() => setIsAdmin(false));
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !loaded) return undefined;
    let cancelled = false;
    billingRestore()
      .then((result) => {
        if (cancelled) return;
        const restored = result?.restoredPlans || [];
        setVerifiedEntitlements({
          trainingPro: restored.includes("training") || restored.includes("both"),
          nutritionPro:
            restored.includes("nutrition") || restored.includes("both"),
          proExpiresAt: null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setVerifiedEntitlements({
            trainingPro: false,
            nutritionPro: false,
            proExpiresAt: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, loaded, setVerifiedEntitlements]);
  const [phase, setPhase] = useState("splash");
  const [localLang, setLocalLang] = useState(readStoredLanguage);
  const [screen, setScreen] = useState("home");
  const [params, setParams] = useState({});
  const [selectedDay, setSelectedDay] = useState(DAYS[todayIdx]);
  // Calendar ISO for the currently selected strip day. Keeps logs correct when
  // the 7-day window crosses a week boundary (dateForDay alone is week-anchored).
  const [selectedIso, setSelectedIso] = useState(dateKey(0));
  const [navHistory, setNavHistory] = useState([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const mainScrollRef = useRef(null);

  const showToast = useCallback((msg, duration = 2200) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), duration);
  }, []);

  useEffect(() => {
    const open = () => setAiDrawerOpen(true);
    window.addEventListener("fiftyfit-open-ai", open);
    return () => window.removeEventListener("fiftyfit-open-ai", open);
  }, []);


  // User tapped "Retry" on the offline screen — re-check connectivity now.
  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkOnline();
      setOnline(result); // flips us back into the app when reconnected
    } catch (e) {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }, [setOnline]);

  // A signed-in user's saved language is authoritative: mirror it locally so
  // the picker never reappears after a reinstall or on another device.
  const savedLanguage = loaded ? data.settings.language : null;
  useEffect(() => {
    if (!savedLanguage || savedLanguage === localLang) return;
    persistLanguage(savedLanguage);
    setLocalLang(savedLanguage);
  }, [savedLanguage]); // eslint-disable-line

  useEffect(() => {
    if (!localLang && !savedLanguage) {
      setPhase("language");
      return;
    }
    if (firebaseUser === undefined) return; // Firebase hasn't reported yet — stay on splash
    if (firebaseUser === null) {
      setPhase("welcome");
      return;
    }
    if (!loaded) return; // signed in, waiting on their Firestore document to load
    if (data.onboarded) {
      setPhase("app");
      return;
    }
    // New Google users must provide a phone before the normal onboarding flow.
    const isGoogle = (firebaseUser?.providerData || []).some(
      (p) => p?.providerId === "google.com",
    );
    const hasPhone = !!(data?.account?.phone || "").trim();
    if (isGoogle && !hasPhone) {
      setPhase("googlePhone");
      return;
    }
    setPhase("onboarding");
  }, [firebaseUser, loaded, localLang, savedLanguage, data.onboarded, data?.account?.phone]); // eslint-disable-line

  // Keep the Firestore profile complete: the signed-in identity, the chosen
  // language and the program start date are written once and then survive
  // restarts, logouts and reinstalls.
  const profileSyncedRef = useRef(null);
  useEffect(() => {
    if (!firebaseUser || !loaded) return;
    if (profileSyncedRef.current === firebaseUser.uid) return;
    const patch = {};
    if (!data.account.email && firebaseUser.email)
      patch.email = firebaseUser.email;
    if (!data.account.name && firebaseUser.displayName)
      patch.name = firebaseUser.displayName;
    const needsLanguage = !data.settings.language && !!localLang;
    const needsStartDate = data.onboarded && !data.workoutStartDate;
    if (!Object.keys(patch).length && !needsLanguage && !needsStartDate) {
      profileSyncedRef.current = firebaseUser.uid;
      return;
    }
    profileSyncedRef.current = firebaseUser.uid;
    const next = clone(data);
    next.account = { ...next.account, ...patch };
    if (needsLanguage) next.settings.language = localLang;
    if (needsStartDate) next.workoutStartDate = dateKey(0);
    setData(next);
  }, [firebaseUser, loaded, data, localLang, setData]);

  // Keep selection on the device's REAL local calendar day when appropriate.
  // Opening the Workout tab always re-selects today (see onNavChange / go).
  const selectLocalToday = () => {
    const todayIso = dateKey(0);
    setSelectedIso(todayIso);
    setSelectedDay(weekdayOf(todayIso));
  };

  const pickLanguage = (lang) => {
    persistLanguage(lang);
    setLocalLang(lang);
    if (firebaseUser && loaded && data.settings.language !== lang) {
      const next = clone(data);
      next.settings.language = lang;
      setData(next);
    }
    setPhase("welcome");
  };

  const go = (s, p = {}) => {
    if (s === "logout") {
      setConfirmLogoutOpen(true);
      return;
    }
    if (s === "aiCoach") {
      setAiDrawerOpen(true);
      return;
    }
    if (s === "workout") {
      const todayIso = dateKey(0);
      setSelectedIso(todayIso);
      setSelectedDay(weekdayOf(todayIso));
    }
    setNavHistory((h) => [...h, { screen, params }]);
    setScreen(s);
    setParams(p);
  };
  const back = () => {
    setNavHistory((h) => {
      if (h.length === 0) {
        setScreen("home");
        return h;
      }
      const prev = h[h.length - 1];
      setScreen(prev.screen);
      setParams(prev.params);
      return h.slice(0, -1);
    });
  };
  const tabs = ["home", "workout", "progress", "plans", "profile"];
  const onNavChange = (id) => {
    setNavHistory([]);
    setScreen(id);
    setParams({});
    if (id === "workout") {
      // Always open Workout on today's REAL local calendar date.
      const todayIso = dateKey(0);
      setSelectedIso(todayIso);
      setSelectedDay(weekdayOf(todayIso));
    }
  };

  // New screens always start at the top (don't inherit scroll from previous page).
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    // Also reset window scroll in case any parent scrolled.
    try {
      window.scrollTo(0, 0);
    } catch (_) {
      /* ignore */
    }
  }, [screen, params]);

  const exitWarnedRef = useRef(false);
  useEffect(() => {
    let listenerHandle;
    CapApp.addListener("backButton", () => {
      // Priority 1: close AI Coach drawer (same as X button) — never exit.
      if (aiDrawerOpen) {
        setAiDrawerOpen(false);
        return;
      }
      if (confirmLogoutOpen) {
        setConfirmLogoutOpen(false);
        return;
      }
      if (phase !== "app") {
        // Auth flow: let the back button retrace login/signup/onboarding steps
        // instead of throwing the person out of the app entirely.
        if (phase === "login" || phase === "signup") {
          setPhase("welcome");
          return;
        }
        if (phase === "welcome") {
          CapApp.exitApp();
          return;
        }
        return; // onboarding/googlePhone/language: no natural "back" target, ignore
      }
      if (navHistory.length > 0) {
        back();
        return;
      }
      if (screen !== "home") {
        onNavChange("home");
        return;
      }
      // At the Home tab with nothing left to pop — require a second press to exit.
      if (exitWarnedRef.current) {
        CapApp.exitApp();
        return;
      }
      exitWarnedRef.current = true;
      showToast("Press back again to exit");
      setTimeout(() => {
        exitWarnedRef.current = false;
      }, 2000);
    }).then((h) => {
      listenerHandle = h;
    });
    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [phase, screen, navHistory, confirmLogoutOpen, aiDrawerOpen]); // eslint-disable-line

  const doAwardXp = (amount) => {
    const next = clone(data);
    next.profile.xp += amount;
    while (next.profile.xp >= next.profile.xpMax) {
      next.profile.xp -= next.profile.xpMax;
      next.profile.level += 1;
      next.profile.xpMax = Math.round(next.profile.xpMax * 1.15);
    }
    setData(next);
  };

  const doLogout = async () => {
    try {
      await signOut(auth);
      setNavHistory([]);
      setScreen("home");
      setConfirmLogoutOpen(false);
      showToast("Logged out");
      // The auth-state listener above sets phase to "welcome" automatically.
    } catch (e) {
      showToast("Couldn't log out — check your connection and try again");
    }
  };

  const C = data.settings.theme === "light" ? LIGHT : DARK;
  const lang = data.settings.language || localLang || "en";
  const ui = { C, lang };

  // No internet: block the whole app behind a full-screen gate. This runs
  // on launch AND continuously — if the device drops offline mid-session,
  // the offline screen takes over and auto-resumes when connectivity returns.
  if (!online && phase !== "language") {
    return (
      <UIContext.Provider value={ui}>
        <div
          style={{
            background: C.bg,
            minHeight: "100vh",
            maxWidth: 430,
            margin: "0 auto",
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          <NoInternetScreen onRetry={retry} checking={checking} />
        </div>
      </UIContext.Provider>
    );
  }

  if (phase === "splash") {
    return (
      <UIContext.Provider value={{ C: DARK, lang: "en" }}>
        <div style={{ maxWidth: 430, margin: "0 auto" }}>
          <SplashScreen />
        </div>
      </UIContext.Provider>
    );
  }

  if (phase === "language") {
    return (
      <UIContext.Provider value={{ C, lang: "en" }}>
        <div
          style={{
            background: C.bg,
            minHeight: "100vh",
            maxWidth: 430,
            margin: "0 auto",
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          <LanguageScreen onPick={pickLanguage} />
        </div>
      </UIContext.Provider>
    );
  }

  let authScreen = null;
  if (phase === "welcome") authScreen = <WelcomeScreen go={setPhase} />;
  else if (phase === "login")
    authScreen = <LoginScreen go={setPhase} showToast={showToast} />;
  else if (phase === "signup")
    authScreen = (
      <SignUpScreen go={setPhase} showToast={showToast} localLang={localLang} />
    );
  else if (phase === "googlePhone")
    authScreen = (
      <GooglePhoneScreen
        data={data}
        setData={setData}
        go={setPhase}
        showToast={showToast}
      />
    );
  else if (phase === "onboarding")
    authScreen = (
      <OnboardingScreen
        data={data}
        setData={setData}
        go={setPhase}
        showToast={showToast}
      />
    );

  if (authScreen) {
    return (
      <UIContext.Provider value={ui}>
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{
            background: C.bg,
            minHeight: "100vh",
            maxWidth: 430,
            margin: "0 auto",
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          {authScreen}
          <Toast message={toast} />
        </div>
      </UIContext.Provider>
    );
  }

  let content;
  if (screen === "home") content = <HomeScreen data={data} go={go} />;
  else if (screen === "workout")
    content = (
      <WorkoutScreen
        data={data}
        setData={setData}
        go={go}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        selectedIso={selectedIso}
        setSelectedIso={setSelectedIso}
        showToast={showToast}
      />
    );
  else if (screen === "exercise")
    content = (
      <ExerciseScreen
        data={data}
        setData={setData}
        back={back}
        exerciseId={params.exerciseId}
        day={params.day}
        logDateIso={params.date}
        showToast={showToast}
        awardXp={doAwardXp}
      />
    );
  else if (screen === "progress")
    content = <ProgressScreen data={data} go={go} />;
  else if (screen === "bodyweight")
    content = (
      <BodyWeightScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
        go={go}
      />
    );
  else if (screen === "meals")
    content = (
      <MealsScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
        go={go}
      />
    );
  else if (screen === "foodPicker")
    content = (
      <FoodPickerScreen
        data={data}
        setData={setData}
        back={back}
        mealId={params.mealId}
        showToast={showToast}
      />
    );
  else if (screen === "plans")
    content = (
      <PlansScreen
        data={data}
        setData={setData}
        go={go}
        showToast={showToast}
      />
    );
  else if (screen === "planDetail")
    content = (
      <PlanDetailScreen
        data={data}
        setData={setData}
        back={back}
        planId={params.planId}
        showToast={showToast}
      />
    );
  else if (screen === "paywall")
    content = (
      <PaywallScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
      />
    );
  else if (screen === "profile")
    content = <ProfileScreen data={data} go={go} isAdmin={isAdmin} />;
  else if (screen === "personalInfo")
    content = (
      <PersonalInfoScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
      />
    );
  else if (screen === "goals")
    content = (
      <GoalsScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
      />
    );
  else if (screen === "measurements")
    content = <MeasurementsScreen data={data} back={back} go={go} />;
  else if (screen === "reminders")
    content = (
      <RemindersScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
      />
    );
  else if (screen === "help")
    content = <HelpScreen back={back} showToast={showToast} />;
  else if (screen === "settings")
    content = (
      <SettingsScreen
        data={data}
        setData={setData}
        back={back}
        go={go}
        showToast={showToast}
      />
    );
  else if (screen === "about") content = <AboutScreen back={back} go={go} />;
  else if (screen === "privacy")
    content = (
      <LegalDocScreen
        back={back}
        title={lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
        sections={PRIVACY_POLICY_SECTIONS}
      />
    );
  else if (screen === "terms")
    content = (
      <LegalDocScreen
        back={back}
        title={lang === "ar" ? "شروط الاستخدام" : "Terms of Service"}
        sections={TERMS_SECTIONS}
      />
    );
  else if (screen === "deleteAccount")
    content = (
      <DeleteAccountScreen
        data={data}
        setData={setData}
        back={back}
        firebaseUser={firebaseUser}
        resetAfterDelete={() => {
          setData(freshState());
          setNavHistory([]);
          setScreen("home");
          setConfirmLogoutOpen(false);
          showToast(
            lang === "ar"
              ? "تم حذف حسابك نهائيًا"
              : "Your account has been permanently deleted",
          );
        }}
      />
    );
  else if (screen === "admin")
    content = <AdminScreen back={back} showToast={showToast} />;
  else content = <HomeScreen data={data} go={go} />;

  const showNav = tabs.includes(screen);

  return (
    <UIContext.Provider value={ui}>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{
          background: C.bg,
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          ref={mainScrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <style>
            {
              "@keyframes screenIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }"
            }
          </style>
          <div
            key={screen + JSON.stringify(params)}
            style={{ animation: "screenIn 0.22s ease-out" }}
          >
            {content}
          </div>
        </div>
        {showNav && <BottomNav active={screen} onChange={onNavChange} />}
        {firebaseUser && !aiDrawerOpen && (
          <AICoachSideTab
            onOpen={() => setAiDrawerOpen(true)}
            ar={lang === "ar" || localLang === "ar"}
            C={C}
          />
        )}
        {firebaseUser && (
          <AICoachDrawer
            open={aiDrawerOpen}
            onClose={() => setAiDrawerOpen(false)}
            data={data}
            setData={setData}
            showToast={showToast}
            go={go}
          />
        )}
        {confirmLogoutOpen && (
          <ConfirmDialog
            title={lang === "ar" ? "تسجيل الخروج؟" : "Log out?"}
            message={
              lang === "ar"
                ? "هتحتاج تسجّل دخولك تاني عشان تشوف تمارينك ووزنك وسجل أكلك."
                : "You'll need to log back in to see your workouts, weight and meal history."
            }
            confirmLabel={lang === "ar" ? "تسجيل الخروج" : "Log Out"}
            danger
            onConfirm={doLogout}
            onCancel={() => setConfirmLogoutOpen(false)}
          />
        )}
        <Toast message={toast} />
      </div>
    </UIContext.Provider>
  );
}
