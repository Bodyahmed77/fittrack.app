import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const ROOT_MARK = "data-fifty-fit-published-plans";
const MODAL_MARK = "data-fifty-fit-plan-modal";

let userData = null;
let userRef = null;
let observer = null;
let scheduled = false;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[c]));
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cardStyle() {
  return [
    "margin:0 18px 12px",
    "padding:15px",
    "border:1.5px solid rgba(255,255,255,.22)",
    "border-radius:16px",
    "background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.025))",
    "box-shadow:0 10px 28px rgba(0,0,0,.18)",
    "cursor:pointer",
  ].join(";");
}

function findTextRoot(patterns) {
  const nodes = [...document.querySelectorAll("h1,h2,h3,div,span")];
  const node = nodes.find((el) => {
    const text = String(el.textContent || "").trim();
    return patterns.some((p) => p.test(text));
  });
  return node || null;
}

function isNutritionScreen() {
  return !!findTextRoot([/^(Nutrition|التغذية)$/i, /Your Nutrition Plan/i, /خطتك الغذائية/i]);
}

function isWorkoutScreen() {
  return !!findTextRoot([/^(Workout|التمرين)$/i, /Today's Workout/i, /تمرين اليوم/i]);
}

function ensureStyles() {
  if (document.getElementById("ff-published-plans-style")) return;
  const style = document.createElement("style");
  style.id = "ff-published-plans-style";
  style.textContent = `
    [data-fifty-fit-plan-modal]{position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.74);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    [data-fifty-fit-plan-modal] .ff-plan-sheet{width:min(720px,100%);max-height:88vh;overflow:auto;background:#090909;border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:18px;color:#fff;box-shadow:0 24px 70px rgba(0,0,0,.5)}
    [data-fifty-fit-plan-modal] .ff-plan-row{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}
    [data-fifty-fit-plan-modal] .ff-plan-day{font-weight:900;font-size:14px;margin-bottom:7px}
    [data-fifty-fit-plan-modal] .ff-plan-item{font-size:12px;color:#bcbcbc;line-height:1.6}
    [data-fifty-fit-plan-modal] .ff-plan-actions{display:flex;gap:9px;margin-top:14px;position:sticky;bottom:0;background:#090909;padding-top:10px}
    [data-fifty-fit-plan-modal] .ff-plan-btn{flex:1;border:0;border-radius:12px;padding:12px;font-weight:900;cursor:pointer}
    [data-fifty-fit-plan-modal] .ff-plan-primary{background:#fff;color:#000}
    [data-fifty-fit-plan-modal] .ff-plan-secondary{background:#171717;color:#fff;border:1px solid rgba(255,255,255,.14)}
  `;
  document.head.appendChild(style);
}

function closeModal() {
  document.querySelector(`[${MODAL_MARK}]`)?.remove();
}

function openTrainingModal(plan) {
  ensureStyles();
  closeModal();
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const modal = document.createElement("div");
  modal.setAttribute(MODAL_MARK, "1");
  modal.innerHTML = `
    <div class="ff-plan-sheet" role="dialog" aria-modal="true">
      <div style="font-size:10px;font-weight:900;letter-spacing:.7px;opacity:.6">PERSONALIZED TRAINING PLAN</div>
      <div style="font-size:20px;font-weight:900;margin-top:4px">🏋️ ${esc(plan?.title || "Your Training Plan")}</div>
      <div style="font-size:11.5px;opacity:.6;margin-top:5px">Starts ${esc(plan?.startDate || today())}</div>
      <div style="margin-top:12px">${days.map((day, index) => `
        <div class="ff-plan-row">
          <div class="ff-plan-day">${esc(day.title || `Day ${index + 1}`)}</div>
          ${(Array.isArray(day.exercises) && day.exercises.length
            ? day.exercises.map((ex) => `<div class="ff-plan-item">• ${esc(ex.name || ex.title || "Exercise")} ${ex.targetSets ? `· ${esc(ex.targetSets)} sets` : ""}${ex.targetReps ? ` · ${esc(ex.targetReps)} reps` : ""}</div>`).join("")
            : `<div class="ff-plan-item">Rest day / no exercises assigned.</div>`)}
        </div>`).join("")}</div>
      <div class="ff-plan-actions">
        <button type="button" class="ff-plan-btn ff-plan-secondary" data-close>Close</button>
        <button type="button" class="ff-plan-btn ff-plan-primary" data-use>Use Plan</button>
      </div>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close]")) return closeModal();
    if (!event.target.closest("[data-use]")) return;
    if (!userRef) return;
    updateDoc(userRef, { activePlanId: "custom", workoutStartDate: today() })
      .then(() => {
        closeModal();
        const workoutNav = [...document.querySelectorAll("button,[role='button'],a")].find((el) => /^(Workout|التمرين)$/i.test(String(el.textContent || "").trim()));
        workoutNav?.click?.();
      })
      .catch((error) => console.warn("[PUBLISHED_PLAN] training activation failed", error));
  });
  document.body.appendChild(modal);
}

function openNutritionModal(plan) {
  ensureStyles();
  closeModal();
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const modal = document.createElement("div");
  modal.setAttribute(MODAL_MARK, "1");
  modal.innerHTML = `
    <div class="ff-plan-sheet" role="dialog" aria-modal="true">
      <div style="font-size:10px;font-weight:900;letter-spacing:.7px;opacity:.6">PERSONALIZED NUTRITION PLAN</div>
      <div style="font-size:20px;font-weight:900;margin-top:4px">🍽️ ${esc(plan?.title || "Your Nutrition Plan")}</div>
      <div style="font-size:11.5px;opacity:.6;margin-top:5px">Starts ${esc(plan?.startDate || today())}</div>
      <div style="margin-top:12px">${days.map((day, index) => `
        <div class="ff-plan-row">
          <div class="ff-plan-day">${esc(day.title || `Day ${index + 1}`)}</div>
          ${day.targetKcal ? `<div class="ff-plan-item">${esc(day.targetKcal)} kcal${day.targetProtein ? ` · ${esc(day.targetProtein)}g protein` : ""}${day.targetCarbs ? ` · ${esc(day.targetCarbs)}g carbs` : ""}${day.targetFat ? ` · ${esc(day.targetFat)}g fat` : ""}</div>` : ""}
          ${(Array.isArray(day.meals) ? day.meals : []).map((meal) => `<div class="ff-plan-item"><b style="color:#fff">${esc(meal.title || "Meal")}</b>${meal.items ? ` — ${esc(meal.items).replace(/\n/g, " · ")}` : ""}</div>`).join("")}
        </div>`).join("")}</div>
      <div class="ff-plan-actions">
        <button type="button" class="ff-plan-btn ff-plan-primary" data-close>Use Plan</button>
      </div>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(modal);
}

function createCard(kind, plan) {
  const card = document.createElement("div");
  card.setAttribute(ROOT_MARK, kind);
  card.setAttribute("style", cardStyle());
  const isTraining = kind === "training";
  card.innerHTML = `
    <div style="font-size:10px;font-weight:900;letter-spacing:.65px;opacity:.6">${isTraining ? "PERSONALIZED TRAINING" : "PERSONALIZED NUTRITION"}</div>
    <div style="font-size:16px;font-weight:900;margin-top:4px">${isTraining ? "🏋️" : "🍽️"} ${esc(isTraining ? (plan.title || "Your Training Plan") : (plan.title || "Your Nutrition Plan"))}</div>
    <div style="font-size:11.5px;opacity:.62;margin-top:4px">${isTraining ? "Your custom workout schedule is ready." : "Your custom food plan is ready."}</div>
    <div style="font-size:11.5px;font-weight:900;margin-top:10px">Open plan →</div>`;
  card.addEventListener("click", () => isTraining ? openTrainingModal(plan) : openNutritionModal(plan));
  return card;
}

function render() {
  if (!userData) return;
  const root = document.getElementById("root");
  if (!root) return;
  const training = userData.customTrainingPlan;
  const nutrition = userData.customNutritionPlan;
  if (!training && !nutrition) return;

  const top = findTextRoot([/^(Plans|الخطط)$/i, /Your Nutrition Plan/i, /خطتك الغذائية/i, /Today's Workout/i, /تمرين اليوم/i]);
  if (!top) return;
  const host = top.closest("main") || top.parentElement?.parentElement || root;

  if (isNutritionScreen() && nutrition && !host.querySelector(`[${ROOT_MARK}="nutrition"]`)) {
    host.prepend(createCard("nutrition", nutrition));
  }
  if (isWorkoutScreen() && training && !host.querySelector(`[${ROOT_MARK}="training"]`)) {
    host.prepend(createCard("training", training));
  }
}

export function startPublishedPlansUx() {
  let stopped = false;
  let unsubscribeUser = null;
  let unsubscribeAuth = null;

  const bootUser = (user) => {
    if (unsubscribeUser) unsubscribeUser();
    unsubscribeUser = null;
    userData = null;
    userRef = null;
    if (!user || stopped) return;
    userRef = doc(db, "users", user.uid);
    unsubscribeUser = onSnapshot(userRef, (snap) => {
      userData = snap.exists() ? snap.data() : null;
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          render();
        });
      }
    }, (error) => console.warn("[PUBLISHED_PLAN] user listener failed", error));
  };

  unsubscribeAuth = onAuthStateChanged(auth, bootUser);
  observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        render();
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    stopped = true;
    closeModal();
    if (observer) observer.disconnect();
    if (unsubscribeUser) unsubscribeUser();
    if (unsubscribeAuth) unsubscribeAuth();
    observer = null;
    unsubscribeUser = null;
    unsubscribeAuth = null;
    userData = null;
    userRef = null;
  };
}
