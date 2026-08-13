import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Keep the admin builder aligned with the nutrition database already shipped
// in the customer app. Values are per 100 g unless the food itself is normally
// consumed by weight (the UI still lets the coach choose the exact grams).
const FOODS = [
  { id: "rice_white", name: "White Rice (cooked)", ar: "أرز أبيض (مسلوق)", kcal: 130, p: 2.7, c: 28.2, f: 0.3 },
  { id: "rice_brown", name: "Brown Rice (cooked)", ar: "أرز أسمر (مسلوق)", kcal: 112, p: 2.6, c: 23.5, f: 0.9 },
  { id: "pasta", name: "Pasta (cooked)", ar: "مكرونة (مسلوقة)", kcal: 131, p: 5, c: 25.1, f: 1.1 },
  { id: "oats", name: "Oats (dry)", ar: "شوفان (ناشف)", kcal: 389, p: 16.9, c: 66.3, f: 6.9 },
  { id: "baladi_bread", name: "Baladi Bread", ar: "عيش بلدي", kcal: 275, p: 9.5, c: 55, f: 1.5 },
  { id: "whole_wheat_bread", name: "Whole Wheat Bread", ar: "عيش أسمر", kcal: 247, p: 13, c: 41, f: 3.4 },
  { id: "potato", name: "Potato (boiled)", ar: "بطاطس (مسلوقة)", kcal: 87, p: 1.9, c: 20.1, f: 0.1 },
  { id: "sweet_potato", name: "Sweet Potato (boiled)", ar: "بطاطا (مسلوقة)", kcal: 76, p: 1.4, c: 17.7, f: 0.1 },
  { id: "chicken_breast", name: "Chicken Breast (grilled)", ar: "صدر فراخ (مشوي)", kcal: 165, p: 31, c: 0, f: 3.6 },
  { id: "chicken_thigh", name: "Chicken Thigh (grilled)", ar: "فخذ فراخ (مشوي)", kcal: 209, p: 25.9, c: 0, f: 10.9 },
  { id: "beef", name: "Lean Beef (grilled)", ar: "لحم بقري (مشوي)", kcal: 215, p: 26.1, c: 0, f: 12 },
  { id: "ground_beef", name: "Ground Beef", ar: "لحم مفروم", kcal: 218, p: 23.9, c: 0, f: 13.2 },
  { id: "kofta", name: "Grilled Kofta", ar: "كفتة مشوية", kcal: 246, p: 19, c: 2, f: 17.5 },
  { id: "turkey", name: "Turkey Breast", ar: "صدر ديك رومي", kcal: 135, p: 29.9, c: 0, f: 1 },
  { id: "egg", name: "Egg (whole)", ar: "بيضة كاملة", kcal: 155, p: 12.6, c: 1.1, f: 10.6 },
  { id: "egg_white", name: "Egg White", ar: "بياض البيضة", kcal: 52, p: 10.9, c: 0.7, f: 0.2 },
  { id: "tuna", name: "Tuna (canned in water)", ar: "تونة (معلبة بالماء)", kcal: 116, p: 25.5, c: 0, f: 0.8 },
  { id: "salmon", name: "Salmon (grilled)", ar: "سالمون (مشوي)", kcal: 208, p: 20.4, c: 0, f: 13.4 },
  { id: "shrimp", name: "Shrimp (boiled)", ar: "جمبري (مسلوق)", kcal: 99, p: 23.7, c: 0.2, f: 0.3 },
  { id: "fava", name: "Fava Beans / Ful", ar: "فول", kcal: 110, p: 7.6, c: 18, f: 0.4 },
  { id: "lentils", name: "Lentils (cooked)", ar: "عدس (مطبوخ)", kcal: 116, p: 9, c: 20.1, f: 0.4 },
  { id: "falafel", name: "Falafel", ar: "طعمية", kcal: 333, p: 13.3, c: 31.8, f: 17.8 },
  { id: "hummus", name: "Hummus", ar: "حمص بطحينة", kcal: 166, p: 7.9, c: 14.3, f: 9.6 },
  { id: "milk", name: "Whole Milk", ar: "لبن كامل الدسم", kcal: 61, p: 3.2, c: 4.8, f: 3.3 },
  { id: "low_fat_milk", name: "Low-Fat Milk", ar: "لبن قليل الدسم", kcal: 50, p: 3.3, c: 4.8, f: 2 },
  { id: "yogurt", name: "Plain Yogurt", ar: "زبادي سادة", kcal: 61, p: 3.5, c: 4.7, f: 3.3 },
  { id: "greek_yogurt", name: "Greek Yogurt", ar: "زبادي يوناني", kcal: 59, p: 10, c: 3.6, f: 0.4 },
  { id: "cottage", name: "Cottage Cheese", ar: "جبنة قريش", kcal: 98, p: 11.1, c: 3.4, f: 4.3 },
  { id: "banana", name: "Banana", ar: "موز", kcal: 89, p: 1.1, c: 22.8, f: 0.3 },
  { id: "apple", name: "Apple", ar: "تفاح", kcal: 52, p: 0.3, c: 13.8, f: 0.2 },
  { id: "orange", name: "Orange", ar: "برتقال", kcal: 47, p: 0.9, c: 11.8, f: 0.1 },
  { id: "dates", name: "Dates", ar: "بلح", kcal: 282, p: 2.5, c: 75, f: 0.4 },
  { id: "avocado", name: "Avocado", ar: "أفوكادو", kcal: 160, p: 2, c: 8.5, f: 14.7 },
  { id: "olive_oil", name: "Olive Oil", ar: "زيت زيتون", kcal: 884, p: 0, c: 0, f: 100 },
  { id: "peanuts", name: "Peanuts", ar: "فول سوداني", kcal: 567, p: 25.8, c: 16.1, f: 49.2 },
  { id: "almonds", name: "Almonds", ar: "لوز", kcal: 579, p: 21.2, c: 21.6, f: 49.9 },
  { id: "tahini", name: "Tahini", ar: "طحينة", kcal: 595, p: 17, c: 21.2, f: 53.8 },
];

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function findCustomerUid() {
  const text = document.body?.innerText || "";
  const match = text.match(/UID\s+([A-Za-z0-9_-]{20,})/);
  return match ? match[1] : null;
}

