import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

let userData = null;
let unsubscribeUser = null;

function isPlansPage() {
  const text = String(document.body?.innerText || "");
  return text.includes("Standard Plan") || text.includes("الخطة الأساسية مجانية للأبد");
}

function clickNutritionTab() {
  const nodes = [...document.querySelectorAll("button,[role='button'],a")];
  const nav = nodes.find((el) => /^(Nutrition|التغذية)$/i.test(String(el.textContent || "").trim()));
  if (nav) nav.click();
}

function inject() {
  if (!userData?.customNutritionPlan) return;
  if (!userData?.entitlements?.nutritionPro) return;
  if (!isPlansPage()) return;
  if (document.querySelector("[data-fifty-fit-published-nutrition-plan]")) return;

  const plan = userData.customNutritionPlan;
  const card = document.createElement("div");
  card.dataset.fiftyFitPublishedNutritionPlan = "1";
  card.style.cssText = "margin:10px 18px;padding:14px;border:1.5px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(255,255,255,.06);cursor:pointer";
  card.innerHTML = `<div style="font-size:10px;font-weight:900;letter-spacing:.6px;opacity:.65">PERSONALIZED PLAN</div><div style="font-size:15px;font-weight:900;margin-top:4px">🍽️ ${esc(plan.title || "Your Nutrition Plan")}</div><div style="font-size:11.5px;opacity:.65;margin-top:4px">${plan.startDate ? `Starts ${esc(plan.startDate)}` : "Published by Fifty Fit"}</div><div style="font-size:11.5px;font-weight:800;margin-top:9px">Open Nutrition Plan →</div>`;
  card.addEventListener("click", () => {
    clickNutritionTab();
    setTimeout(() => {
      const title = String(plan.title || "Your Nutrition Plan");
      const candidates = [...document.querySelectorAll("div,button")].filter((el) => String(el.textContent || "").includes(title));
      const target = candidates.find((el) => el !== card && !el.closest("[data-fifty-fit-published-nutrition-plan]"));
      if (target) target.closest("button")?.click?.();
    }, 300);
  });

  const builtIn = [...document.querySelectorAll("div")].find((el) => String(el.textContent || "").includes("Standard Plan") && el.querySelector?.("button"));
  if (builtIn?.parentElement) builtIn.parentElement.insertBefore(card, builtIn);
  else document.querySelector("#root")?.prepend(card);
}

onAuthStateChanged(auth, (user) => {
  unsubscribeUser?.();
  unsubscribeUser = null;
  userData = null;
  if (!user) return;
  unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
    userData = snap.exists() ? snap.data() : null;
    inject();
  });
});

const observer = new MutationObserver(() => inject());
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(inject, 300);
setTimeout(inject, 1000);
