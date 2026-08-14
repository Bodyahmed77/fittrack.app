import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANEXYUVqaGss1i9WS5gH7Ic3UrBgKG_qc",
  authDomain: "fittrack-698fa.firebaseapp.com",
  projectId: "fittrack-698fa",
  storageBucket: "fittrack-698fa.firebasestorage.app",
  messagingSenderId: "632925500741",
  appId: "1:632925500741:web:1d42d331f0bd09f4c67a2c",
  measurementId: "G-7S75NTCV5B",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const DAY_COUNT = 7;
let currentUid = null;
let draft = null;
let busy = false;

const clone = (v) => JSON.parse(JSON.stringify(v));
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function defaultTraining() {
  return {
    version: 1,
    title: "Personal Training Plan",
    titleAr: "خطة التدريب المخصصة",
    startDate: isoToday(),
    days: Array.from({ length: DAY_COUNT }, (_, i) => ({
      title: `Day ${i + 1}`,
      titleAr: `اليوم ${i + 1}`,
      exercises: [],
    })),
  };
}
function defaultNutrition() {
  const meals = [
    ["breakfast", "Breakfast", "الفطار"],
    ["lunch", "Lunch", "الغدا"],
    ["dinner", "Dinner", "العشا"],
    ["snacks", "Snacks", "سناكس"],
  ];
  return {
    version: 1,
    title: "Your Nutrition Plan",
    titleAr: "خطتك الغذائية",
    startDate: isoToday(),
    days: Array.from({ length: DAY_COUNT }, (_, i) => ({
      title: `Day ${i + 1}`,
      titleAr: `اليوم ${i + 1}`,
      targetKcal: "",
      targetProtein: "",
      targetCarbs: "",
      targetFat: "",
      meals: meals.map(([id, title, titleAr]) => ({ id, title, titleAr, items: "", note: "", noteAr: "" })),
    })),
  };
}

function currentDayIndex(kind) {
  const active = document.querySelector(kind === "training" ? ".day-tab.active[data-day]" : ".day-tab.active[data-nut-day]");
  const raw = active?.dataset?.[kind === "training" ? "day" : "nutDay"];
  const index = Number(raw);
  return Number.isInteger(index) && index >= 0 && index < DAY_COUNT ? index : 0;
}

function syncTrainingDay() {
  if (!draft?.training) return;
  const i = currentDayIndex("training");
  const old = draft.training.days[i] || { title: `Day ${i + 1}`, titleAr: `اليوم ${i + 1}`, exercises: [] };
  const rows = [...document.querySelectorAll(".exercise-row")];
  const exercises = rows.map((row) => {
    const id = row.querySelector('[data-ex-field$=":id"]')?.value || "bench_press";
    const sets = Number(row.querySelector('[data-ex-field$=":targetSets"]')?.value || 3);
    const reps = row.querySelector('[data-ex-field$=":targetReps"]')?.value || "8-12";
    return { id, targetSets: sets, targetReps: reps };
  });
  draft.training.days[i] = {
    ...old,
    title: document.getElementById("day-title")?.value || old.title,
    titleAr: document.getElementById("day-title-ar")?.value || old.titleAr,
    exercises,
  };
  draft.training.title = document.getElementById("training-title")?.value || draft.training.title;
  draft.training.startDate = document.getElementById("training-start")?.value || draft.training.startDate;
}

function syncNutritionDay() {
  if (!draft?.nutrition) return;
  const i = currentDayIndex("nutrition");
  const old = draft.nutrition.days[i] || {};
  const meals = Array.isArray(old.meals) ? old.meals : defaultNutrition().days[i].meals;
  draft.nutrition.days[i] = {
    ...old,
    targetKcal: document.getElementById("nkcal")?.value ?? old.targetKcal ?? "",
    targetProtein: document.getElementById("nprotein")?.value ?? old.targetProtein ?? "",
    targetCarbs: document.getElementById("ncarbs")?.value ?? old.targetCarbs ?? "",
    targetFat: document.getElementById("nfat")?.value ?? old.targetFat ?? "",
    meals: meals.map((meal, index) => ({
      ...meal,
      items: document.querySelector(`[data-meal-items="${index}"]`)?.value ?? meal.items ?? "",
      note: document.querySelector(`[data-meal-note="${index}"]`)?.value ?? meal.note ?? "",
    })),
  };
  draft.nutrition.title = document.getElementById("nutrition-title")?.value || draft.nutrition.title;
  draft.nutrition.startDate = document.getElementById("nutrition-start")?.value || draft.nutrition.startDate;
}

