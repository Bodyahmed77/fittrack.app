import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from "react";
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
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import logoSrc from "./assets/logo.png";
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";

// Fixed notification IDs so we can reliably cancel/replace them later.
const NOTIF_ID_DAILY_REMINDER = 1001;
const NOTIF_ID_SUB_EXPIRY = 1002;

async function scheduleDailyReminder(timeStr) {
  const [hour, minute] = (timeStr || "18:00").split(":").map(Number);
  await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID_DAILY_REMINDER }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: NOTIF_ID_DAILY_REMINDER,
      title: "Fifty",
      body: "Don't forget today's workout! 💪",
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
    }],
  });
}
async function cancelDailyReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID_DAILY_REMINDER }] });
}
async function scheduleSubscriptionExpiryReminder(expiresAtISO) {
  await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID_SUB_EXPIRY }] });
  if (!expiresAtISO) return;
  const fireDate = new Date(expiresAtISO + "T10:00:00");
  fireDate.setDate(fireDate.getDate() - 5);
  if (fireDate <= new Date()) return; // less than 5 days left already — nothing to schedule
  await LocalNotifications.schedule({
    notifications: [{
      id: NOTIF_ID_SUB_EXPIRY,
      title: "Fifty Pro",
      body: "Your Pro subscription ends in 5 days — renew to keep your plan and full history.",
      schedule: { at: fireDate },
    }],
  });
}

function authErrorMessage(err) {
  const code = err?.code || "";
  if (code === "auth/user-not-found") return "This email isn't registered yet — tap Sign Up below";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Incorrect email or password";
  if (code === "auth/invalid-email") return "Enter a valid email address";
  if (code === "auth/email-already-in-use") return "An account already exists with this email — try logging in instead";
  if (code === "auth/weak-password") return "Password is too weak — use at least 6 characters";
  if (code === "auth/network-request-failed") return "No internet connection — check your network and try again";
  if (code === "auth/too-many-requests") return "Too many attempts — please wait a bit and try again";
  return "Something went wrong — please try again";
}

/* ============================== THEME ============================== */
const DARK = {
  mode: "dark", bg: "#000000", card: "#000000", card2: "#161616", border: "rgba(255,255,255,0.35)",
  green: "#ffffff", greenSoft: "rgba(255,255,255,0.10)", onAccent: "#000000", text: "#ffffff", sub: "#a3a3a3",
  sub2: "#6b6b6b", danger: "#ef4444", dangerSoft: "rgba(239,68,68,0.12)", overlay: "rgba(0,0,0,0.7)",
  gold: "#eab308", goldSoft: "rgba(234,179,8,0.14)",
};
const LIGHT = {
  mode: "light", bg: "#ffffff", card: "#ffffff", card2: "#f2f2f2", border: "rgba(0,0,0,0.22)",
  green: "#000000", greenSoft: "rgba(0,0,0,0.07)", onAccent: "#ffffff", text: "#000000", sub: "#5c5c5c",
  sub2: "#9a9a9a", danger: "#dc2626", dangerSoft: "rgba(220,38,38,0.10)", overlay: "rgba(0,0,0,0.4)",
  gold: "#b45309", goldSoft: "rgba(180,83,9,0.12)",
};

const UIContext = createContext(null);
function useUI() { return useContext(UIContext); }

/* ============================== HELPERS ============================== */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const todayIdx = (() => { const js = new Date().getDay(); return js === 0 ? 6 : js - 1; })();
const WHATSAPP_NUMBER = "201108178493";

