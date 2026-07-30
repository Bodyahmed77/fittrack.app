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
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
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

// Signs in with the native Google account picker, then bridges that
// credential into our normal Firebase JS SDK session so the rest of the
// app (which listens to onAuthStateChanged on `auth`) works unchanged.
// If this is someone's first time signing in, their Firestore document
// gets created here — the ordinary email/password sign-up flow never runs.
async function signInWithGoogleFlow(localLang) {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("No ID token from Google");
  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);
  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const initial = freshState();
    initial.account.name = userCred.user.displayName || "";
    initial.account.email = userCred.user.email || "";
    initial.settings.language = localLang || "en";
    await setDoc(ref, initial);
  }
  return userCred;
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

function chamfer(r = 12) {
  return `polygon(${r}px 0, calc(100% - ${r}px) 0, 100% ${r}px, 100% calc(100% - ${r}px), calc(100% - ${r}px) 100%, ${r}px 100%, 0 calc(100% - ${r}px), 0 ${r}px)`;
}

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
function useFirebaseSession() {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
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

  const googleSignIn = async () => {
    setError(""); setBusy(true);
    try {
      await signInWithGoogleFlow();
      showToast("Welcome!");
    } catch (err) {
      showToast("Google Sign-In failed — please try again");
    } finally {
      setBusy(false);
    }
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
    } catch (err) {
      setErrors({ email: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogleFlow(localLang);
      showToast("Welcome!");
    } catch (err) {
      showToast("Google Sign-In failed — please try again");
    } finally {
      setBusy(false);
    }
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
  }, [generating, genIdx]);

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
    next.activePlanId = "beginner";
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
  const [activeMeal, setActiveMeal] = useState(null);
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState(100);

  const totalKcal = dayKcal(data, today);
  const macros = dayMacros(data, today);
  const targetKcal = 2200;

  const filteredFoods = FOOD_DB.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  const addFoodItem = (food) => {
    if (!activeMeal) return;
    const factor = grams / 100;
    const item = {
      id: uid(),
      name: food.name,
      grams: Number(grams),
      kcal: Math.round(food.kcal * factor),
      protein: Number((food.protein * factor).toFixed(1)),
      carbs: Number((food.carbs * factor).toFixed(1)),
      fat: Number((food.fat * factor).toFixed(1)),
    };

    const next = clone(data);
    if (!next.meals[today]) next.meals[today] = {};
    if (!next.meals[today][activeMeal]) next.meals[today][activeMeal] = { items: [] };
    next.meals[today][activeMeal].items.push(item);
    setData(next);
    showToast(`Added ${item.name}`);
    setActiveMeal(null);
    setQuery("");
    setGrams(100);
  };

  const removeFoodItem = (mealId, itemId) => {
    const next = clone(data);
    if (next.meals[today]?.[mealId]?.items) {
      next.meals[today][mealId].items = next.meals[today][mealId].items.filter((i) => i.id !== itemId);
      setData(next);
      showToast("Item removed");
    }
  };

  return (
    <div>
      <TopBar title="Nutrition & Meals" onBack={back} />
      <div style={{ padding: "0 18px" }}>
        {!pro && (
          <Card onClick={() => go("paywall")} style={{ marginBottom: 14, background: C.goldSoft, border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", gap: 12 }}>
            <Crown size={20} color={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Unlock Full Nutrition Plan</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>Get personalized macros & custom diets with Nutrition Pro</div>
            </div>
            <ChevronRight size={16} color={C.sub2} />
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ color: C.sub, fontSize: 12 }}>Calories Today</div>
              <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>{totalKcal} <span style={{ fontSize: 13, color: C.sub, fontWeight: 400 }}>/ {targetKcal} kcal</span></div>
            </div>
            <ProgressRing pct={(totalKcal / targetKcal) * 100} size={50} stroke={6} />
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, textAlign: "center" }}><div style={{ color: C.sub, fontSize: 11 }}>Protein</div><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{macros.protein}g</div></div>
            <div style={{ flex: 1, textAlign: "center" }}><div style={{ color: C.sub, fontSize: 11 }}>Carbs</div><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{macros.carbs}g</div></div>
            <div style={{ flex: 1, textAlign: "center" }}><div style={{ color: C.sub, fontSize: 11 }}>Fat</div><div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{macros.fat}g</div></div>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MEAL_ITEMS.map((m) => {
            const Icon = m.icon;
            const mealData = meals[m.id] || { items: [] };
            const items = mealData.items || [];
            const mealKcal = items.reduce((s, i) => s + i.kcal, 0);

            return (
              <Card key={m.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} color={C.green} />
                    </div>
                    <div>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                      <div style={{ color: C.sub, fontSize: 11.5 }}>{mealKcal} kcal</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveMeal(m.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Plus size={16} />
                  </button>
                </div>

                {items.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map((it) => (
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                        <span style={{ color: C.text }}>{it.name} ({it.grams}g)</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: C.sub }}>{it.kcal} kcal</span>
                          <button onClick={() => removeFoodItem(m.id, it.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.sub2} /></button>
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

      {activeMeal && (
        <div style={{ position: "fixed", inset: 0, background: C.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setActiveMeal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Add Food</div>
              <button onClick={() => setActiveMeal(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.sub} /></button>
            </div>
            <TextField icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods…" />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.sub, fontSize: 13 }}>Portion:</span>
              <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ ...inputBoxStyle(C), width: 80 }} />
              <span style={{ color: C.sub, fontSize: 13 }}>grams</span>
            </div>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {filteredFoods.map((f) => (
                <div key={f.id} onClick={() => addFoodItem(f)} style={{ padding: 12, borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{f.name}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>P: {f.protein}g | C: {f.carbs}g | F: {f.fat}g (per 100g)</div>
                  </div>
                  <div style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>{Math.round(f.kcal * (grams / 100))} kcal</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== PLANS SCREEN ============================== */
function PlansScreen({ data, setData, go, showToast }) {
  const { C } = useUI();
  const activePlanId = data.activePlanId;

  const selectPlan = (plan) => {
    if (plan.pro && !data.entitlements.trainingPro) {
      go("paywall");
      return;
    }
    const next = clone(data);
    next.activePlanId = plan.id;
    setData(next);
    showToast(`Switched to ${plan.name}`);
  };

  return (
    <div>
      <TopBar title="Workout Plans" />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {Object.values(PLAN_TEMPLATES).map((plan) => {
          const isActive = activePlanId === plan.id;
          const isLocked = plan.pro && !data.entitlements.trainingPro;

          return (
            <Card key={plan.id} style={{ border: isActive ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 32 }}>{plan.icon}</div>
                  <div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                      {plan.name} {plan.pro && <ProBadge small />}
                    </div>
                    <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{plan.tagline}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                {isActive ? (
                  <GreenButton disabled style={{ background: C.greenSoft, color: C.green }}>Current Active Plan</GreenButton>
                ) : isLocked ? (
                  <GreenButton onClick={() => selectPlan(plan)} variant="outline"><Crown size={16} /> Unlock with Pro</GreenButton>
                ) : (
                  <GreenButton onClick={() => selectPlan(plan)}>Switch to this Plan</GreenButton>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== PROFILE & SETTINGS SCREEN ============================== */
function ProfileScreen({ data, setData, go, showToast, confirmLogout }) {
  const { C, theme, toggleTheme, lang, setLang } = useUI();
  const acc = data.account;
  const prof = data.profile;
  const ent = data.entitlements;
  const bmi = bmiInfo(data.bodyWeight[data.bodyWeight.length - 1]?.weight, acc.height);

  return (
    <div>
      <TopBar title="Profile & Settings" />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar photo={acc.photo} size={54} />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 17 }}>{acc.name || "User"}</div>
            <div style={{ color: C.sub, fontSize: 12 }}>{acc.email}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {ent.trainingPro && <ProBadge small />}
              {ent.nutritionPro && <span style={{ background: C.greenSoft, color: C.green, fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 20 }}>NUTRITION</span>}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Level {prof.level || 1} Progress</div>
          <div style={{ height: 8, background: C.card2, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${Math.min(100, ((prof.xp || 0) / (prof.xpMax || 500)) * 100)}%`, background: C.green }} />
          </div>
          <div style={{ color: C.sub2, fontSize: 11, textAlign: "right" }}>{prof.xp || 0} / {prof.xpMax || 500} XP</div>
        </Card>

        {bmi && (
          <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.sub, fontSize: 12 }}>BMI Status</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{bmi.bmi} kg/m²</div>
            </div>
            <span style={{ padding: "4px 10px", borderRadius: 12, background: C.card2, color: C.green, fontWeight: 700, fontSize: 12 }}>{bmi.cat}</span>
          </Card>
        )}

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Settings</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.sub, fontSize: 13 }}>Dark Theme</span>
            <ToggleSwitch on={theme === "dark"} onClick={toggleTheme} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.sub, fontSize: 13 }}>Language</span>
            <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} style={{ background: C.card2, border: `1px solid ${C.border}`, color: C.text, padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
              {lang === "ar" ? "العربية" : "English"}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => go("reminders")}>
            <span style={{ color: C.sub, fontSize: 13 }}>Daily Reminders</span>
            <ChevronRight size={16} color={C.sub2} />
          </div>
        </Card>

        <Card onClick={() => {
          const text = encodeURIComponent("Hello Fifty Team, I need help with my account.");
          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
        }} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <MessageCircle size={18} color={C.green} />
          <span style={{ flex: 1, color: C.text, fontWeight: 600, fontSize: 13.5 }}>Contact Support on WhatsApp</span>
          <ChevronRight size={16} color={C.sub2} />
        </Card>

        <div style={{ marginTop: 10, marginBottom: 20 }}>
          <GreenButton variant="outline" onClick={confirmLogout} style={{ color: C.danger, borderColor: C.dangerSoft }}>
            <LogOut size={16} /> Log Out
          </GreenButton>
        </div>
      </div>
    </div>
  );
}

/* ============================== REMINDERS SCREEN ============================== */
function RemindersScreen({ data, setData, back, showToast }) {
  const { C } = useUI();
  const [enabled, setEnabled] = useState(data.settings.notifications);
  const [time, setTime] = useState(data.settings.reminderTime || "18:00");

  const toggle = async () => {
    const nextVal = !enabled;
    setEnabled(nextVal);
    const next = clone(data);
    next.settings.notifications = nextVal;
    setData(next);
    if (nextVal) {
      await scheduleDailyReminder(time);
      showToast("Reminders enabled");
    } else {
      await cancelDailyReminder();
      showToast("Reminders disabled");
    }
  };

  const updateTime = async (t) => {
    setTime(t);
    const next = clone(data);
    next.settings.reminderTime = t;
    setData(next);
    if (enabled) {
      await scheduleDailyReminder(t);
      showToast(`Reminder time set to ${t}`);
    }
  };

  return (
    <div>
      <TopBar title="Reminders" onBack={back} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Daily Workout Reminder</div>
            <div style={{ color: C.sub, fontSize: 12 }}>Get notified to keep your streak</div>
          </div>
          <ToggleSwitch on={enabled} onClick={toggle} />
        </Card>

        {enabled && (
          <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13.5 }}>Reminder Time</span>
            <input type="time" value={time} onChange={(e) => updateTime(e.target.value)} style={{ background: C.card2, border: `1px solid ${C.border}`, color: C.text, padding: "6px 10px", borderRadius: 8, outline: "none" }} />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================== PAYWALL SCREEN ============================== */
function PaywallScreen({ data, setData, back, showToast }) {
  const { C } = useUI();

  const buyPlan = (type) => {
    const next = clone(data);
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    const iso = expires.toISOString().slice(0, 10);

    if (type === "training" || type === "all") next.entitlements.trainingPro = true;
    if (type === "nutrition" || type === "all") next.entitlements.nutritionPro = true;
    next.entitlements.proExpiresAt = iso;

    setData(next);
    scheduleSubscriptionExpiryReminder(iso);
    showToast("Pro features unlocked!");
    back();
  };

  return (
    <div>
      <TopBar title="Fifty Pro" onBack={back} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <Crown size={40} color={C.gold} />
          <div style={{ color: C.text, fontSize: 20, fontWeight: 800, marginTop: 6 }}>Upgrade Your Experience</div>
          <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>Unlock personalized features and track without limits.</div>
        </div>

        <Card style={{ border: `1px solid ${C.gold}77` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Training Pro</div>
            <span style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>$4.99 / mo</span>
          </div>
          <ul style={{ color: C.sub, fontSize: 12.5, margin: "10px 0", paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Unlimited exercises per day</li>
            <li>Custom personalized training splits</li>
            <li>Full history tracking for body weight & progress</li>
          </ul>
          <GreenButton onClick={() => buyPlan("training")}>Get Training Pro</GreenButton>
        </Card>

        <Card style={{ border: `1px solid ${C.gold}77` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Nutrition Pro</div>
            <span style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>$4.99 / mo</span>
          </div>
          <ul style={{ color: C.sub, fontSize: 12.5, margin: "10px 0", paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Full nutrition & diet plan builder</li>
            <li>Personalized daily macro targets</li>
            <li>Detailed meal logging & food analytics</li>
          </ul>
          <GreenButton onClick={() => buyPlan("nutrition")}>Get Nutrition Pro</GreenButton>
        </Card>

        <Card style={{ background: C.goldSoft, border: `1.5px solid ${C.gold}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Fifty All-Access Pass</div>
            <span style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>$7.99 / mo</span>
          </div>
          <div style={{ color: C.sub, fontSize: 12.5, margin: "8px 0" }}>Get both Training Pro and Nutrition Pro at a discount!</div>
          <GreenButton onClick={() => buyPlan("all")}>Unlock Everything</GreenButton>
        </Card>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ============================== MAIN ENTRY APP ============================== */
export default function App() {
  const firebaseUser = useFirebaseSession();
  const uid = firebaseUser?.uid;
  const { data, setData, loaded } = useAppData(uid);

  const [route, setRoute] = useState("home");
  const [routeParams, setRouteParams] = useState({});
  const [selectedDay, setSelectedDay] = useState(DAYS[todayIdx]);
  const [toastMsg, setToastMsg] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [localLang, setLocalLang] = useState(data.settings?.language || "en");

  useEffect(() => {
    if (data.settings?.language) setLocalLang(data.settings.language);
  }, [data.settings?.language]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2800);
  };

  const go = (target, params = {}) => {
    setRouteParams(params);
    setRoute(target);
  };

  const awardXp = (amount) => {
    const next = clone(data);
    let { level = 1, xp = 0, xpMax = 500 } = next.profile;
    xp += amount;
    if (xp >= xpMax) {
      level += 1;
      xp -= xpMax;
      xpMax = Math.round(xpMax * 1.25);
      showToast(`Leveled Up! You are now Level ${level} 🎉`);
    }
    next.profile = { level, xp, xpMax };
    setData(next);
  };

  const themeMode = data.settings.theme || "dark";
  const C = themeMode === "dark" ? DARK : LIGHT;

  const toggleTheme = () => {
    const next = clone(data);
    next.settings.theme = themeMode === "dark" ? "light" : "dark";
    setData(next);
  };

  const setLang = (l) => {
    setLocalLang(l);
    const next = clone(data);
    next.settings.language = l;
    setData(next);
  };

  const logout = async () => {
    await signOut(auth);
    setRoute("welcome");
  };

  if (firebaseUser === undefined || (uid && !loaded)) {
    return <SplashScreen />;
  }

  if (!firebaseUser) {
    if (route === "login") return <UIContext.Provider value={{ C, lang: localLang }}><LoginScreen go={go} showToast={showToast} /></UIContext.Provider>;
    if (route === "signup") return <UIContext.Provider value={{ C, lang: localLang }}><SignUpScreen go={go} showToast={showToast} localLang={localLang} /></UIContext.Provider>;
    if (route === "lang") return <UIContext.Provider value={{ C, lang: localLang }}><LanguageScreen onPick={(l) => { setLang(l); go("welcome"); }} /></UIContext.Provider>;
    return <UIContext.Provider value={{ C, lang: localLang }}><WelcomeScreen go={go} /></UIContext.Provider>;
  }

  if (!data.onboarded) {
    return <UIContext.Provider value={{ C, lang: localLang }}><OnboardingScreen data={data} setData={setData} go={go} showToast={showToast} /></UIContext.Provider>;
  }

  return (
    <UIContext.Provider value={{ C, theme: themeMode, toggleTheme, lang: localLang, setLang }}>
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "sans-serif", paddingBottom: 64 }}>
        {route === "home" && <HomeScreen data={data} go={go} />}
        {route === "workout" && <WorkoutScreen data={data} setData={setData} go={go} selectedDay={selectedDay} setSelectedDay={setSelectedDay} showToast={showToast} />}
        {route === "exercise" && <ExerciseScreen data={data} setData={setData} back={() => go("workout")} exerciseId={routeParams.exerciseId} day={routeParams.day} showToast={showToast} awardXp={awardXp} />}
        {route === "progress" && <ProgressScreen data={data} go={go} />}
        {route === "bodyweight" && <BodyWeightScreen data={data} setData={setData} back={() => go("home")} showToast={showToast} go={go} />}
        {route === "meals" && <MealsScreen data={data} setData={setData} back={() => go("home")} showToast={showToast} go={go} />}
        {route === "plans" && <PlansScreen data={data} setData={setData} go={go} showToast={showToast} />}
        {route === "profile" && <ProfileScreen data={data} setData={setData} go={go} showToast={showToast} confirmLogout={() => setConfirmState({ title: "Log Out", message: "Are you sure you want to log out?", action: logout })} />}
        {route === "reminders" && <RemindersScreen data={data} setData={setData} back={() => go("profile")} showToast={showToast} />}
        {route === "paywall" && <PaywallScreen data={data} setData={setData} back={() => go("home")} showToast={showToast} />}

        {/* BOTTOM NAVIGATION */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "calc(56px + env(safe-area-inset-bottom))", background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 90 }}>
          <button onClick={() => go("home")} style={{ flex: 1, height: "100%", background: "none", border: "none", color: route === "home" ? C.green : C.sub, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <HomeIcon size={20} /><span style={{ fontSize: 10, fontWeight: 700 }}>Home</span>
          </button>
          <button onClick={() => go("workout")} style={{ flex: 1, height: "100%", background: "none", border: "none", color: route === "workout" ? C.green : C.sub, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <Dumbbell size={20} /><span style={{ fontSize: 10, fontWeight: 700 }}>Workout</span>
          </button>
          <button onClick={() => go("plans")} style={{ flex: 1, height: "100%", background: "none", border: "none", color: route === "plans" ? C.green : C.sub, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <Calendar size={20} /><span style={{ fontSize: 10, fontWeight: 700 }}>Plans</span>
          </button>
          <button onClick={() => go("progress")} style={{ flex: 1, height: "100%", background: "none", border: "none", color: route === "progress" ? C.green : C.sub, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <TrendingUp size={20} /><span style={{ fontSize: 10, fontWeight: 700 }}>Progress</span>
          </button>
          <button onClick={() => go("profile")} style={{ flex: 1, height: "100%", background: "none", border: "none", color: route === "profile" ? C.green : C.sub, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            <User size={20} /><span style={{ fontSize: 10, fontWeight: 700 }}>Profile</span>
          </button>
        </div>

        <Toast message={toastMsg} />
        {confirmState && (
          <ConfirmDialog title={confirmState.title} message={confirmState.message} danger confirmLabel="Log Out" onConfirm={() => { confirmState.action(); setConfirmState(null); }} onCancel={() => setConfirmState(null)} />
        )}
      </div>
    </UIContext.Provider>
  );
}
