import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

let userData = null;
let loadedUid = null;

async function loadUser(uid) {
  if (!uid || uid === loadedUid) return;
  loadedUid = uid;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    userData = snap.exists() ? snap.data() : null;
  } catch {
    userData = null;
  }
}

function isPlansPage() {
  return [...document.querySelectorAll("h1")].some((h) => /^(Plans|الخطط)$/i.test(String(h.textContent || "").trim()));
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

  const heading = [...document.querySelectorAll("h1")].find((h) => /^(Plans|الخطط)$/i.test(String(h.textContent || "").trim()));
  if (!heading) return;
  const host = heading.closest("main") || heading.parentElement?.parentElement || document.body;
  const card = document.createElement("div");
  card.dataset.fiftyFitPublishedNutritionPlan = "1";
  card.style.cssText = "margin:10px 18px;padding:14px;border:1.5px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(255,255,255,.06);cursor:pointer";
  const plan = userData.customNutritionPlan;
  card.innerHTML = `<div style="font-size:10px;font-weight:900;letter-spacing:.6px;opacity:.65">PERSONALIZED PLAN</div><div style="font-size:15px;font-weight:900;margin-top:4px">🍽️ ${esc(plan.title || "Your Nutrition Plan")}</div><div style="font-size:11.5px;opacity:.65;margin-top:4px">${plan.startDate ? `Starts ${esc(plan.startDate)}` : "Published by Fifty Fit"}</div><div style="font-size:11.5px;font-weight:800;margin-top:9px">Open Nutrition Plan →</div>`;
  card.addEventListener("click", () => {
    clickNutritionTab();
    setTimeout(() => {
      const title = String(plan.title || "Your Nutrition Plan");
      const candidates = [...document.querySelectorAll("div,button")].filter((el) => String(el.textContent || "").includes(title));
      const target = candidates.find((el) => el !== card && el.closest("[data-fifty-fit-published-nutrition-plan]") == null);
      if (target) target.closest("button")?.click?.();
    }, 250);
  });

  const firstCard = host.querySelector("div");
  if (firstCard?.parentElement) firstCard.parentElement.insertBefore(card, firstCard);
  else host.prepend(card);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    userData = null;
    loadedUid = null;
    return;
  }
  loadUser(user.uid).then(() => inject());
});

const observer = new MutationObserver(() => inject());
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(inject, 300);
setTimeout(inject, 1000);