function mealTextarea(card) {
  return card?.querySelector?.("textarea[data-meal-items]") || null;
}

function parseLines(text) {
  return String(text || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

function structuredLine(food, grams) {
  const scale = Number(grams) / 100;
  const kcal = Math.round(food.kcal * scale);
  const protein = Math.round(food.p * scale * 10) / 10;
  const carbs = Math.round(food.c * scale * 10) / 10;
  const fat = Math.round(food.f * scale * 10) / 10;
  return `${food.name}|${Number(grams)}g|${kcal}|${protein}|${carbs}|${fat}`;
}

function enhanceMealCard(card) {
  if (!card || card.dataset.foodPickerReady === "1") return;
  const textarea = mealTextarea(card);
  if (!textarea) return;
  card.dataset.foodPickerReady = "1";
  textarea.readOnly = true;
  textarea.style.minHeight = "70px";
  textarea.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

  const wrap = document.createElement("div");
  wrap.className = "fifty-food-picker";
  wrap.style.cssText = "margin-top:10px;padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.025)";
  wrap.innerHTML = `<div style="font-weight:800;margin-bottom:4px">Food items</div>
    <div style="font-size:11px;opacity:.65;margin-bottom:9px">Choose a food, set the grams, then add it. Nutrition is calculated automatically per 100g.</div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center">
      <div><input data-food-search placeholder="Search food / ابحث عن الأكل" style="width:100%;box-sizing:border-box" /></div>
      <input data-food-grams type="number" min="1" step="1" value="100" style="width:100%;box-sizing:border-box" />
      <button type="button" data-food-add class="secondary">+ Add</button>
    </div>
    <select data-food-select size="5" style="width:100%;margin-top:8px;box-sizing:border-box"></select>
    <div data-food-items style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px"></div>`;
  textarea.parentElement?.insertBefore(wrap, textarea);

  const search = wrap.querySelector("[data-food-search]");
  const select = wrap.querySelector("[data-food-select]");
  const grams = wrap.querySelector("[data-food-grams]");
  const add = wrap.querySelector("[data-food-add]");
  const items = wrap.querySelector("[data-food-items]");

  function refreshOptions() {
    const q = String(search.value || "").trim().toLowerCase();
    const rows = FOODS.filter((f) => !q || `${f.name} ${f.ar}`.toLowerCase().includes(q)).slice(0, 40);
    select.innerHTML = rows.map((f) => `<option value="${esc(f.id)}">${esc(f.name)} — ${esc(f.ar)} · ${f.kcal} kcal/100g</option>`).join("");
  }

  function renderItems() {
    const lines = parseLines(textarea.value);
    items.innerHTML = lines.map((line, index) => {
      const parts = line.split("|");
      const label = parts.length >= 2 ? `${parts[0]} · ${parts[1]}` : line;
      return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid rgba(255,255,255,.15);border-radius:999px;font-size:11px">${esc(label)} <button type="button" data-food-remove="${index}" style="border:0;background:transparent;color:#ff6b6b;cursor:pointer">×</button></span>`;
    }).join("");
    items.querySelectorAll("[data-food-remove]").forEach((button) => {
      button.onclick = () => {
        const linesNow = parseLines(textarea.value);
        linesNow.splice(Number(button.dataset.foodRemove), 1);
        textarea.value = linesNow.join("\n");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        renderItems();
      };
    });
  }

  function addFood() {
    const food = FOODS.find((f) => f.id === select.value);
    const amount = Number(grams.value);
    if (!food || !Number.isFinite(amount) || amount <= 0) return;
    const lines = parseLines(textarea.value);
    lines.push(structuredLine(food, amount));
    textarea.value = lines.join("\n");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    renderItems();
  }

  search.addEventListener("input", refreshOptions);
  select.addEventListener("change", () => { if (select.value) search.value = FOODS.find((f) => f.id === select.value)?.name || search.value; });
  add.addEventListener("click", addFood);
  refreshOptions();
  renderItems();
}

function enhanceNutritionEditor() {
  document.querySelectorAll(".meal-card").forEach(enhanceMealCard);
}

function findNutritionPlanData(uid) {
  return getDoc(doc(db, "users", uid)).then((snap) => snap.exists() ? snap.data() : null).catch(() => null);
}

function injectPublishedPlanCard(data) {
  if (!data?.customNutritionPlan || !data?.entitlements?.nutritionPro) return;
  const headings = [...document.querySelectorAll("h1")];
  const isPlansPage = headings.some((h) => /^(Plans|الخطط)$/i.test(h.textContent.trim()));
  if (!isPlansPage || document.querySelector("[data-fifty-published-nutrition]")) return;

  const anchor = headings.find((h) => /^(Plans|الخطط)$/i.test(h.textContent.trim()));
  const host = anchor?.closest(".main") || anchor?.parentElement?.parentElement;
  if (!host) return;
  const card = document.createElement("div");
  card.dataset.fiftyPublishedNutrition = "1";
  card.style.cssText = "margin:10px 18px;padding:14px;border:1.5px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(255,255,255,.06);cursor:pointer";
  const title = data.customNutritionPlan.title || "Your Nutrition Plan";
  const start = data.customNutritionPlan.startDate || "";
  card.innerHTML = `<div style="font-size:11px;font-weight:800;letter-spacing:.4px;opacity:.65">PERSONALIZED NUTRITION</div><div style="font-size:15px;font-weight:900;margin-top:4px">🍽️ ${esc(title)}</div><div style="font-size:11.5px;opacity:.65;margin-top:4px">Published plan${start ? ` · starts ${esc(start)}` : ""}</div><div style="font-size:11.5px;font-weight:800;margin-top:9px">Open Nutrition →</div>`;
  card.onclick = () => {
    const nav = [...document.querySelectorAll("button,[role='button'],a")].find((el) => /^(Nutrition|التغذية)$/i.test(String(el.textContent || "").trim()));
    if (nav) nav.click();
  };
  const firstPanel = host.querySelector(".panel");
  if (firstPanel) firstPanel.parentElement.insertBefore(card, firstPanel);
  else host.appendChild(card);
}

let cachedUserData = null;
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  cachedUserData = await findNutritionPlanData(user.uid);
  enhanceNutritionEditor();
  injectPublishedPlanCard(cachedUserData);
});

const observer = new MutationObserver(() => {
  enhanceNutritionEditor();
  if (cachedUserData) injectPublishedPlanCard(cachedUserData);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(enhanceNutritionEditor, 300);
setTimeout(enhanceNutritionEditor, 1000);