async function ensureDraft() {
  const uidMatch = document.body.innerText.match(/\bUID\s+([A-Za-z0-9_-]{20,})/);
  const uid = uidMatch?.[1] || null;
  if (!uid || uid === currentUid) return;
  currentUid = uid;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};
    draft = {
      training: clone(data.customTrainingPlan || defaultTraining()),
      nutrition: clone(data.customNutritionPlan || defaultNutrition()),
    };
  } catch (error) {
    console.warn("[PUBLISH_ANY_PLAN] draft load failed", error);
    draft = { training: defaultTraining(), nutrition: defaultNutrition() };
  }
}

async function publish(kind) {
  if (busy) return;
  await ensureDraft();
  if (!currentUid || !draft) return alert("Open a customer first.");
  if (kind === "training") syncTrainingDay();
  else syncNutritionDay();

  busy = true;
  const button = document.getElementById(kind === "training" ? "save-training" : "save-nutrition");
  const original = button?.textContent || "Publish plan";
  if (button) { button.disabled = true; button.textContent = "Publishing…"; }

  try {
    const now = new Date().toISOString();
    if (kind === "training") {
      const payload = { ...clone(draft.training), updatedAt: now, assignedBy: auth.currentUser?.uid || null };
      await setDoc(doc(db, "users", currentUid), {
        customTrainingPlan: payload,
        workoutStartDate: payload.startDate || isoToday(),
      }, { merge: true });
      const ar = /^(ar|arabic)/i.test(document.documentElement.lang || "");
      await setDoc(doc(db, "users", currentUid, "notifications", `training-plan-${Date.now()}`), {
        type: "training_plan_ready",
        route: { screen: "workout", params: {} },
        title: ar ? "اتضافت لك خطة تدريب جديدة 💪" : "A new training plan was added 💪",
        body: ar ? "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized training plan is now ready in Fifty Fit.",
        titleAr: "اتضافت لك خطة تدريب جديدة 💪",
        bodyAr: "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit.",
        titleEn: "A new training plan was added 💪",
        bodyEn: "Your personalized training plan is now ready in Fifty Fit.",
        createdAt: now,
        read: false,
      });
    } else {
      const payload = { ...clone(draft.nutrition), updatedAt: now, assignedBy: auth.currentUser?.uid || null };
      await setDoc(doc(db, "users", currentUid), { customNutritionPlan: payload }, { merge: true });
      const ar = /^(ar|arabic)/i.test(document.documentElement.lang || "");
      await setDoc(doc(db, "users", currentUid, "notifications", `nutrition-plan-${Date.now()}`), {
        type: "nutrition_plan_ready",
        route: { screen: "nutritionPlan", params: {} },
        title: ar ? "اتضاف لك نظام أكل جديد 🍽️" : "A new nutrition plan was added 🍽️",
        body: ar ? "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized nutrition plan is now ready in Fifty Fit.",
        titleAr: "اتضاف لك نظام أكل جديد 🍽️",
        bodyAr: "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit.",
        titleEn: "A new nutrition plan was added 🍽️",
        bodyEn: "Your personalized nutrition plan is now ready in Fifty Fit.",
        createdAt: now,
        read: false,
      });
    }
    alert(kind === "training" ? "Training plan published successfully." : "Nutrition plan published successfully.");
  } catch (error) {
    console.error("[PUBLISH_ANY_PLAN] publish failed", error);
    alert(`Publish failed: ${error?.message || error}`);
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

// Capture phase runs before the existing app.js onclick handler. We stop the
// old Pro-only handler and replace it with the assignment flow above.
document.addEventListener("click", async (event) => {
  const target = event.target?.closest?.("#save-training, #save-nutrition");
  if (target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await publish(target.id === "save-training" ? "training" : "nutrition");
    return;
  }
  if (event.target?.closest?.("[data-day], [data-nut-day]")) {
    syncTrainingDay();
    syncNutritionDay();
  }
}, true);

document.addEventListener("input", () => {
  // Keep the draft synchronized while the editor is open. Day-tab changes are
  // also synchronized by the capture listener above.
  if (document.getElementById("training-title")) syncTrainingDay();
  if (document.getElementById("nutrition-title")) syncNutritionDay();
}, true);

onAuthStateChanged(auth, () => ensureDraft().catch(() => {}));
new MutationObserver(() => ensureDraft().catch(() => {})).observe(document.documentElement, { childList: true, subtree: true });