function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function shortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function monthKey(iso) { return iso.slice(0, 7); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function passwordIssues(pw) {
  const issues = [];
  if (!pw || pw.length < 8) issues.push("8+ characters");
  if (!/[A-Z]/.test(pw || "")) issues.push("one uppercase letter");
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw || "")) issues.push("one special character");
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
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(iso) {
  if (!iso) return 0;
  const ms = new Date(iso + "T00:00:00") - new Date(dateKey(0) + "T00:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}
function setsCompletedInRange(data, startISO, endISO) {
  let count = 0;
  Object.keys(data.logs).forEach((d) => {
    if (d < startISO || d > endISO) return;
    Object.values(data.logs[d]).forEach((ex) => { count += (ex.sets || []).filter((s) => s.done).length; });
  });
  return count;
}

/* ============================== EXERCISE LIBRARY ============================== */
const EX = {
  bench_press: { name: "Bench Press", startWeight: 40, emoji: "🏋️" },
  incline_db_press: { name: "Incline Dumbbell Press", startWeight: 16, emoji: "🏋️" },
  chest_fly: { name: "Chest Fly", startWeight: 10, emoji: "🦅" },
  dips: { name: "Dips", startWeight: 0, emoji: "💪" },
  tricep_pushdown: { name: "Tricep Pushdown", startWeight: 18, emoji: "💪" },
  overhead_ext: { name: "Overhead Extension", startWeight: 10, emoji: "💪" },
  push_up: { name: "Push Up", startWeight: 0, emoji: "🤸" },
  lat_pulldown: { name: "Lat Pulldown", startWeight: 35, emoji: "🚣" },
  barbell_row: { name: "Barbell Row", startWeight: 40, emoji: "🚣" },
  seated_row: { name: "Seated Cable Row", startWeight: 30, emoji: "🚣" },
  bicep_curl: { name: "Barbell Curl", startWeight: 15, emoji: "💪" },
  hammer_curl: { name: "Hammer Curl", startWeight: 10, emoji: "💪" },
  squat: { name: "Squat", startWeight: 40, emoji: "🦵" },
  leg_press: { name: "Leg Press", startWeight: 60, emoji: "🦵" },
  lunges: { name: "Walking Lunges", startWeight: 10, emoji: "🦵" },
  leg_curl: { name: "Leg Curl", startWeight: 20, emoji: "🦵" },
  calf_raise: { name: "Calf Raise", startWeight: 30, emoji: "🦵" },
  ohp: { name: "Overhead Press", startWeight: 20, emoji: "🤲" },
  lateral_raise: { name: "Lateral Raise", startWeight: 6, emoji: "🤲" },
  rear_delt_fly: { name: "Rear Delt Fly", startWeight: 6, emoji: "🤲" },
  shrugs: { name: "Barbell Shrugs", startWeight: 30, emoji: "🤷" },
  deadlift: { name: "Deadlift", startWeight: 50, emoji: "🏋️" },
  pull_up: { name: "Pull Up", startWeight: 0, emoji: "🧗" },
  plank: { name: "Plank", startWeight: 0, emoji: "🧘" },
  treadmill: { name: "Treadmill Walk/Run", startWeight: 0, emoji: "🏃" },
  bike: { name: "Stationary Bike", startWeight: 0, emoji: "🚴" },
  crunches: { name: "Cable Crunches", startWeight: 10, emoji: "🔥" },
  leg_raise: { name: "Hanging Leg Raise", startWeight: 0, emoji: "🔥" },
  jump_rope: { name: "Jump Rope", startWeight: 0, emoji: "🤾" },
  burpees: { name: "Burpees", startWeight: 0, emoji: "🔥" },
};
function mkEx(id, sets, reps) {
  return { id, name: EX[id].name, targetSets: sets, targetReps: reps, startWeight: EX[id].startWeight, emoji: EX[id].emoji || "🏋️" };
}

/* ============================== PLAN TEMPLATES ============================== */
const PLAN_TEMPLATES = {
  beginner: {
    id: "beginner", name: "Standard Plan", tagline: "Fixed plan · Free for everyone", icon: "🏋️", pro: false,
    schedule: {
      Mon: { title: "Full Body A", exercises: [mkEx("squat", 3, "8-10"), mkEx("bench_press", 3, "8-10"), mkEx("barbell_row", 3, "8-10"), mkEx("plank", 3, "30s")] },
      Tue: { title: "Rest Day", exercises: [] },
      Wed: { title: "Full Body B", exercises: [mkEx("deadlift", 3, "6-8"), mkEx("ohp", 3, "8-10"), mkEx("lat_pulldown", 3, "10-12"), mkEx("crunches", 3, "15-20")] },
      Thu: { title: "Rest Day", exercises: [] },
      Fri: { title: "Full Body C", exercises: [mkEx("leg_press", 3, "10-12"), mkEx("incline_db_press", 3, "10-12"), mkEx("seated_row", 3, "10-12"), mkEx("bicep_curl", 3, "10-12")] },
      Sat: { title: "Light Cardio", exercises: [mkEx("treadmill", 1, "20 min"), mkEx("jump_rope", 3, "1 min")] },
      Sun: { title: "Rest Day", exercises: [] },
    },
  },
  fatloss: {
    id: "fatloss", name: "Fat Loss Plan", tagline: "Personalized · Pro", icon: "🔥", pro: true,
    schedule: {
      Mon: { title: "Upper Body Circuit", exercises: [mkEx("push_up", 3, "12-15"), mkEx("seated_row", 3, "12-15"), mkEx("lateral_raise", 3, "12-15"), mkEx("burpees", 3, "10-12")] },
      Tue: { title: "Cardio", exercises: [mkEx("treadmill", 1, "30 min"), mkEx("jump_rope", 4, "1 min")] },
      Wed: { title: "Lower Body Circuit", exercises: [mkEx("squat", 4, "12-15"), mkEx("lunges", 3, "12-15"), mkEx("calf_raise", 3, "15-20")] },
      Thu: { title: "Rest Day", exercises: [] },
      Fri: { title: "Full Body HIIT", exercises: [mkEx("burpees", 4, "12-15"), mkEx("push_up", 3, "12-15"), mkEx("crunches", 3, "20"), mkEx("jump_rope", 4, "1 min")] },
      Sat: { title: "Cardio", exercises: [mkEx("bike", 1, "30 min")] },
      Sun: { title: "Rest Day", exercises: [] },
    },
  },
  hypertrophy: {
    id: "hypertrophy", name: "Muscle Building Split", tagline: "Personalized · Pro", icon: "💪", pro: true,
    schedule: {
      Mon: { title: "Chest & Triceps", exercises: [mkEx("bench_press", 4, "8-12"), mkEx("incline_db_press", 3, "8-12"), mkEx("chest_fly", 3, "10-12"), mkEx("dips", 3, "8-12"), mkEx("tricep_pushdown", 3, "10-12"), mkEx("overhead_ext", 3, "10-12")] },
      Tue: { title: "Back & Biceps", exercises: [mkEx("lat_pulldown", 4, "8-12"), mkEx("barbell_row", 4, "8-10"), mkEx("seated_row", 3, "10-12"), mkEx("bicep_curl", 3, "10-12"), mkEx("hammer_curl", 3, "10-12")] },
      Wed: { title: "Rest Day", exercises: [] },
      Thu: { title: "Legs", exercises: [mkEx("squat", 4, "6-10"), mkEx("leg_press", 4, "10-12"), mkEx("lunges", 3, "10-12"), mkEx("leg_curl", 3, "10-12"), mkEx("calf_raise", 4, "12-15")] },
      Fri: { title: "Shoulders", exercises: [mkEx("ohp", 4, "8-10"), mkEx("lateral_raise", 4, "12-15"), mkEx("rear_delt_fly", 3, "12-15"), mkEx("shrugs", 3, "10-12")] },
      Sat: { title: "Arms & Core", exercises: [mkEx("bicep_curl", 3, "10-12"), mkEx("tricep_pushdown", 3, "10-12"), mkEx("crunches", 3, "15-20"), mkEx("leg_raise", 3, "10-15")] },
      Sun: { title: "Rest Day", exercises: [] },
    },
  },
};

const MEAL_ITEMS = [
  { id: "breakfast", name: "Breakfast", icon: Coffee, kcal: 450 },
  { id: "lunch", name: "Lunch", icon: Sun, kcal: 650 },
  { id: "dinner", name: "Dinner", icon: MoonIcon, kcal: 550 },
  { id: "snacks", name: "Snacks", icon: Apple, kcal: 250 },
];

const FOOD_DB = [
  // id, name, kcal / protein(g) / carbs(g) / fat(g) — all per 100g
  { id: "rice_white", name: "White Rice (cooked)", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "rice_brown", name: "Brown Rice (cooked)", kcal: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  { id: "chicken_breast", name: "Chicken Breast (grilled)", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "chicken_thigh", name: "Chicken Thigh", kcal: 209, protein: 26, carbs: 0, fat: 10.9 },
  { id: "beef_lean", name: "Lean Beef", kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { id: "ground_beef", name: "Ground Beef", kcal: 254, protein: 17, carbs: 0, fat: 20 },
  { id: "kofta", name: "Grilled Kofta", kcal: 250, protein: 18, carbs: 2, fat: 19 },
  { id: "turkey_breast", name: "Turkey Breast", kcal: 135, protein: 30, carbs: 0, fat: 1 },
  { id: "egg", name: "Egg", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "potato_boiled", name: "Potato (boiled)", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "french_fries", name: "French Fries", kcal: 312, protein: 3.4, carbs: 41, fat: 15 },
  { id: "sweet_potato", name: "Sweet Potato", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { id: "bread_white", name: "White Bread", kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  { id: "bread_baladi", name: "Baladi Bread", kcal: 280, protein: 9, carbs: 56, fat: 1.5 },
  { id: "bread_whole_wheat", name: "Whole Wheat Bread", kcal: 247, protein: 13, carbs: 41, fat: 3.4 },
  { id: "pasta_cooked", name: "Pasta (cooked)", kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { id: "oats_dry", name: "Oats (dry)", kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { id: "quinoa_cooked", name: "Quinoa (cooked)", kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { id: "banana", name: "Banana", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "apple", name: "Apple", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { id: "orange", name: "Orange", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  { id: "watermelon", name: "Watermelon", kcal: 30, protein: 0.6, carbs: 8, fat: 0.2 },
  { id: "dates", name: "Dates", kcal: 277, protein: 1.8, carbs: 75, fat: 0.2 },
  { id: "tomato", name: "Tomato", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { id: "cucumber", name: "Cucumber", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { id: "salad_greens", name: "Mixed Salad Greens", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { id: "spinach", name: "Spinach", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { id: "broccoli", name: "Broccoli", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { id: "molokhia", name: "Molokhia (cooked)", kcal: 50, protein: 4.8, carbs: 6, fat: 1 },
  { id: "olive_oil", name: "Olive Oil", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { id: "butter", name: "Butter", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { id: "milk", name: "Milk", kcal: 42, protein: 3.4, carbs: 5, fat: 1 },
  { id: "yogurt", name: "Yogurt", kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { id: "white_cheese", name: "White Cheese", kcal: 264, protein: 14, carbs: 4, fat: 21 },
  { id: "cottage_cheese", name: "Cottage Cheese", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { id: "tuna", name: "Tuna (canned in water)", kcal: 116, protein: 26, carbs: 0, fat: 0.8 },
  { id: "salmon", name: "Salmon", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "shrimp", name: "Shrimp", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { id: "lentils_cooked", name: "Lentils (cooked)", kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  { id: "fava_beans", name: "Fava Beans (Ful)", kcal: 110, protein: 7.6, carbs: 18, fat: 0.4 },
  { id: "falafel", name: "Falafel", kcal: 333, protein: 13, carbs: 32, fat: 18 },
  { id: "hummus", name: "Hummus", kcal: 166, protein: 8, carbs: 14, fat: 10 },
  { id: "almonds", name: "Almonds", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "peanut_butter", name: "Peanut Butter", kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { id: "honey", name: "Honey", kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { id: "sugar", name: "Sugar", kcal: 387, protein: 0, carbs: 100, fat: 0 },
  { id: "chocolate", name: "Chocolate", kcal: 546, protein: 7.6, carbs: 60, fat: 31 },
  { id: "avocado", name: "Avocado", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
];

const GOALS = [
  { id: "lose", label: "Lose Weight", desc: "Burn fat, stay lean", icon: "🔥", planId: "fatloss" },
  { id: "muscle", label: "Build Muscle", desc: "Gain size & strength", icon: "💪", planId: "hypertrophy" },
  { id: "maintain", label: "Stay Fit", desc: "General fitness habit", icon: "🏋️", planId: "beginner" },
];

const FREE_EXERCISE_CAP = 4;

/* ============================== DEFAULT STATE ============================== */
function freshState() {
  return {
    onboarded: false,
    account: { name: "", email: "", phone: "", gender: "", age: "", height: "", goal: "", daysPerWeek: 4, photo: "" },
    settings: { theme: "dark", notifications: true, reminderTime: "18:00", language: null },
    profile: { level: 1, xp: 0, xpMax: 500 },
    entitlements: { nutritionPro: false, trainingPro: false, proExpiresAt: null },
    nutritionPlan: null,
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
  useEffect(() => onAuthStateChanged(auth, (u) => setFirebaseUser(u || null)), []);
  return firebaseUser;
}

function useAppData(uid) {
  const [data, setDataRaw] = useState(freshState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) { setLoaded(false); return; }
    setLoaded(false);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const fresh = freshState();
        const parsed = snap.exists() ? snap.data() : {};
        const merged = {
          ...fresh, ...parsed,
          account: { ...fresh.account, ...(parsed.account || {}) },
          settings: { ...fresh.settings, ...(parsed.settings || {}) },
          profile: { ...fresh.profile, ...(parsed.profile || {}) },
          entitlements: { ...fresh.entitlements, ...(parsed.entitlements || {}) },
          customPlan: parsed.customPlan || {},
        };
        // Pro is a 30-day subscription — expire it automatically once the date has passed.
        if (merged.entitlements.proExpiresAt && merged.entitlements.proExpiresAt < dateKey(0)) {
          merged.entitlements.trainingPro = false;
          merged.entitlements.nutritionPro = false;
          merged.entitlements.proExpiresAt = null;
        }
        setDataRaw(merged);
        setLoaded(true);
      },
      (err) => { console.error("Firestore read failed", err); setLoaded(true); }
    );
    return unsub;
  }, [uid]);

  const setData = useCallback(async (next) => {
    setDataRaw(next);
    if (!uid) return;
    try { await setDoc(doc(db, "users", uid), next); }
    catch (e) { console.error("save failed", e); }
  }, [uid]);

  return { data, setData, loaded };
}

/* ============================== EXERCISE MERGE HELPERS ============================== */
function getMergedExercises(data, day) {
  const activePlan = PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const base = activePlan.schedule[day].exercises;
  const custom = data.customPlan[day] || { added: [], removedIds: [] };
  const removed = new Set(custom.removedIds || []);
  return [...base.filter((e) => !removed.has(e.id)), ...(custom.added || [])];
}
function getUsableExercises(data, day) {
  const merged = getMergedExercises(data, day);
  const pro = data.entitlements.trainingPro;
  return { list: pro ? merged : merged.slice(0, FREE_EXERCISE_CAP), lockedCount: pro ? 0 : Math.max(0, merged.length - FREE_EXERCISE_CAP) };
}

/* ============================== SHARED UI ============================== */
function chamfer(cut) {
  return `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, ${cut}px 100%, 0 calc(100% - ${cut}px))`;
}
function IconBtn({ children, onClick, style }) {
  const { C } = useUI();
  return (
    <button onClick={onClick} style={{ width: 34, height: 34, background: C.card2, border: `1px solid ${C.border}`, clipPath: chamfer(7), display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...style }}>
      {children}
    </button>
  );
}
function TopBar({ title, onBack, right }) {
  const { C } = useUI();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && <IconBtn onClick={onBack}><ChevronLeft size={20} color={C.text} /></IconBtn>}
        <span style={{ fontSize: 17, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</span>
      </div>
      <div>{right}</div>
    </div>
  );
}
function Card({ children, style, onClick }) {
  const { C } = useUI();
  return (
    <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, clipPath: chamfer(14), padding: 16, cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}
function GreenButton({ children, onClick, disabled, style, variant = "solid" }) {
  const { C } = useUI();
  const solid = variant === "solid";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "14px 0",
      border: solid ? "none" : `1.5px solid ${C.green}`,
      clipPath: chamfer(10),
      background: solid ? (disabled ? C.card2 : C.green) : "transparent",
      color: solid ? (disabled ? C.sub2 : C.onAccent) : C.green,
      fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...style,
    }}>{children}</button>
  );
}
function Pill({ active, children, onClick }) {
  const { C } = useUI();
  return (
    <button onClick={onClick} style={{
      padding: "9px 0", flex: 1, clipPath: chamfer(8), border: "none", cursor: "pointer",
      background: active ? C.green : "transparent", color: active ? C.onAccent : C.sub, fontWeight: 800, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.3,
    }}>{children}</button>
  );
}
function TextField({ icon: Icon, type = "text", value, onChange, placeholder, rightEl, error }) {
  const { C } = useUI();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.card2, border: `1px solid ${error ? C.danger : C.border}`, borderRadius: 13, padding: "13px 14px" }}>
        {Icon && <Icon size={17} color={C.sub} />}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14.5, minWidth: 0 }} />
        {rightEl}
      </div>
      {error && <div style={{ color: C.danger, fontSize: 11.5, marginTop: 5, marginLeft: 4 }}>{error}</div>}
    </div>
  );
}
function ToggleSwitch({ on, onClick }) {
  const { C } = useUI();
  return (
    <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 20, border: on ? "none" : `1px solid ${C.border}`, cursor: "pointer", background: on ? C.green : "transparent", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: on ? C.onAccent : C.sub2, position: "absolute", top: 2, left: on ? 23 : 3, transition: "left 0.2s" }} />
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
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.green} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
    </svg>
  );
}
function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  const { C } = useUI();
  return (
    <div style={{ position: "fixed", inset: 0, background: C.overlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 340 }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{title}</div>
        <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.5, marginBottom: 18 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: danger ? C.danger : C.green, color: danger ? "#fff" : C.onAccent, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
function Toast({ message }) {
  const { C } = useUI();
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: C.mode === "dark" ? "#22272e" : "#1f2937", color: "#fff", padding: "11px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, maxWidth: "85%", textAlign: "center" }}>
      <Check size={15} color={C.green} style={{ flexShrink: 0 }} /> {message}
    </div>
  );
}
function AppLogo({ size = 74 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
      <img src={logoSrc} alt="Fifty" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}
function Avatar({ photo, size = 40 }) {
  const { C } = useUI();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.card2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={size * 0.48} color={C.sub} />}
    </div>
  );
}
function ProBadge({ small }) {
  const { C } = useUI();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: C.goldSoft, color: C.gold, fontWeight: 800, fontSize: small ? 9.5 : 10.5, padding: small ? "2px 6px" : "3px 8px", borderRadius: 20 }}>
      <Crown size={small ? 9 : 10} /> PRO
    </span>
  );
}
const inputBoxStyle = (C, error) => ({ width: "100%", background: C.card2, border: `1px solid ${error ? C.danger : C.border}`, borderRadius: 8, color: C.text, padding: "8px 6px", fontSize: 13.5, textAlign: "center", outline: "none" });

/* ============================== SPLASH / WELCOME ============================== */
function SplashScreen() {
  const { C } = useUI();
  return (
    <div style={{ height: "100vh", minHeight: 640, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.bg }}>
      <AppLogo size={84} />
      <div style={{ color: C.text, fontWeight: 800, fontSize: 22, letterSpacing: 0.3 }}>Fifty</div>
      <div style={{ color: C.sub, fontSize: 12.5 }}>Loading your progress…</div>
    </div>
  );
}
function GoogleButton({ onClick }) {
  const { C } = useUI();
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "13px 0", borderRadius: 13, border: `1px solid ${C.border}`, background: C.card,
      color: C.text, fontSize: 14.5, fontWeight: 700, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
      </svg>
      Continue with Google
    </button>
  );
}

function LanguageScreen({ onPick }) {
  const { C } = useUI();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", gap: 28 }}>
      <AppLogo size={72} />
      <div style={{ textAlign: "center" }}>
        <div style={{ color: C.text, fontSize: 19, fontWeight: 800 }}>Choose your language</div>
        <div style={{ color: C.sub, fontSize: 13.5, marginTop: 4 }}>اختر لغتك</div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onPick("ar")} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 16, cursor: "pointer",
          border: `1.5px solid ${C.border}`, background: C.card,
        }}>
          <span style={{ fontSize: 28 }}>🇸🇦</span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>العربية</span>
        </button>
        <button onClick={() => onPick("en")} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 16, cursor: "pointer",
          border: `1.5px solid ${C.border}`, background: C.card,
        }}>
          <span style={{ fontSize: 28 }}>🇺🇸</span>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>English</span>
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({ go }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <AppLogo size={90} />
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.text, fontSize: 25, fontWeight: 800 }}>Fifty</div>
          <div style={{ color: C.sub, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            {ar ? "تابع تمارينك ووزنك ووجباتك في مكان واحد." : "Track your workouts, weight and meals — all in one place."}
          </div>
        </div>
      </div>
      <div style={{ paddingBottom: "calc(36px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
        <GreenButton onClick={() => go("signup")}>{ar ? "إنشاء حساب" : "Create Account"} <ArrowRight size={16} style={{ transform: ar ? "scaleX(-1)" : "none" }} /></GreenButton>
        <GreenButton variant="outline" onClick={() => go("login")}>{ar ? "تسجيل الدخول" : "Log In"}</GreenButton>
      </div>
    </div>
  );
}

/* ============================== LOGIN / SIGNUP ============================== */
function LoginScreen({ go, showToast }) {
  const { C } = useUI();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setResetSent(false);
    if (!email || !isValidEmail(email)) { setError("Enter a valid email address"); return; }
    if (!password) { setError("Enter your password"); return; }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast("Welcome back!");
      // Root component reacts to the auth state change and routes automatically.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError("");
    if (!email || !isValidEmail(email)) { setError("Enter your email above first, then tap Forgot password"); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const googleSignIn = () => {
    showToast("Google Sign-In needs one more setup step in Firebase — coming very soon");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 24px", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ paddingTop: 40, paddingBottom: 20 }}>
        <IconBtn onClick={() => go("welcome")}><ChevronLeft size={20} color={C.text} /></IconBtn>
      </div>
      <AppLogo size={58} />
      <div style={{ color: C.text, fontSize: 23, fontWeight: 800, marginTop: 18 }}>Welcome back</div>
      <div style={{ color: C.sub, fontSize: 13.5, marginTop: 4, marginBottom: 26 }}>Log in to continue your progress</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <TextField icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
        <TextField icon={Lock} type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          rightEl={<button onClick={() => setShowPw((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer" }}>{showPw ? <EyeOff size={16} color={C.sub} /> : <Eye size={16} color={C.sub} />}</button>}
          error={error} />
      </div>

      <div style={{ textAlign: "right", marginTop: 10 }}>
        <button onClick={forgotPassword} style={{ background: "none", border: "none", color: C.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Forgot password?</button>
      </div>
      {resetSent && <div style={{ color: C.green, fontSize: 12, marginTop: 6, textAlign: "right" }}>Check your email for a link to reset your password.</div>}

      <div style={{ marginTop: 24 }}><GreenButton onClick={submit} disabled={busy}>{busy ? "Logging in…" : "Log In"}</GreenButton></div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: C.border }} /><span style={{ color: C.sub2, fontSize: 11.5 }}>OR</span><div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <GoogleButton onClick={googleSignIn} />

      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "center", paddingBottom: "calc(30px + env(safe-area-inset-bottom))", color: C.sub, fontSize: 13 }}>
        Don't have an account?{" "}
        <button onClick={() => go("signup")} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Sign Up</button>
      </div>
    </div>
  );
}

function SignUpScreen({ go, showToast, localLang }) {
  const { C } = useUI();
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
    if (!name.trim()) e.name = "Enter your name";
    if (!isValidEmail(email)) e.email = "Enter a valid email address";
    if (!phone.trim() || phone.trim().replace(/\D/g, "").length < 8) e.phone = "Enter a valid phone number";
    const issues = passwordIssues(password);
    if (issues.length) e.password = `Password needs: ${issues.join(", ")}`;
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const initial = freshState();
      initial.account.name = name.trim();
      initial.account.email = email.trim();
      initial.account.phone = phone.trim();
      initial.settings.language = localLang || "en";
      await setDoc(doc(db, "users", cred.user.uid), initial);
      showToast("Account created!");
      // Root component sees the new signed-in user and routes to onboarding automatically.
    } catch (err) {
      setErrors({ email: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = () => {
    showToast("Google Sign-In needs one more setup step in Firebase — coming very soon");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 24px", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ paddingTop: 40, paddingBottom: 20 }}>
        <IconBtn onClick={() => go("welcome")}><ChevronLeft size={20} color={C.text} /></IconBtn>
      </div>
      <div style={{ color: C.text, fontSize: 23, fontWeight: 800 }}>Create your account</div>
      <div style={{ color: C.sub, fontSize: 13.5, marginTop: 4, marginBottom: 22 }}>Start tracking your fitness journey</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <TextField icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" error={errors.name} />
        <TextField icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" error={errors.email} />
        <TextField icon={Phone} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" error={errors.phone} />
        <TextField icon={Lock} type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          rightEl={<button onClick={() => setShowPw((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer" }}>{showPw ? <EyeOff size={16} color={C.sub} /> : <Eye size={16} color={C.sub} />}</button>}
          error={errors.password} />
        <div style={{ color: C.sub2, fontSize: 11, marginTop: -8, marginLeft: 2 }}>Min 8 characters, 1 uppercase letter, 1 special character (e.g. !@#$)</div>
        <TextField icon={Lock} type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" error={errors.confirm} />
      </div>

      <div style={{ marginTop: 22 }}><GreenButton onClick={submit} disabled={busy}>{busy ? "Creating account…" : "Create Account"}</GreenButton></div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: C.border }} /><span style={{ color: C.sub2, fontSize: 11.5 }}>OR</span><div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <GoogleButton onClick={googleSignIn} />

      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "center", paddingBottom: "calc(30px + env(safe-area-inset-bottom))", color: C.sub, fontSize: 13 }}>
        Already have an account?{" "}
        <button onClick={() => go("login")} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Log In</button>
      </div>
    </div>
  );
}

/* ============================== ONBOARDING ============================== */
function GeneratingPlan({ steps, activeIdx }) {
  const { C } = useUI();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 30px", gap: 26 }}>
      <div style={{ position: "relative", width: 84, height: 84 }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", border: `4px solid ${C.card2}`, borderTopColor: C.green, animation: "spin 1s linear infinite" }} />
        <Sparkles size={30} color={C.green} style={{ position: "absolute", top: 27, left: 27 }} />
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 800, textAlign: "center" }}>Building your plan…</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= activeIdx ? 1 : 0.35 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < activeIdx ? C.green : i === activeIdx ? C.greenSoft : C.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: i === activeIdx ? `2px solid ${C.green}` : "none" }}>
              {i < activeIdx && <Check size={13} color={C.onAccent} />}
            </div>
            <span style={{ color: i <= activeIdx ? C.text : C.sub, fontSize: 13.5, fontWeight: i === activeIdx ? 700 : 500 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingScreen({ data, setData, go, showToast }) {
  const { C } = useUI();
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
  const genSteps = ["Analyzing your goal…", "Calculating your targets…", "Building your workout plan…", "Almost done…"];

  useEffect(() => {
    if (!generating) return;
    if (genIdx >= genSteps.length) {
      const t = setTimeout(() => go("app"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGenIdx((i) => i + 1), 650);
    return () => clearTimeout(t);
  }, [generating, genIdx]); // eslint-disable-line

  const steps = ["Gender", "Age", "Height", "Weight", "Goal", "Schedule"];
  const total = steps.length;

  const next = () => {
    setErr("");
    if (step === 0 && !gender) { setErr("Please select your gender"); return; }
    if (step === 1 && (!age || age < 10 || age > 100)) { setErr("Enter a valid age (10-100)"); return; }
    if (step === 2 && (!height || height < 100 || height > 250)) { setErr("Enter a valid height in cm"); return; }
    if (step === 3 && (!weight || weight < 30 || weight > 300)) { setErr("Enter a valid weight in kg"); return; }
    if (step === 4 && !goal) { setErr("Please choose a goal"); return; }
    if (step < total - 1) setStep(step + 1);
    else finish();
  };
  const prev = () => { setErr(""); if (step > 0) setStep(step - 1); };

  const finish = () => {
    const next = clone(data);
    next.account = { ...next.account, gender, age: Number(age), height: Number(height), goal, daysPerWeek: days };
    next.activePlanId = "beginner"; // everyone starts on the free fixed plan; goal is saved for their Pro plan later
    next.bodyWeight = [{ date: dateKey(0), weight: Number(weight) }];
    next.onboarded = true;
    setData(next);
    setGenerating(true);
  };

  if (generating) return <GeneratingPlan steps={genSteps} activeIdx={genIdx} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 24px calc(30px + env(safe-area-inset-bottom))", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ paddingTop: 32, paddingBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
        {step > 0 && <IconBtn onClick={prev}><ChevronLeft size={20} color={C.text} /></IconBtn>}
        <div style={{ flex: 1, display: "flex", gap: 5 }}>
          {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? C.green : C.border }} />)}
        </div>
      </div>
      <div style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>Step {step + 1} of {total}</div>

      <div style={{ flex: 1, marginTop: 6 }}>
        {step === 0 && (
          <div>
            <div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 20 }}>What's your gender?</div>
            <div style={{ display: "flex", gap: 12 }}>
              {["Male", "Female"].map((g) => (
                <button key={g} onClick={() => setGender(g)} style={{ flex: 1, padding: "26px 0", borderRadius: 16, cursor: "pointer", border: `1.5px solid ${gender === g ? C.green : C.border}`, background: gender === g ? C.greenSoft : C.card, color: C.text, fontWeight: 700, fontSize: 14.5 }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{g === "Male" ? "🙋‍♂️" : "🙋‍♀️"}</div>{g}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (<div><div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 20 }}>How old are you?</div><TextField type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age (years)" /></div>)}
        {step === 2 && (<div><div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 20 }}>What's your height?</div><TextField type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height (cm)" /></div>)}
        {step === 3 && (<div><div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 20 }}>What's your current weight?</div><TextField type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (kg)" /></div>)}
        {step === 4 && (
          <div>
            <div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 6 }}>What's your main goal?</div>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 16 }}>This helps us prepare your personalized Pro plan when you're ready to upgrade.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => setGoal(g.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 15, cursor: "pointer", border: `1.5px solid ${goal === g.id ? C.green : C.border}`, background: goal === g.id ? C.greenSoft : C.card, textAlign: "left" }}>
                  <div style={{ fontSize: 24 }}>{g.icon}</div>
                  <div><div style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>{g.label}</div><div style={{ color: C.sub, fontSize: 12 }}>{g.desc}</div></div>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div>
            <div style={{ color: C.text, fontSize: 21, fontWeight: 800, marginBottom: 20 }}>Workout days per week?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[3, 4, 5, 6].map((d) => (
                <button key={d} onClick={() => setDays(d)} style={{ width: 62, height: 62, borderRadius: 14, cursor: "pointer", border: `1.5px solid ${days === d ? C.green : C.border}`, background: days === d ? C.greenSoft : C.card, color: C.text, fontWeight: 800, fontSize: 17 }}>{d}</button>
              ))}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>You'll start on our free Standard Plan today — you can unlock a plan built around your goal anytime from Plans.</div>
          </div>
        )}
        {err && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 16 }}>{err}</div>}
      </div>
      <GreenButton onClick={next}>{step === total - 1 ? "Finish Setup" : "Continue"}</GreenButton>
    </div>
  );
}

/* ============================== HOME SCREEN ============================== */
function HomeScreen({ data, go }) {
  const { C } = useUI();
  const today = dateKey(0);
  const bw = data.bodyWeight;
  const weightSeries = bw.slice(-6).map((w) => ({ date: shortDate(w.date), kg: w.weight }));
  const currentWeight = bw[bw.length - 1]?.weight ?? 0;
  const monthAgo = [...bw].reverse().find((w) => w.date <= dateKey(-28));
  const weightDelta = monthAgo ? Number((currentWeight - monthAgo.weight).toFixed(1)) : 0;

  const dayName = DAYS[todayIdx];
  const activePlan = PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const dayTitle = activePlan.schedule[dayName].title;
  const { list: exercises } = getUsableExercises(data, dayName);
  const isRest = exercises.length === 0;

  const log = data.logs[today] || {};
  const totalSets = exercises.reduce((a, e) => a + e.targetSets, 0);
  const doneSets = exercises.reduce((a, e) => a + (log[e.id]?.sets?.filter((s) => s.done).length || 0), 0);
  const workoutPct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  const bench = strengthHistory(data, "bench_press");
  const benchDelta = bench.length >= 2 ? bench[bench.length - 1].weight - bench[bench.length - 2].weight : 0;
  const firstName = (data.account.name || "there").split(" ")[0];

  return (
    <div>
      <div style={{ height: "env(safe-area-inset-top)" }} />
      <div style={{ height: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 18px 4px" }}>
        <div>
          <div style={{ color: C.sub, fontSize: 13 }}>Good {greeting()},</div>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>{firstName} 💪</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <IconBtn onClick={() => go("reminders")}><Bell size={17} color={C.text} /></IconBtn>
          <div onClick={() => go("profile")} style={{ cursor: "pointer" }}><Avatar photo={data.account.photo} size={40} /></div>
        </div>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <Card onClick={() => go("bodyweight")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: C.sub, fontSize: 12.5 }}>Current Weight</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{currentWeight}</span>
                <span style={{ fontSize: 13, color: C.sub }}>kg</span>
              </div>
              <div style={{ fontSize: 11.5, color: weightDelta === 0 ? C.sub : C.green, marginTop: 4 }}>
                {weightDelta === 0 ? "No change" : `${weightDelta > 0 ? "↑" : "↓"} ${Math.abs(weightDelta)} last month`}
              </div>
            </div>
            {weightSeries.length > 1 && (
              <div style={{ width: 110, height: 46 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightSeries}><Line type="monotone" dataKey="kg" stroke={C.green} strokeWidth={2} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: C.sub, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                Today's Workout · {activePlan.name} {activePlan.pro && <ProBadge small />}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginTop: 3 }}>{dayTitle}</div>
              <div style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>{isRest ? "Recovery day" : `${exercises.length} Exercises`}</div>
            </div>
            {!isRest && <ProgressRing pct={workoutPct} />}
          </div>
          <div style={{ marginTop: 14 }}>
            <GreenButton disabled={isRest} onClick={() => go("workout")}>{isRest ? "Rest Day" : workoutPct > 0 ? "Continue Workout" : "Start Workout"}</GreenButton>
          </div>
        </Card>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <Card onClick={() => go("meals")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.sub, fontSize: 12.5 }}>Today's Nutrition</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 3 }}>{mealsPct(data, today)}% logged</div>
              <div style={{ color: C.sub2, fontSize: 11.5, marginTop: 2 }}>Tap to log meals</div>
            </div>
            <ProgressRing pct={mealsPct(data, today)} />
          </div>
        </Card>
      </div>

      {!data.entitlements.trainingPro && !data.entitlements.nutritionPro && (
        <div style={{ padding: "14px 18px 0" }}>
          <Card onClick={() => go("paywall")} style={{ background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={22} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>Unlock Fifty Pro</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>Personalized plans, full food tracking & more</div>
            </div>
            <ChevronRight size={18} color={C.sub2} />
          </Card>
        </div>
      )}

      <div style={{ padding: "18px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>Your Progress</span>
        <button onClick={() => go("progress")} style={{ background: "none", border: "none", color: C.sub, fontSize: 12.5, display: "flex", alignItems: "center", cursor: "pointer" }}>See All <ChevronRight size={14} /></button>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {bench.length > 0 ? <MiniProgressRow label="Bench Press" value={`${bench[bench.length - 1].weight} kg`} delta={benchDelta} /> : <MiniProgressRow label="Bench Press" value="Not logged yet" delta={null} />}
        <MiniProgressRow label="Body Weight" value={`${currentWeight} kg`} delta={weightDelta} />
      </div>
      <div style={{ height: 10 }} />
    </div>
  );
}
function greeting() { const h = new Date().getHours(); if (h < 12) return "Morning"; if (h < 18) return "Afternoon"; return "Evening"; }
function MiniProgressRow({ label, value, delta }) {
  const { C } = useUI();
  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px" }}>
      <div><div style={{ color: C.sub, fontSize: 12 }}>{label}</div><div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{value}</div></div>
      {delta !== null && <div style={{ color: delta >= 0 ? C.green : C.danger, fontSize: 12.5, fontWeight: 700 }}>{delta === 0 ? "—" : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)} kg`}</div>}
    </Card>
  );
}
function strengthHistory(data, exerciseId) {
  const out = [];
  Object.keys(data.logs).sort().forEach((date) => {
    const ex = data.logs[date]?.[exerciseId];
    const doneSets = ex?.sets?.filter((s) => s.done) || [];
    if (doneSets.length) out.push({ date, weight: Math.max(...doneSets.map((s) => Number(s.weight) || 0)) });
  });
  return out;
}
function mealsPct(data, date) {
  const m = data.meals[date] || {};
  const done = MEAL_ITEMS.filter((it) => m[it.id]?.items?.length > 0).length;
  return Math.round((done / MEAL_ITEMS.length) * 100);
}
function dayKcal(data, date) {
  const m = data.meals[date] || {};
  return MEAL_ITEMS.reduce((sum, it) => sum + (m[it.id]?.items || []).reduce((s, i) => s + i.kcal, 0), 0);
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
  return { protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fat: Math.round(totals.fat) };
}

/* ============================== WORKOUT SCREEN ============================== */
function WorkoutScreen({ data, setData, go, selectedDay, setSelectedDay, showToast }) {
  const { C } = useUI();
  const activePlan = PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const dayTitle = activePlan.schedule[selectedDay].title;
  const { list: exercises, lockedCount } = getUsableExercises(data, selectedDay);
  const today = dateKey(0);
  const log = data.logs[today] || {};
  const [showAdd, setShowAdd] = useState(false);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState("10-12");

  const removeExercise = (ex) => {
    const next = clone(data);
    if (!next.customPlan[selectedDay]) next.customPlan[selectedDay] = { added: [], removedIds: [] };
    const cp = next.customPlan[selectedDay];
    const isCustom = (cp.added || []).some((a) => a.id === ex.id);
    if (isCustom) cp.added = cp.added.filter((a) => a.id !== ex.id);
    else { if (!cp.removedIds) cp.removedIds = []; cp.removedIds.push(ex.id); }
    setData(next);
    showToast(`${ex.name} removed from today`);
  };

  const addCustomExercise = () => {
    if (!exName.trim()) { showToast("Enter an exercise name"); return; }
    const next = clone(data);
    if (!next.customPlan[selectedDay]) next.customPlan[selectedDay] = { added: [], removedIds: [] };
    next.customPlan[selectedDay].added.push({ id: uid(), name: exName.trim(), targetSets: Number(exSets) || 3, targetReps: exReps || "10-12", startWeight: 10 });
    setData(next);
    setExName(""); setExSets(3); setExReps("10-12"); setShowAdd(false);
    showToast("Exercise added");
  };

  return (
    <div>
      <TopBar title="Workout" />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {DAYS.map((d, i) => {
            const isSelected = d === selectedDay;
            const isToday = i === todayIdx;
            return (
              <button key={d} onClick={() => setSelectedDay(d)} style={{ minWidth: 44, padding: "10px 0", borderRadius: 12, cursor: "pointer", border: isToday && !isSelected ? `1px solid ${C.green}` : "1px solid transparent", background: isSelected ? C.green : C.card2, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: isSelected ? C.onAccent : C.sub, fontWeight: 600 }}>{d}</span>
                <span style={{ fontSize: 13, color: isSelected ? C.onAccent : C.text, fontWeight: 700 }}>{(() => { const dt = new Date(); dt.setDate(dt.getDate() - todayIdx + i); return dt.getDate(); })()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "18px 18px 6px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{dayTitle}</div>
        <div style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>{exercises.length} Exercises · {activePlan.name}</div>
      </div>

      <div style={{ padding: "6px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {exercises.length === 0 && lockedCount === 0 && (
          <Card style={{ textAlign: "center", padding: "30px 16px", color: C.sub }}>Rest day — recovery is part of the program. 🌙</Card>
        )}
        {exercises.map((ex, i) => {
          const exLog = log[ex.id];
          const done = exLog?.finished;
          return (
            <Card key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
              <div onClick={() => go("exercise", { exerciseId: ex.id, day: selectedDay })} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {done ? <Check size={20} color={C.green} /> : <span style={{ fontSize: 21 }}>{ex.emoji || "🏋️"}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>{i + 1}. {ex.name}</div>
                  <div style={{ color: C.sub, fontSize: 12 }}>{ex.targetSets} Sets</div>
                </div>
              </div>
              <button onClick={() => removeExercise(ex)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><Trash2 size={16} color={C.sub2} /></button>
              <ChevronRight size={18} color={C.sub2} onClick={() => go("exercise", { exerciseId: ex.id, day: selectedDay })} style={{ cursor: "pointer" }} />
            </Card>
          );
        })}

        {lockedCount > 0 && (
          <Card onClick={() => go("paywall")} style={{ display: "flex", alignItems: "center", gap: 12, background: C.goldSoft, border: `1px solid ${C.gold}55` }}>
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{lockedCount} more exercise{lockedCount > 1 ? "s" : ""} locked</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>Free plan is capped at {FREE_EXERCISE_CAP} exercises/day</div>
            </div>
            <ChevronRight size={16} color={C.sub2} />
          </Card>
        )}

        {showAdd ? (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Exercise name" />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><TextField type="number" value={exSets} onChange={(e) => setExSets(e.target.value)} placeholder="Sets" /></div>
              <div style={{ flex: 1 }}><TextField value={exReps} onChange={(e) => setExReps(e.target.value)} placeholder="Reps (e.g. 8-12)" /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <GreenButton variant="outline" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</GreenButton>
              <GreenButton onClick={addCustomExercise} style={{ flex: 1 }}>Add</GreenButton>
            </div>
          </Card>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ width: "100%", padding: "13px 0", borderRadius: 13, border: `1px dashed ${C.border}`, background: "transparent", color: C.green, fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={16} /> Add Your Own Exercise
          </button>
        )}
      </div>

      {exercises.length > 0 && (
        <div style={{ padding: "14px 18px 20px" }}>
          <GreenButton onClick={() => go("exercise", { exerciseId: exercises[0].id, day: selectedDay })}>Start Workout</GreenButton>
        </div>
      )}
    </div>
  );
}

/* ============================== EXERCISE DETAIL SCREEN ============================== */
function ExerciseScreen({ data, setData, back, exerciseId, day, showToast, awardXp }) {
  const { C } = useUI();
  const [tab, setTab] = useState("today");
  const { list: exercises } = getUsableExercises(data, day);
  const ex = exercises.find((e) => e.id === exerciseId) || getMergedExercises(data, day).find((e) => e.id === exerciseId);
  const today = dateKey(0);

  const existingLog = data.logs[today]?.[exerciseId];
  const sets = existingLog?.sets?.length ? existingLog.sets : Array.from({ length: ex.targetSets }, () => ({ weight: ex.startWeight, reps: 10, done: false }));

  const updateSets = (newSets, finished) => {
    const next = clone(data);
    if (!next.logs[today]) next.logs[today] = {};
    next.logs[today][exerciseId] = { sets: newSets, finished: finished ?? existingLog?.finished ?? false };
    setData(next);
  };
  const toggleDone = (idx) => updateSets(sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s)));
  const updateField = (idx, field, value) => updateSets(sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const addSet = () => { const last = sets[sets.length - 1]; updateSets([...sets, { weight: last?.weight ?? ex.startWeight, reps: last?.reps ?? 10, done: false }]); };
  const finish = () => { updateSets(sets, true); awardXp(35); showToast("Exercise saved!"); back(); };

  const history = Object.keys(data.logs).filter((d) => data.logs[d]?.[exerciseId]?.sets?.some((s) => s.done)).sort().reverse()
    .map((d) => { const doneSets = data.logs[d][exerciseId].sets.filter((s) => s.done); const top = doneSets.reduce((a, s) => (Number(s.weight) > Number(a.weight) ? s : a), doneSets[0]); return { date: d, weight: Number(top.weight), reps: Number(top.reps) }; });

  const chartData = history.slice(0, 8).reverse().map((h) => ({ date: shortDate(h.date), kg: h.weight }));
  const doneCount = sets.filter((s) => s.done).length;
  const lastTop = history[0];
  const suggestion = lastTop ? `${(lastTop.weight + 2.5).toFixed(1)} kg × ${lastTop.reps + 2} reps` : `${ex.startWeight} kg × 10 reps`;

  return (
    <div>
      <TopBar title={ex.name} onBack={back} right={<IconBtn><Info size={16} color={C.sub} /></IconBtn>} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 8, background: C.card2, padding: 4, borderRadius: 12, marginBottom: 16 }}>
          <Pill active={tab === "today"} onClick={() => setTab("today")}>Today</Pill>
          <Pill active={tab === "history"} onClick={() => setTab("history")}>History</Pill>
        </div>
      </div>

      {tab === "today" && (
        <div style={{ padding: "0 18px" }}>
          <Card style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 12, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><Target size={26} color={C.green} /></div>
            <div><div style={{ color: C.sub, fontSize: 12 }}>Target</div><div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{ex.targetSets} Sets x {ex.targetReps} Reps</div></div>
          </Card>

          <div style={{ display: "flex", color: C.sub, fontSize: 11.5, padding: "0 4px 8px", fontWeight: 600 }}>
            <div style={{ width: 30 }}>Set</div><div style={{ flex: 1 }}>Weight (kg)</div><div style={{ flex: 1 }}>Reps</div><div style={{ width: 40, textAlign: "center" }}>Done</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sets.map((s, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px" }}>
                <div style={{ width: 30, color: C.sub, fontWeight: 700 }}>{idx + 1}</div>
                <div style={{ flex: 1, paddingRight: 8 }}><input type="number" value={s.weight} onChange={(e) => updateField(idx, "weight", e.target.value)} style={inputBoxStyle(C)} /></div>
                <div style={{ flex: 1, paddingRight: 8 }}><input type="number" value={s.reps} onChange={(e) => updateField(idx, "reps", e.target.value)} style={inputBoxStyle(C)} /></div>
                <div style={{ width: 40, display: "flex", justifyContent: "center" }}>
                  <button onClick={() => toggleDone(idx)} style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${s.done ? C.green : C.border}`, background: s.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{s.done && <Check size={15} color={C.onAccent} />}</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addSet} style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 12, border: `1px dashed ${C.border}`, background: "transparent", color: C.green, fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={16} /> Add Set</button>

          <Card style={{ marginTop: 14, background: C.greenSoft, border: "none" }}>
            <div style={{ color: C.sub, fontSize: 12 }}>Next Time Suggestion</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}><span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{suggestion}</span><TrendingUp size={18} color={C.green} /></div>
          </Card>

          <div style={{ margin: "16px 0 20px" }}>
            <GreenButton onClick={finish} disabled={doneCount === 0}>Finish Exercise {doneCount > 0 && `(${doneCount}/${sets.length})`}</GreenButton>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "0 18px 20px" }}>
          {chartData.length > 1 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Progress Over Time</div>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="date" stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} width={26} />
                    <Tooltip contentStyle={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="kg" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {history.length === 0 && <Card style={{ textAlign: "center", padding: 30, color: C.sub }}>No history yet for this exercise.</Card>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((h) => (
              <Card key={h.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.text, fontWeight: 600, fontSize: 13.5 }}>{fmtDate(h.date)}</span>
                <span style={{ color: C.sub, fontSize: 13 }}>{h.weight} kg × {h.reps} reps</span>
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
  const { C } = useUI();
  const [tab, setTab] = useState("strength");
  const pro = data.entitlements.trainingPro;

  const exercisePool = useMemo(() => {
    const map = new Map();
    Object.values(PLAN_TEMPLATES).forEach((p) => Object.values(p.schedule).forEach((d) => d.exercises.forEach((e) => map.set(e.id, e))));
    return map;
  }, []);

  const strengthRows = [];
  exercisePool.forEach((ex, id) => {
    const hist = strengthHistory(data, id);
    if (hist.length) strengthRows.push({ name: ex.name, from: hist[0].weight, to: hist[hist.length - 1].weight });
  });

  const bw = pro ? data.bodyWeight : data.bodyWeight.filter((w) => monthKey(w.date) === monthKey(dateKey(0)));

  const today = dateKey(0);
  const thisWeekStart = mondayOf(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const thisWeekCount = setsCompletedInRange(data, thisWeekStart, today);
  const lastWeekCount = setsCompletedInRange(data, lastWeekStart, lastWeekEnd);

  const yesterday = dateKey(-1);
  const dayBefore = dateKey(-2);
  const yestCount = setsCompletedInRange(data, yesterday, yesterday);
  const dayBeforeCount = setsCompletedInRange(data, dayBefore, dayBefore);

  const thisMonthCount = setsCompletedInRange(data, monthKey(today) + "-01", today);
  const lastMonthDate = addDays(monthKey(today) + "-01", -1);
  const lastMonthCount = setsCompletedInRange(data, monthKey(lastMonthDate) + "-01", lastMonthDate);

  return (
    <div>
      <TopBar title="Progress" />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 8, background: C.card2, padding: 4, borderRadius: 12, marginBottom: 16 }}>
          <Pill active={tab === "strength"} onClick={() => setTab("strength")}>Strength</Pill>
          <Pill active={tab === "bodyweight"} onClick={() => setTab("bodyweight")}>Body Weight</Pill>
        </div>
      </div>

      {tab === "strength" && (
        <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Card>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>This Week vs Last Week</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ color: C.sub, fontSize: 11.5 }}>Sets completed</div><div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{thisWeekCount} <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>vs {lastWeekCount}</span></div></div>
              <div style={{ color: thisWeekCount >= lastWeekCount ? C.green : C.danger, fontWeight: 700, fontSize: 13 }}>{thisWeekCount >= lastWeekCount ? "↑" : "↓"} {Math.abs(thisWeekCount - lastWeekCount)}</div>
            </div>
          </Card>

          {pro ? (
            <>
              <Card>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Yesterday vs Day Before</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{yestCount} <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>vs {dayBeforeCount}</span></div>
                  <div style={{ color: yestCount >= dayBeforeCount ? C.green : C.danger, fontWeight: 700, fontSize: 13 }}>{yestCount >= dayBeforeCount ? "↑" : "↓"} {Math.abs(yestCount - dayBeforeCount)}</div>
                </div>
              </Card>
              <Card>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>This Month vs Last Month</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{thisMonthCount} <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>vs {lastMonthCount}</span></div>
                  <div style={{ color: thisMonthCount >= lastMonthCount ? C.green : C.danger, fontWeight: 700, fontSize: 13 }}>{thisMonthCount >= lastMonthCount ? "↑" : "↓"} {Math.abs(thisMonthCount - lastMonthCount)}</div>
                </div>
              </Card>
            </>
          ) : (
            <Card onClick={() => go("paywall")} style={{ background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
              <Crown size={20} color={C.gold} />
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Daily & monthly comparisons</div>
                <div style={{ color: C.sub, fontSize: 11.5 }}>Unlock with Training Pro</div>
              </div>
              <ChevronRight size={16} color={C.sub2} />
            </Card>
          )}

          {strengthRows.length === 0 && <Card style={{ textAlign: "center", padding: 30, color: C.sub }}>Log some sets in Workout to see your strength progress here.</Card>}
          {strengthRows.map((r) => {
            const delta = r.to - r.from;
            const pct = Math.min(100, Math.max(8, (r.to / (r.to + 40)) * 100));
            return (
              <Card key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{r.name}</span>
                  <span style={{ color: delta >= 0 ? C.green : C.danger, fontWeight: 700, fontSize: 12.5 }}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} kg</span>
                </div>
                <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>{r.from} kg → {r.to} kg</div>
                <div style={{ height: 6, background: C.card2, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.green, borderRadius: 4 }} /></div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "bodyweight" && (
        <div style={{ padding: "0 18px" }}>
          {!pro && (
            <Card onClick={() => go("paywall")} style={{ marginBottom: 12, background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
              <Crown size={20} color={C.gold} />
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Free plan keeps only this month's history</div>
                <div style={{ color: C.sub, fontSize: 11.5 }}>Upgrade to Training Pro to keep it all</div>
              </div>
              <ChevronRight size={16} color={C.sub2} />
            </Card>
          )}
          <Card>
            {bw.length > 1 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bw.map((w) => ({ date: shortDate(w.date), kg: w.weight }))}>
                    <defs><linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.35} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="date" stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} width={26} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip contentStyle={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="kg" stroke={C.green} strokeWidth={2.5} fill="url(#bwGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (<div style={{ textAlign: "center", padding: 20, color: C.sub, fontSize: 13 }}>Log a couple more weigh-ins to see your trend.</div>)}
          </Card>
          <div style={{ marginTop: 12 }}><GreenButton onClick={() => go("bodyweight")}>Log New Weight</GreenButton></div>
        </div>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ============================== BODY WEIGHT SCREEN ============================== */
function BodyWeightScreen({ data, setData, back, showToast, go }) {
  const { C } = useUI();
  const [view, setView] = useState("graph");
  const [newWeight, setNewWeight] = useState(data.bodyWeight[data.bodyWeight.length - 1]?.weight ?? 70);
  const pro = data.entitlements.trainingPro;

  const allSorted = [...data.bodyWeight].sort((a, b) => (a.date < b.date ? -1 : 1));
  const sorted = pro ? allSorted : allSorted.filter((w) => monthKey(w.date) === monthKey(dateKey(0)));
  const current = allSorted[allSorted.length - 1];
  const monthAgo = [...allSorted].reverse().find((w) => w.date <= dateKey(-28));
  const delta = current && monthAgo ? Number((current.weight - monthAgo.weight).toFixed(1)) : 0;

  const save = () => {
    const today = dateKey(0);
    const val = Number(newWeight);
    if (!val || val < 20 || val > 400) { showToast("Enter a valid weight"); return; }
    const next = clone(data);
    const idx = next.bodyWeight.findIndex((w) => w.date === today);
    if (idx >= 0) next.bodyWeight[idx].weight = val;
    else next.bodyWeight.push({ date: today, weight: val });
    if (!next.entitlements.trainingPro) {
      const curMonth = monthKey(today);
      next.bodyWeight = next.bodyWeight.filter((w) => monthKey(w.date) === curMonth);
    }
    next.bodyWeight.sort((a, b) => (a.date < b.date ? -1 : 1));
    setData(next);
    showToast(`Weight logged: ${val} kg`);
  };

  return (
    <div>
      <TopBar title="Body Weight" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 8, background: C.card2, padding: 4, borderRadius: 12, marginBottom: 16 }}>
          <Pill active={view === "graph"} onClick={() => setView("graph")}>Graph</Pill>
          <Pill active={view === "list"} onClick={() => setView("list")}>List</Pill>
        </div>

        {!pro && (
          <Card onClick={() => go("paywall")} style={{ marginBottom: 14, background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
            <Crown size={17} color={C.gold} />
            <span style={{ flex: 1, color: C.text, fontSize: 12, fontWeight: 600 }}>Free plan keeps this month only — upgrade for full history</span>
          </Card>
        )}

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, color: C.text }}>{current?.weight ?? 0} <span style={{ fontSize: 15, color: C.sub, fontWeight: 500 }}>kg</span></div>
            <div style={{ color: C.sub, fontSize: 12 }}>{current ? fmtDate(current.date) : "No entries yet"}</div>
          </div>
          {monthAgo && <div style={{ color: delta === 0 ? C.sub : delta > 0 ? C.green : C.danger, fontSize: 13, fontWeight: 700 }}>{delta === 0 ? "No change" : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} vs last month`}</div>}
        </div>

        {view === "graph" ? (
          <Card style={{ marginTop: 10 }}>
            {sorted.length > 1 ? (
              <div style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sorted.map((w) => ({ date: shortDate(w.date), kg: w.weight }))}>
                    <defs><linearGradient id="bwGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.35} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="date" stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={C.sub2} fontSize={10} tickLine={false} axisLine={false} width={26} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip contentStyle={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="kg" stroke={C.green} strokeWidth={2.5} fill="url(#bwGrad2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (<div style={{ textAlign: "center", padding: 20, color: C.sub, fontSize: 13 }}>Add a few weigh-ins to see your trend here.</div>)}
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {sorted.length === 0 && <Card style={{ textAlign: "center", padding: 24, color: C.sub }}>No entries yet.</Card>}
            {[...sorted].reverse().map((w) => (
              <Card key={w.date} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
                <span style={{ color: C.sub, fontSize: 13 }}>{fmtDate(w.date)}</span>
                <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{w.weight} kg</span>
              </Card>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, color: C.sub, fontSize: 12.5, fontWeight: 600 }}>Add New Weight</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, fontWeight: 700, width: "70%" }} />
            <span style={{ color: C.sub, fontSize: 13 }}>kg</span>
          </div>
        </div>
        <div style={{ marginTop: 12, marginBottom: 20 }}><GreenButton onClick={save}>Save</GreenButton></div>
      </div>
    </div>
  );
}

/* ============================== MEALS SCREEN ============================== */
function MealsScreen({ data, setData, back, showToast, go }) {
  const { C } = useUI();
  const today = dateKey(0);
  const pro = data.entitlements.nutritionPro;
  const meals = data.meals[today] || {};
  const pct = mealsPct(data, today);
  const totalKcal = dayKcal(data, today);
  const macros = dayMacros(data, today);
  const plan = data.nutritionPlan;

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
    <div>
      <TopBar title="Nutrition" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressRing pct={pct} size={62} stroke={6} />
          <div>
            <div style={{ color: C.text, fontSize: 20, fontWeight: 800 }}>{totalKcal} kcal</div>
            <div style={{ color: C.sub, fontSize: 12.5 }}>{pct}% of today's meals logged</div>
            <div style={{ color: C.sub2, fontSize: 11, marginTop: 3 }}>P {macros.protein}g · C {macros.carbs}g · F {macros.fat}g</div>
          </div>
        </Card>

        {pro && plan ? (
          <Card onClick={markPlanSeen} style={{ marginTop: 14, background: C.greenSoft, border: `1px solid ${C.green}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Sparkles size={18} color={C.green} />
              <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>Your Personalized Diet Plan</span>
              {plan.unread && <span style={{ background: C.green, color: C.onAccent, fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 20 }}>NEW</span>}
            </div>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>Target: {plan.targetKcal} kcal · P {plan.targetProtein}g · C {plan.targetCarbs}g · F {plan.targetFat}g</div>
            <div style={{ color: C.text, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{plan.notes}</div>
          </Card>
        ) : (
          <Card onClick={() => go("paywall")} style={{ marginTop: 14, background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Get a full diet plan made for you</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>Personalized by your goal & body — Nutrition Pro</div>
            </div>
            <ChevronRight size={16} color={C.sub2} />
          </Card>
        )}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {MEAL_ITEMS.map((m) => {
            const Icon = m.icon;
            const items = meals[m.id]?.items || [];
            const mealKcal = items.reduce((s, i) => s + i.kcal, 0);
            return (
              <Card key={m.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: items.length ? 10 : 0 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: items.length ? C.greenSoft : C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} color={items.length ? C.green : C.sub} /></div>
                  <div style={{ flex: 1 }}><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{m.name}</div><div style={{ color: C.sub, fontSize: 12 }}>{items.length ? `${mealKcal} kcal · ${items.length} item${items.length > 1 ? "s" : ""}` : "No food logged"}</div></div>
                  <button onClick={() => go("foodPicker", { mealId: m.id })} style={{ background: C.card2, border: "none", borderRadius: 9, padding: "8px 12px", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /> Add</button>
                </div>
                {items.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card2, borderRadius: 9, padding: "8px 10px" }}>
                        <div>
                          <div style={{ color: C.text, fontSize: 12.5 }}>{it.name} · {it.grams}g</div>
                          <div style={{ color: C.sub2, fontSize: 10.5, marginTop: 1 }}>P {it.protein ?? 0}g · C {it.carbs ?? 0}g · F {it.fat ?? 0}g</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: C.sub, fontSize: 12 }}>{it.kcal} kcal</span>
                          <button onClick={() => removeItem(m.id, idx)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color={C.sub2} /></button>
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
  const { C } = useUI();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);
  const today = dateKey(0);

  const results = FOOD_DB.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  const mealName = MEAL_ITEMS.find((m) => m.id === mealId)?.name || "Meal";
  const scale = selected ? Number(grams || 0) / 100 : 0;
  const kcalPreview = selected ? Math.round(selected.kcal * scale) : 0;
  const proteinPreview = selected ? Math.round(selected.protein * scale) : 0;
  const carbsPreview = selected ? Math.round(selected.carbs * scale) : 0;
  const fatPreview = selected ? Math.round(selected.fat * scale) : 0;

  const addItem = () => {
    if (!selected || !grams || grams <= 0) { showToast("Enter a valid amount"); return; }
    const next = clone(data);
    if (!next.meals[today]) next.meals[today] = {};
    if (!next.meals[today][mealId]) next.meals[today][mealId] = { items: [] };
    if (!next.meals[today][mealId].items) next.meals[today][mealId].items = [];
    next.meals[today][mealId].items.push({
      name: selected.name, grams: Number(grams),
      kcal: kcalPreview, protein: proteinPreview, carbs: carbsPreview, fat: fatPreview,
    });
    setData(next);
    showToast(`${selected.name} added to ${mealName}`);
    setSelected(null); setGrams(100); setQuery("");
  };

  return (
    <div>
      <TopBar title={`Add to ${mealName}`} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <TextField icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods (e.g. rice, chicken, potato)" />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, paddingBottom: selected ? 170 : 20 }}>
          {results.map((f) => (
            <Card key={f.id} onClick={() => setSelected(f)} style={{ padding: "12px 14px", border: selected?.id === f.id ? `1.5px solid ${C.green}` : `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>{f.name}</span>
                <span style={{ color: C.sub, fontSize: 12 }}>{f.kcal} kcal/100g</span>
              </div>
              <div style={{ color: C.sub2, fontSize: 11, marginTop: 4 }}>P {f.protein}g · C {f.carbs}g · F {f.fat}g</div>
            </Card>
          ))}
          {results.length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 20 }}>No foods match "{query}"</div>}
        </div>
      </div>

      {selected && (
        <div style={{ position: "sticky", bottom: 0, background: C.card, borderTop: `1px solid ${C.border}`, padding: "14px 18px calc(14px + env(safe-area-inset-bottom))", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{selected.name}</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={C.sub2} /></button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
                <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
                <span style={{ color: C.sub, fontSize: 12.5 }}>grams</span>
              </div>
            </div>
            <div style={{ color: C.green, fontWeight: 800, fontSize: 15, minWidth: 76, textAlign: "right" }}>{kcalPreview} kcal</div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "flex-end", color: C.sub, fontSize: 11.5 }}>
            <span>Protein {proteinPreview}g</span><span>Carbs {carbsPreview}g</span><span>Fat {fatPreview}g</span>
          </div>
          <div style={{ marginTop: 12 }}><GreenButton onClick={addItem}>Add to Meal</GreenButton></div>
        </div>
      )}
    </div>
  );
}

/* ============================== PLANS SCREEN ============================== */
function PlansScreen({ data, setData, go, showToast }) {
  const { C } = useUI();
  const pro = data.entitlements.trainingPro;
  return (
    <div>
      <TopBar title="Plans" />
      <div style={{ padding: "0 18px 4px", color: C.sub, fontSize: 12.5 }}>The Standard Plan is free forever. Personalized plans need Training Pro.</div>
      <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.values(PLAN_TEMPLATES).map((p) => {
          const isActive = data.activePlanId === p.id;
          const locked = p.pro && !pro;
          return (
            <Card key={p.id} onClick={() => (locked ? go("paywall") : go("planDetail", { planId: p.id }))} style={{ display: "flex", alignItems: "center", gap: 12, border: isActive ? `1.5px solid ${C.green}` : `1px solid ${C.border}`, opacity: locked ? 0.9 : 1 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>{p.name} {p.pro && <ProBadge small />}</div>
                <div style={{ color: C.sub, fontSize: 12 }}>{p.tagline}</div>
                {isActive && <div style={{ color: C.green, fontSize: 11, fontWeight: 700, marginTop: 3 }}>✓ Active Plan</div>}
              </div>
              {locked ? <Crown size={16} color={C.gold} /> : <ChevronRight size={18} color={C.sub2} />}
            </Card>
          );
        })}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

function PlanDetailScreen({ data, setData, back, planId, showToast }) {
  const { C } = useUI();
  const [day, setDay] = useState(DAYS[todayIdx]);
  const plan = PLAN_TEMPLATES[planId];
  const isActive = data.activePlanId === planId;
  const daySchedule = plan.schedule[day];

  const use = () => { const next = clone(data); next.activePlanId = planId; setData(next); showToast(`${plan.name} is now your active plan`); };

  return (
    <div>
      <TopBar title={plan.name} onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>{plan.icon}</div>
          <div><div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{plan.name}</div><div style={{ color: C.sub, fontSize: 12 }}>{plan.tagline}</div></div>
        </Card>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
          {DAYS.map((d) => (<button key={d} onClick={() => setDay(d)} style={{ minWidth: 46, padding: "8px 0", borderRadius: 10, cursor: "pointer", border: "none", background: day === d ? C.green : C.card2, color: day === d ? C.onAccent : C.sub, fontWeight: 700, fontSize: 12 }}>{d}</button>))}
        </div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{daySchedule.title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {daySchedule.exercises.length === 0 && <Card style={{ textAlign: "center", padding: 20, color: C.sub }}>Rest day</Card>}
          {daySchedule.exercises.map((ex, i) => (
            <Card key={ex.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontSize: 12.5, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ flex: 1, color: C.text, fontSize: 13.5, fontWeight: 600 }}>{ex.name}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>{ex.targetSets} × {ex.targetReps}</div>
            </Card>
          ))}
        </div>
        <div style={{ margin: "18px 0 20px" }}><GreenButton onClick={use} disabled={isActive}>{isActive ? "This Is Your Active Plan" : "Use This Plan"}</GreenButton></div>
      </div>
    </div>
  );
}

/* ============================== PAYWALL ============================== */
function PaywallScreen({ data, setData, back, showToast }) {
  const { C } = useUI();
  const purchase = async (type) => {
    const next = clone(data);
    if (type === "nutrition" || type === "both") next.entitlements.nutritionPro = true;
    if (type === "training" || type === "both") next.entitlements.trainingPro = true;
    next.entitlements.proExpiresAt = dateKey(30); // 1-month subscription
    setData(next);
    try { await scheduleSubscriptionExpiryReminder(next.entitlements.proExpiresAt); } catch (e) { /* not on native yet */ }
    showToast("Unlocked for 30 days! (demo purchase)");
    back();
  };
  const options = [
    { id: "training", title: "Training Pro", price: "100 EGP / month", features: ["Unlimited exercises per workout day", "Personalized workout plan by your goal, weight & height", "Full body-weight history, never deleted", "Daily & monthly progress comparisons"] },
    { id: "nutrition", title: "Nutrition Pro", price: "100 EGP / month", features: ["A complete diet plan built for your body & goal", "Exact daily targets for calories, protein, carbs & fat", "Updated as your weight and goal change"] },
    { id: "both", title: "Training + Nutrition", price: "150 EGP / month", best: true, features: ["Everything in both plans above", "Best value — save 50 EGP"] },
  ];
  return (
    <div>
      <TopBar title="Fifty Pro" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Crown size={30} color={C.gold} />
          <div style={{ color: C.text, fontSize: 18, fontWeight: 800, marginTop: 8 }}>Get more out of Fifty</div>
          <div style={{ color: C.sub, fontSize: 12.5, marginTop: 4 }}>Billed monthly, cancel anytime</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {options.map((o) => (
            <Card key={o.id} style={{ border: o.best ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`, position: "relative" }}>
              {o.best && <div style={{ position: "absolute", top: -10, right: 14, background: C.gold, color: "#1a1200", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>BEST VALUE</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{o.title}</span>
                <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>{o.price}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {o.features.map((f) => (<div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}><Check size={14} color={C.green} style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.4 }}>{f}</span></div>))}
              </div>
              <GreenButton onClick={() => purchase(o.id)} variant={o.best ? "solid" : "outline"}>Unlock {o.title}</GreenButton>
            </Card>
          ))}
        </div>
        <div style={{ textAlign: "center", color: C.sub2, fontSize: 11, margin: "16px 0 20px", lineHeight: 1.6 }}>
          Purchases are simulated in this preview. A production release needs Google Play Billing / RevenueCat configured in the native app.
        </div>
      </div>
    </div>
  );
}

/* ============================== PROFILE SCREEN ============================== */
function ProfileScreen({ data, go, isAdmin }) {
  const { C } = useUI();
  const p = data.profile;
  const pct = Math.round((p.xp / p.xpMax) * 100);
  const pro = data.entitlements.trainingPro || data.entitlements.nutritionPro;
  const menu = [
    { icon: UserCircle, label: "Personal Information", to: "personalInfo" },
    { icon: Target, label: "Goals", to: "goals" },
    { icon: Ruler, label: "My Measurements", to: "measurements" },
    { icon: Bell, label: "Reminders", to: "reminders" },
    { icon: SettingsIcon, label: "Settings", to: "settings" },
    { icon: HelpCircle, label: "Help & Support", to: "help" },
    ...(isAdmin ? [{ icon: Shield, label: "Admin", to: "admin" }] : []),
  ];
  return (
    <div>
      <TopBar title="Profile" right={<IconBtn onClick={() => go("settings")}><SettingsIcon size={16} color={C.sub} /></IconBtn>} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Avatar photo={data.account.photo} size={92} />
        <div style={{ color: C.text, fontSize: 19, fontWeight: 800, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>{data.account.name || "Athlete"} {pro && <ProBadge small />}</div>
        <div style={{ color: C.sub, fontSize: 12.5 }}>{data.account.email}</div>
        <div style={{ width: "100%", marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span style={{ color: C.text, fontWeight: 700 }}>Level {p.level}</span><span style={{ color: C.sub }}>{p.xp} / {p.xpMax} XP</span></div>
          <div style={{ height: 8, background: C.card2, borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: C.green, borderRadius: 5 }} /></div>
        </div>
      </div>

      {pro ? (
        <div style={{ padding: "16px 18px 0" }}>
          <Card onClick={() => go("paywall")} style={{ background: C.greenSoft, border: `1px solid ${C.green}55`, display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>Pro is active</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>{daysUntil(data.entitlements.proExpiresAt)} days left this month</div>
            </div>
            <ChevronRight size={16} color={C.sub2} />
          </Card>
        </div>
      ) : (
        <div style={{ padding: "16px 18px 0" }}>
          <Card onClick={() => go("paywall")} style={{ background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}><div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>Upgrade to Pro</div><div style={{ color: C.sub, fontSize: 11.5 }}>Unlock personalized plans & full food tracking</div></div>
            <ChevronRight size={16} color={C.sub2} />
          </Card>
        </div>
      )}

      <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {menu.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} onClick={() => go(m.to)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
              <Icon size={18} color={C.sub} /><span style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}>{m.label}</span><ChevronRight size={16} color={C.sub2} />
            </Card>
          );
        })}
        <Card onClick={() => go("logout")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
          <LogOut size={18} color={C.danger} /><span style={{ flex: 1, color: C.danger, fontSize: 14, fontWeight: 600 }}>Logout</span>
        </Card>
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ============================== PERSONAL INFO / GOALS / MEASUREMENTS ============================== */
function PersonalInfoScreen({ data, setData, back, showToast }) {
  const { C } = useUI();
  const [name, setName] = useState(data.account.name);
  const [gender, setGender] = useState(data.account.gender);
  const [age, setAge] = useState(data.account.age);
  const [height, setHeight] = useState(data.account.height);
  const [photo, setPhoto] = useState(data.account.photo);
  const fileRef = useRef(null);

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please choose an image file"); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.onerror = () => showToast("Couldn't load that photo");
    reader.readAsDataURL(file);
  };

  const save = () => {
    const next = clone(data);
    next.account = { ...next.account, name, gender, age: Number(age), height: Number(height), photo };
    setData(next);
    showToast("Profile updated");
    back();
  };

  return (
    <div>
      <TopBar title="Personal Information" onBack={back} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <div style={{ position: "relative" }}>
            <Avatar photo={photo} size={84} />
            <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: -2, right: -2, width: 30, height: 30, borderRadius: "50%", background: C.green, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Camera size={14} color={C.onAccent} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} style={{ display: "none" }} />
          </div>
        </div>
        <div><div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Name</div><TextField icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
        <div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Gender</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["Male", "Female"].map((g) => (<button key={g} onClick={() => setGender(g)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${gender === g ? C.green : C.border}`, background: gender === g ? C.greenSoft : C.card, color: C.text, fontWeight: 700, fontSize: 13.5 }}>{g}</button>))}
          </div>
        </div>
        <div><div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Age</div><TextField type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" /></div>
        <div><div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Height (cm)</div><TextField type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height" /></div>
        <div style={{ marginTop: 6, marginBottom: 20 }}><GreenButton onClick={save}>Save Changes</GreenButton></div>
      </div>
    </div>
  );
}

function GoalsScreen({ data, setData, back, showToast }) {
  const { C } = useUI();
  const [goal, setGoal] = useState(data.account.goal);
  const pro = data.entitlements.trainingPro;
  const save = () => {
    const chosen = GOALS.find((g) => g.id === goal);
    const next = clone(data);
    next.account.goal = goal;
    if (pro && chosen) next.activePlanId = chosen.planId;
    setData(next);
    showToast(pro ? "Goal & plan updated" : "Goal saved — unlock Training Pro for a plan built around it");
    back();
  };
  return (
    <div>
      <TopBar title="Goals" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GOALS.map((g) => (
            <button key={g.id} onClick={() => setGoal(g.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 15, cursor: "pointer", border: `1.5px solid ${goal === g.id ? C.green : C.border}`, background: goal === g.id ? C.greenSoft : C.card, textAlign: "left" }}>
              <div style={{ fontSize: 24 }}>{g.icon}</div>
              <div><div style={{ color: C.text, fontWeight: 700, fontSize: 14.5 }}>{g.label}</div><div style={{ color: C.sub, fontSize: 12 }}>{g.desc}</div></div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, marginBottom: 20 }}><GreenButton onClick={save}>Save Goal</GreenButton></div>
      </div>
    </div>
  );
}

function MeasurementsScreen({ data, back, go }) {
  const { C } = useUI();
  const current = data.bodyWeight[data.bodyWeight.length - 1];
  const bmi = bmiInfo(current?.weight, data.account.height);
  return (
    <div>
      <TopBar title="My Measurements" onBack={back} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.sub, fontSize: 13 }}>Height</span><span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{data.account.height || "—"} cm</span></Card>
        <Card style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.sub, fontSize: 13 }}>Weight</span><span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{current?.weight ?? "—"} kg</span></Card>
        {bmi && (<Card><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: C.sub, fontSize: 13 }}>BMI</span><span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{bmi.bmi}</span></div><div style={{ color: C.green, fontSize: 12.5, fontWeight: 600 }}>{bmi.cat}</div></Card>)}
        <GreenButton variant="outline" onClick={() => go("bodyweight")}>Update Weight</GreenButton>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== REMINDERS ============================== */
function RemindersScreen({ data, setData, back, showToast }) {
  const { C } = useUI();
  const [time, setTime] = useState(data.settings.reminderTime);
  const [on, setOn] = useState(data.settings.notifications);
  const [busy, setBusy] = useState(false);

  const requestPermission = async () => {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") { showToast("Notification permission was denied — enable it in your phone's app settings"); return false; }
      return true;
    } catch (e) { showToast("Notifications aren't available here — this needs the installed Android app"); return false; }
  };

  const handleToggle = async () => {
    if (!on) { const granted = await requestPermission(); if (!granted) return; }
    setOn((s) => !s);
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") { const granted = await requestPermission(); if (!granted) { setBusy(false); return; } }
      await LocalNotifications.schedule({
        notifications: [{ id: 9999, title: "Fifty", body: "Don't forget today's workout! 💪", schedule: { at: new Date(Date.now() + 3000) } }],
      });
      showToast("Test notification will appear in a few seconds");
    } catch (e) {
      showToast("Couldn't schedule a test notification — this needs the installed Android app");
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
    } catch (e) { /* not running in the native app yet — settings still saved */ }
    showToast(on ? `Daily reminder set for ${time}` : "Reminders turned off");
    back();
  };

  return (
    <div>
      <TopBar title="Reminders" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Daily Workout Reminder</div><div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>Get nudged to log your session</div></div>
          <ToggleSwitch on={on} onClick={handleToggle} />
        </Card>
        {on && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>Reminder Time</div>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: "100%", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none" }} />
            <div style={{ marginTop: 10 }}><GreenButton variant="outline" onClick={sendTest} disabled={busy}>{busy ? "Sending…" : "Send Test Notification"}</GreenButton></div>
          </Card>
        )}
        <GreenButton onClick={save}>Save</GreenButton>
      </div>
    </div>
  );
}

/* ============================== HELP ============================== */
function HelpScreen({ back, showToast }) {
  const { C } = useUI();
  const faqs = [
    { q: "How is my workout percentage calculated?", a: "It's the number of sets you marked done divided by the total sets planned for that day's exercises." },
    { q: "How is my meal percentage calculated?", a: "Each of the 4 daily meals you log counts as 25% of your daily nutrition tracking." },
    { q: "Can I change my active plan?", a: "Yes — go to Plans, open any plan, and tap 'Use This Plan'." },
    { q: "What's the difference between Free and Pro?", a: "Free gives you 4 exercises/day, one fixed plan, this month's weight history and a weekly comparison. Pro unlocks personalized plans, full food tracking, unlimited exercises and full history." },
  ];
  const openWhatsApp = () => {
    try { window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank"); }
    catch (e) { showToast("Couldn't open WhatsApp — try again"); }
  };
  return (
    <div>
      <TopBar title="Help & Support" onBack={back} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Card onClick={openWhatsApp} style={{ display: "flex", alignItems: "center", gap: 16, padding: 20, background: "rgba(37,211,102,0.14)", border: "1.5px solid rgba(37,211,102,0.5)" }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MessageCircle size={30} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Chat with us on WhatsApp</div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>We usually reply within a few hours</div>
            <div style={{ color: "#25D366", fontSize: 13, fontWeight: 700, marginTop: 4 }}>+{WHATSAPP_NUMBER}</div>
          </div>
          <ChevronRight size={20} color={C.sub2} />
        </Card>
        {faqs.map((f) => (
          <Card key={f.q}><div style={{ color: C.text, fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{f.q}</div><div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.6 }}>{f.a}</div></Card>
        ))}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== SETTINGS ============================== */
function SettingsScreen({ data, setData, back, go, showToast }) {
  const { C } = useUI();
  const setTheme = (mode) => { const next = clone(data); next.settings.theme = mode; setData(next); };
  const toggleNotif = () => { const next = clone(data); next.settings.notifications = !next.settings.notifications; setData(next); };

  return (
    <div>
      <TopBar title="Settings" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>APPEARANCE</div>
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setTheme("dark")} style={{ flex: 1, padding: "16px 0", borderRadius: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: `1.5px solid ${data.settings.theme === "dark" ? C.green : C.border}`, background: data.settings.theme === "dark" ? C.greenSoft : "transparent" }}>
              <MoonIcon size={20} color={C.text} /><span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Dark</span>
            </button>
            <button onClick={() => setTheme("light")} style={{ flex: 1, padding: "16px 0", borderRadius: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: `1.5px solid ${data.settings.theme === "light" ? C.green : C.border}`, background: data.settings.theme === "light" ? C.greenSoft : "transparent" }}>
              <Sunrise size={20} color={C.text} /><span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Light</span>
            </button>
          </div>
        </Card>

        <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>NOTIFICATIONS</div>
        <Card style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Push Notifications</div><div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>Reminders & progress updates</div></div>
          <ToggleSwitch on={data.settings.notifications} onClick={toggleNotif} />
        </Card>

        <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>ACCOUNT</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          <Card onClick={() => go("personalInfo")} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UserCircle size={18} color={C.sub} /><span style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}>Edit Personal Information</span><ChevronRight size={16} color={C.sub2} />
          </Card>
          <Card onClick={() => go("paywall")} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={18} color={C.gold} /><span style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}>Manage Subscription</span><ChevronRight size={16} color={C.sub2} />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ color: C.sub, fontSize: 11.5 }}>Signed in as</span><span style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>{data.account.email}</span></Card>
        </div>

        <Card onClick={() => go("logout")} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <LogOut size={18} color={C.danger} /><span style={{ flex: 1, color: C.danger, fontSize: 14, fontWeight: 600 }}>Logout</span>
        </Card>
        <div style={{ textAlign: "center", color: C.sub2, fontSize: 11.5, margin: "18px 0" }}>Fifty · Version 1.0.0</div>
      </div>
    </div>
  );
}

/* ============================== ADMIN ============================== */
function AdminScreen({ back, showToast }) {
  const { C } = useUI();
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundUid, setFoundUid] = useState(null);
  const [userData, setUserData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [planKcal, setPlanKcal] = useState("");
  const [planProtein, setPlanProtein] = useState("");
  const [planCarbs, setPlanCarbs] = useState("");
  const [planFat, setPlanFat] = useState("");
  const [planNotes, setPlanNotes] = useState("");

  const search = async () => {
    setError(""); setFoundUid(null); setUserData(null);
    if (!searchEmail || !isValidEmail(searchEmail)) { setError("Enter a valid email address"); return; }
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("account.email", "==", searchEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setError("No user found with that email"); return; }
      const first = snap.docs[0];
      setFoundUid(first.id);
      setUserData(first.data());
      const existingPlan = first.data().nutritionPlan;
      setPlanKcal(existingPlan?.targetKcal ?? "");
      setPlanProtein(existingPlan?.targetProtein ?? "");
      setPlanCarbs(existingPlan?.targetCarbs ?? "");
      setPlanFat(existingPlan?.targetFat ?? "");
      setPlanNotes(existingPlan?.notes ?? "");
    } catch (e) {
      setError("Search failed — check your connection and that you're an admin");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!foundUid || !userData) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", foundUid), userData);
      showToast("User data saved");
    } catch (e) {
      showToast("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const sendPlan = async () => {
    if (!foundUid) return;
    if (!planKcal) { showToast("Enter at least a target calorie goal"); return; }
    const plan = {
      targetKcal: Number(planKcal) || 0,
      targetProtein: Number(planProtein) || 0,
      targetCarbs: Number(planCarbs) || 0,
      targetFat: Number(planFat) || 0,
      notes: planNotes,
      unread: true,
      deliveredAt: dateKey(0),
    };
    const nextUserData = { ...userData, nutritionPlan: plan };
    setUserData(nextUserData);
    setSaving(true);
    try {
      await setDoc(doc(db, "users", foundUid), nextUserData);
      showToast("Diet plan delivered — they'll see it next time they open the app");
    } catch (e) {
      showToast("Failed to send — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const update = (path, value) => {
    setUserData((prev) => {
      const next = clone(prev);
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  const dates = userData ? Object.keys(userData.logs || {}).sort().reverse() : [];

  return (
    <div>
      <TopBar title="Admin" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <TextField icon={Search} value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="Search user by email" />
          </div>
        </div>
        <GreenButton onClick={search} disabled={loading}>{loading ? "Searching…" : "Search"}</GreenButton>
        {error && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        {userData && (
          <div style={{ marginTop: 20 }}>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{userData.account?.name || "(no name)"}</div>
              <div style={{ color: C.sub, fontSize: 12.5 }}>{userData.account?.email}</div>
              <div style={{ color: C.sub2, fontSize: 11, marginTop: 4 }}>UID: {foundUid}</div>
            </Card>

            <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>ENTITLEMENTS</div>
            <Card style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>Training Pro</span>
                <ToggleSwitch on={!!userData.entitlements?.trainingPro} onClick={() => update(["entitlements", "trainingPro"], !userData.entitlements?.trainingPro)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: C.text, fontSize: 13.5, fontWeight: 600 }}>Nutrition Pro</span>
                <ToggleSwitch on={!!userData.entitlements?.nutritionPro} onClick={() => update(["entitlements", "nutritionPro"], !userData.entitlements?.nutritionPro)} />
              </div>
            </Card>

            <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>PERSONALIZED DIET PLAN</div>
            <Card style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>Calories</div>
                  <input type="number" value={planKcal} onChange={(e) => setPlanKcal(e.target.value)} placeholder="2200" style={inputBoxStyle(C)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>Protein (g)</div>
                  <input type="number" value={planProtein} onChange={(e) => setPlanProtein(e.target.value)} placeholder="150" style={inputBoxStyle(C)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>Carbs (g)</div>
                  <input type="number" value={planCarbs} onChange={(e) => setPlanCarbs(e.target.value)} placeholder="220" style={inputBoxStyle(C)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>Fat (g)</div>
                  <input type="number" value={planFat} onChange={(e) => setPlanFat(e.target.value)} placeholder="70" style={inputBoxStyle(C)} />
                </div>
              </div>
              <div>
                <div style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>Notes / meal suggestions</div>
                <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={5} placeholder="e.g. Breakfast: oats + eggs. Lunch: chicken + rice + salad. Dinner: fish + vegetables..."
                  style={{ width: "100%", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <GreenButton onClick={sendPlan} disabled={saving}>{saving ? "Sending…" : userData.nutritionPlan ? "Update & Redeliver Plan" : "Send Plan to User"}</GreenButton>
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {(userData.bodyWeight || []).map((w, i) => (
                <Card key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10 }}>
                  <span style={{ color: C.sub, fontSize: 12, width: 90 }}>{w.date}</span>
                  <input type="number" value={w.weight} onChange={(e) => update(["bodyWeight", i, "weight"], Number(e.target.value))} style={inputBoxStyle(C)} />
                  <button onClick={() => update(["bodyWeight"], userData.bodyWeight.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color={C.sub2} /></button>
                </Card>
              ))}
              {(!userData.bodyWeight || userData.bodyWeight.length === 0) && <Card style={{ textAlign: "center", color: C.sub, padding: 16 }}>No entries</Card>}
            </div>

            <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, margin: "6px 0 10px" }}>WORKOUT LOGS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {dates.length === 0 && <Card style={{ textAlign: "center", color: C.sub, padding: 16 }}>No workout logs yet</Card>}
              {dates.map((d) => (
                <Card key={d}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{d}</div>
                  {Object.entries(userData.logs[d]).map(([exId, exLog]) => (
                    <div key={exId} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>{exId} {exLog.finished ? "✓" : ""}</span>
                        <button onClick={() => { const l = clone(userData.logs); delete l[d][exId]; update(["logs"], l); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={13} color={C.sub2} /></button>
                      </div>
                      {(exLog.sets || []).map((s, si) => (
                        <div key={si} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
                          <span style={{ color: C.sub2, fontSize: 11, width: 14 }}>{si + 1}</span>
                          <input type="number" value={s.weight} onChange={(e) => { const l = clone(userData.logs); l[d][exId].sets[si].weight = Number(e.target.value); update(["logs"], l); }} style={inputBoxStyle(C)} />
                          <input type="number" value={s.reps} onChange={(e) => { const l = clone(userData.logs); l[d][exId].sets[si].reps = Number(e.target.value); update(["logs"], l); }} style={inputBoxStyle(C)} />
                          <button onClick={() => { const l = clone(userData.logs); l[d][exId].sets[si].done = !l[d][exId].sets[si].done; update(["logs"], l); }} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${s.done ? C.green : C.border}`, background: s.done ? C.green : "transparent", flexShrink: 0, cursor: "pointer" }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </Card>
              ))}
            </div>

            <GreenButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</GreenButton>
          </div>
        )}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const { C } = useUI();
  const items = [
    { id: "home", label: "Home", icon: HomeIcon }, { id: "workout", label: "Workout", icon: Dumbbell },
    { id: "progress", label: "Progress", icon: TrendingUp }, { id: "plans", label: "Plans", icon: Calendar },
    { id: "profile", label: "Profile", icon: User },
  ];
  return (
    <div style={{ position: "sticky", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", padding: "10px 6px calc(12px + env(safe-area-inset-bottom))", zIndex: 20 }}>
      {items.map((it) => {
        const Icon = it.icon; const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5px 0", minHeight: 38 }}>
            {isActive ? (
              <div style={{ width: 46, height: 32, borderRadius: 20, background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={19} color={C.onAccent} strokeWidth={2.4} />
              </div>
            ) : (
              <>
                <Icon size={21} color={C.sub2} strokeWidth={1.8} />
                <span style={{ fontSize: 10.5, fontWeight: 500, color: C.sub2, marginTop: 4 }}>{it.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================== APP ROOT ============================== */
export default function GymApp() {
  const firebaseUser = useFirebaseSession(); // undefined = checking, null = signed out, object = signed in
  const { data, setData, loaded } = useAppData(firebaseUser?.uid);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!firebaseUser) { setIsAdmin(false); return; }
    getDoc(doc(db, "admins", firebaseUser.uid)).then((snap) => setIsAdmin(snap.exists())).catch(() => setIsAdmin(false));
  }, [firebaseUser]);
  const [phase, setPhase] = useState("splash");
  const [localLang, setLocalLang] = useState(() => {
    try { return localStorage.getItem("50fit-lang"); } catch (e) { return null; }
  });
  const [screen, setScreen] = useState("home");
  const [params, setParams] = useState({});
  const [selectedDay, setSelectedDay] = useState(DAYS[todayIdx]);
  const [navHistory, setNavHistory] = useState([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    if (firebaseUser === undefined) return; // Firebase hasn't reported yet — stay on splash
    if (firebaseUser === null) { setPhase(localLang ? "welcome" : "language"); return; }
    if (!loaded) return; // signed in, waiting on their Firestore document to load
    setPhase(data.onboarded ? "app" : "onboarding");
  }, [firebaseUser, loaded]); // eslint-disable-line

  const pickLanguage = (lang) => {
    try { localStorage.setItem("50fit-lang", lang); } catch (e) {}
    setLocalLang(lang);
    setPhase("welcome");
  };

  const go = (s, p = {}) => {
    if (s === "logout") { setConfirmLogoutOpen(true); return; }
    setNavHistory((h) => [...h, { screen, params }]);
    setScreen(s); setParams(p);
  };
  const back = () => {
    setNavHistory((h) => {
      if (h.length === 0) { setScreen("home"); return h; }
      const prev = h[h.length - 1];
      setScreen(prev.screen); setParams(prev.params);
      return h.slice(0, -1);
    });
  };
  const tabs = ["home", "workout", "progress", "plans", "profile"];
  const onNavChange = (id) => { setNavHistory([]); setScreen(id); setParams({}); };

  const exitWarnedRef = useRef(false);
  useEffect(() => {
    let listenerHandle;
    CapApp.addListener("backButton", () => {
      if (confirmLogoutOpen) { setConfirmLogoutOpen(false); return; }
      if (phase !== "app") {
        // Auth flow: let the back button retrace login/signup/onboarding steps
        // instead of throwing the person out of the app entirely.
        if (phase === "login" || phase === "signup") { setPhase("welcome"); return; }
        if (phase === "welcome") { CapApp.exitApp(); return; }
        return; // onboarding/language: no natural "back" target, ignore
      }
      if (navHistory.length > 0) { back(); return; }
      if (screen !== "home") { onNavChange("home"); return; }
      // At the Home tab with nothing left to pop — require a second press to exit.
      if (exitWarnedRef.current) { CapApp.exitApp(); return; }
      exitWarnedRef.current = true;
      showToast("Press back again to exit");
      setTimeout(() => { exitWarnedRef.current = false; }, 2000);
    }).then((h) => { listenerHandle = h; });
    return () => { if (listenerHandle) listenerHandle.remove(); };
  }, [phase, screen, navHistory, confirmLogoutOpen]); // eslint-disable-line

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
      setNavHistory([]); setScreen("home"); setConfirmLogoutOpen(false);
      showToast("Logged out");
      // The auth-state listener above sets phase to "welcome" automatically.
    } catch (e) {
      showToast("Couldn't log out — check your connection and try again");
    }
  };

  const C = data.settings.theme === "light" ? LIGHT : DARK;
  const lang = data.settings.language || localLang || "en";
  const ui = { C, lang };

  if (phase === "splash") {
    return <UIContext.Provider value={{ C: DARK, lang: "en" }}><div style={{ maxWidth: 430, margin: "0 auto" }}><SplashScreen /></div></UIContext.Provider>;
  }

  if (phase === "language") {
    return (
      <UIContext.Provider value={{ C, lang: "en" }}>
        <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
          <LanguageScreen onPick={pickLanguage} />
        </div>
      </UIContext.Provider>
    );
  }

  let authScreen = null;
  if (phase === "welcome") authScreen = <WelcomeScreen go={setPhase} />;
  else if (phase === "login") authScreen = <LoginScreen go={setPhase} showToast={showToast} />;
  else if (phase === "signup") authScreen = <SignUpScreen go={setPhase} showToast={showToast} localLang={localLang} />;
  else if (phase === "onboarding") authScreen = <OnboardingScreen data={data} setData={setData} go={setPhase} showToast={showToast} />;

  if (authScreen) {
    return (
      <UIContext.Provider value={ui}>
        <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
          {authScreen}<Toast message={toast} />
        </div>
      </UIContext.Provider>
    );
  }

  let content;
  if (screen === "home") content = <HomeScreen data={data} go={go} />;
  else if (screen === "workout") content = <WorkoutScreen data={data} setData={setData} go={go} selectedDay={selectedDay} setSelectedDay={setSelectedDay} showToast={showToast} />;
  else if (screen === "exercise") content = <ExerciseScreen data={data} setData={setData} back={back} exerciseId={params.exerciseId} day={params.day} showToast={showToast} awardXp={doAwardXp} />;
  else if (screen === "progress") content = <ProgressScreen data={data} go={go} />;
  else if (screen === "bodyweight") content = <BodyWeightScreen data={data} setData={setData} back={back} showToast={showToast} go={go} />;
  else if (screen === "meals") content = <MealsScreen data={data} setData={setData} back={back} showToast={showToast} go={go} />;
  else if (screen === "foodPicker") content = <FoodPickerScreen data={data} setData={setData} back={back} mealId={params.mealId} showToast={showToast} />;
  else if (screen === "plans") content = <PlansScreen data={data} setData={setData} go={go} showToast={showToast} />;
  else if (screen === "planDetail") content = <PlanDetailScreen data={data} setData={setData} back={back} planId={params.planId} showToast={showToast} />;
  else if (screen === "paywall") content = <PaywallScreen data={data} setData={setData} back={back} showToast={showToast} />;
  else if (screen === "profile") content = <ProfileScreen data={data} go={go} isAdmin={isAdmin} />;
  else if (screen === "personalInfo") content = <PersonalInfoScreen data={data} setData={setData} back={back} showToast={showToast} />;
  else if (screen === "goals") content = <GoalsScreen data={data} setData={setData} back={back} showToast={showToast} />;
  else if (screen === "measurements") content = <MeasurementsScreen data={data} back={back} go={go} />;
  else if (screen === "reminders") content = <RemindersScreen data={data} setData={setData} back={back} showToast={showToast} />;
  else if (screen === "help") content = <HelpScreen back={back} showToast={showToast} />;
  else if (screen === "settings") content = <SettingsScreen data={data} setData={setData} back={back} go={go} showToast={showToast} />;
  else if (screen === "admin") content = <AdminScreen back={back} showToast={showToast} />;
  else content = <HomeScreen data={data} go={go} />;

  const showNav = tabs.includes(screen);

  return (
    <UIContext.Provider value={ui}>
      <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <style>{"@keyframes screenIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }"}</style>
          <div key={screen + JSON.stringify(params)} style={{ animation: "screenIn 0.22s ease-out" }}>{content}</div>
        </div>
        {showNav && <BottomNav active={screen} onChange={onNavChange} />}
        {confirmLogoutOpen && (
          <ConfirmDialog title="Log out?" message="You'll need to log back in to see your workouts, weight and meal history." confirmLabel="Log Out" danger onConfirm={doLogout} onCancel={() => setConfirmLogoutOpen(false)} />
        )}
        <Toast message={toast} />
      </div>
    </UIContext.Provider>
  );
}
