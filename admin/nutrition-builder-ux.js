/* Fifty Fit — Pro Nutrition Builder UX
 *
 * This is a presentation layer over the existing nutrition-plan textarea.
 * The textarea remains in the DOM as the compatibility/storage bridge so
 * existing published plans and the app parser keep working unchanged.
 */

const NUTRITION_FOODS = [
  ["rice_white", "White Rice (cooked)", "أرز أبيض (مسلوق)", 130, 2.7, 28.2, 0.3],
  ["rice_brown", "Brown Rice (cooked)", "أرز أسمر (مسلوق)", 112, 2.6, 23.5, 0.9],
  ["pasta_cooked", "Pasta (cooked)", "مكرونة (مسلوقة)", 131, 5, 25.1, 1.1],
  ["oats_dry", "Oats (dry)", "شوفان (ناشف)", 389, 16.9, 66.3, 6.9],
  ["quinoa_cooked", "Quinoa (cooked)", "كينوا (مسلوقة)", 120, 4.4, 21.3, 1.9],
  ["bread_white", "White Bread", "عيش أبيض", 265, 9, 49, 3.2],
  ["bread_baladi", "Baladi Bread", "عيش بلدي", 275, 9.5, 55, 1.5],
  ["bread_whole_wheat", "Whole Wheat Bread", "عيش أسمر", 247, 13, 41, 3.4],
  ["sweet_potato", "Sweet Potato (boiled)", "بطاطا (مسلوقة)", 76, 1.4, 17.7, 0.1],
  ["potato_boiled", "Potato (boiled)", "بطاطس (مسلوقة)", 87, 1.9, 20.1, 0.1],
  ["french_fries", "French Fries", "بطاطس محمرة", 312, 3.4, 41.4, 14.7],
  ["chicken_breast", "Chicken Breast (grilled)", "صدر فراخ (مشوي)", 165, 31, 0, 3.6],
  ["chicken_thigh", "Chicken Thigh (grilled)", "فخذ فراخ (مشوي)", 209, 25.9, 0, 10.9],
  ["beef_lean", "Lean Beef (grilled)", "لحم بقري (مشوي)", 215, 26.1, 0, 12],
  ["ground_beef", "Ground Beef (85% lean)", "لحم مفروم", 218, 23.9, 0, 13.2],
  ["kofta", "Grilled Kofta", "كفتة مشوية", 246, 19, 2, 17.5],
  ["turkey_breast", "Turkey Breast", "صدر ديك رومي", 135, 29.9, 0, 1],
  ["egg", "Egg (whole)", "بيضة كاملة", 155, 12.6, 1.1, 10.6],
  ["egg_white", "Egg White", "بياض البيضة", 52, 10.9, 0.7, 0.2],
  ["tuna", "Tuna (canned in water)", "تونة (معلبة بالماء)", 116, 25.5, 0, 0.8],
  ["salmon", "Salmon (grilled)", "سالمون (مشوي)", 208, 20.4, 0, 13.4],
  ["shrimp", "Shrimp (boiled)", "جمبري (مسلوق)", 99, 23.7, 0.2, 0.3],
  ["fava_beans", "Fava Beans / Ful", "فول", 110, 7.6, 18, 0.4],
  ["chickpeas_cooked", "Chickpeas (cooked)", "حمص (مطبوخ)", 164, 8.9, 27.4, 2.6],
  ["peanuts", "Peanuts", "فول سوداني", 567, 25.8, 16.1, 49.2],
  ["lentils_cooked", "Lentils (cooked)", "عدس (مطبوخ)", 116, 9, 20.1, 0.4],
  ["falafel", "Falafel", "طعمية", 333, 13.3, 31.8, 17.8],
  ["hummus", "Hummus", "حمص بطحينة", 166, 7.9, 14.3, 9.6],
  ["milk", "Whole Milk", "لبن كامل الدسم", 61, 3.2, 4.8, 3.3],
  ["milk_low_fat", "Low-Fat Milk (2%)", "لبن قليل الدسم (٢٪)", 50, 3.3, 4.8, 2],
  ["milk_skim", "Skimmed Milk", "لبن خالي الدسم", 34, 3.4, 5, 0.1],
  ["yogurt", "Plain Yogurt", "زبادي سادة", 61, 3.5, 4.7, 3.3],
  ["greek_yogurt", "Greek Yogurt (0% fat)", "زبادي يوناني", 59, 10, 3.6, 0.4],
  ["white_cheese", "White Cheese", "جبنة بيضاء", 264, 14.1, 3.8, 21.4],
  ["cottage_cheese", "Cottage Cheese", "جبنة قريش", 98, 11.1, 3.4, 4.3],
  ["olive_oil", "Olive Oil", "زيت زيتون", 884, 0, 0, 100],
  ["butter", "Butter", "زبدة", 717, 0.9, 0.1, 81.1],
  ["peanut_butter", "Peanut Butter (natural)", "زبدة فول سوداني", 598, 25.1, 13.4, 51.4],
  ["avocado", "Avocado", "أفوكادو", 160, 2, 8.5, 14.7],
  ["tomato", "Tomato", "طماطم", 18, 0.9, 3.9, 0.2],
  ["cucumber", "Cucumber", "خيار", 15, 0.7, 3.6, 0.1],
  ["spinach", "Spinach", "سبانخ", 23, 2.9, 3.6, 0.4],
  ["broccoli", "Broccoli", "بروكلي", 34, 2.8, 7, 0.4],
  ["salad_greens", "Mixed Salad Greens", "خضار سلطة مشكلة", 15, 1.4, 2.9, 0.2],
  ["molokhia", "Molokhia (cooked)", "ملوخية (مطبوخة)", 50, 4.8, 6, 1],
  ["banana", "Banana", "موز", 89, 1.1, 22.8, 0.3],
  ["apple", "Apple", "تفاح", 52, 0.3, 13.8, 0.2],
  ["orange", "Orange", "برتقال", 47, 0.9, 11.8, 0.1],
  ["watermelon", "Watermelon", "بطيخ", 30, 0.6, 7.6, 0.2],
  ["mango", "Mango", "مانجا", 60, 0.8, 14.8, 0.4],
  ["dates", "Medjool Dates", "تمر", 277, 1.8, 74.9, 0.2],
  ["prickly_pear", "Prickly Pear (Cactus Fruit)", "تين شوكي", 41, 0.7, 9.6, 0.5],
  ["grapes", "Grapes", "عنب", 69, 0.7, 18.1, 0.2],
  ["strawberry", "Strawberries", "فراولة", 32, 0.7, 7.7, 0.3],
  ["honey", "Honey", "عسل", 304, 0.3, 82.4, 0],
  ["sugar", "Sugar", "سكر", 387, 0, 100, 0],
  ["dark_chocolate", "Dark Chocolate (70%+)", "شوكولاتة داكنة (70%+)", 598, 7.8, 45.9, 42.6],
  ["almonds", "Almonds", "لوز", 579, 21.2, 21.6, 49.9],
  ["tahini", "Tahini (Sesame Paste)", "طحينة", 595, 17, 21.2, 53.8],
  ["chicken_whole_roasted", "Roast Chicken (meat only)", "فراخ مشوية (لحم فقط)", 190, 28.9, 0, 7.4],
  ["chicken_drumstick", "Chicken Drumstick (roasted)", "دبوس فراخ (مشوي)", 172, 28.3, 0, 5.7],
  ["chicken_liver", "Chicken Liver (cooked)", "كبدة فراخ (مطبوخة)", 167, 24.5, 0.9, 6.5],
  ["beef_liver", "Beef Liver (cooked)", "كبدة بقري (مطبوخة)", 175, 26.5, 5.1, 4.7],
  ["lamb_lean", "Lamb (cooked, lean)", "لحم ضاني (مطبوخ)", 258, 25.6, 0, 16.5],
  ["sardines_canned", "Sardines (canned in oil)", "سردين (معلب بالزيت)", 208, 24.6, 0, 11.5],
  ["mackerel", "Mackerel (cooked)", "ماكريل (مطبوخ)", 262, 23.8, 0, 17.8],
  ["tilapia", "Tilapia (cooked)", "بلطي (مطبوخ)", 129, 26.2, 0, 2.7],
  ["cod", "Cod (cooked)", "سمك قد (مطبوخ)", 105, 22.8, 0, 0.9],
  ["mozzarella", "Mozzarella (part-skim)", "موتزاريلا (نصف دسم)", 254, 24.3, 2.8, 15.9],
  ["cheddar", "Cheddar Cheese", "جبنة شيدر", 403, 22.9, 3.1, 33.1],
  ["cream_cheese", "Cream Cheese", "جبنة كريمي", 350, 6.2, 5.5, 34.4],
  ["soy_milk", "Soy Milk (unsweetened)", "لبن صويا (بدون سكر)", 33, 2.9, 1.8, 1.6],
  ["pasta_whole_wheat", "Whole Wheat Pasta (cooked)", "مكرونة أسمر (مسلوقة)", 124, 5.3, 26.5, 0.5],
  ["couscous_cooked", "Couscous (cooked)", "كسكسي (مطبوخ)", 112, 3.8, 23.2, 0.2],
  ["cornflakes", "Corn Flakes", "كورن فليكس", 357, 7.5, 84.1, 0.4],
  ["corn_cooked", "Sweet Corn (cooked)", "ذرة حلوة (مسلوقة)", 96, 3.4, 21, 1.5],
  ["kidney_beans_cooked", "Kidney Beans (cooked)", "فاصوليا حمراء (مطبوخة)", 127, 8.7, 22.8, 0.5],
];

const FOOD_MAP = new Map(NUTRITION_FOODS.map((x) => [x[0], x]));
const uidPart = () => Math.random().toString(36).slice(2, 8);

function foodForText(text) {
  const q = String(text || "").trim().toLowerCase();
  return NUTRITION_FOODS.find((f) =>
    [f[1], f[2], f[0]].some((v) => String(v).toLowerCase().includes(q))
  );
}

function parseLine(line, index) {
  const a = String(line || "").split("|").map((x) => x.trim());
  const food = foodForText(a[0]) || null;
  return {
    id: `${food?.[0] || "custom"}-${index}-${uidPart()}`,
    name: a[0] || "Food",
    grams: Number(String(a[1] || "100").replace(/[^0-9.]/g, "")) || 100,
    kcal: Number(a[2]) || 0,
    protein: Number(a[3]) || 0,
    carbs: Number(a[4]) || 0,
    fat: Number(a[5]) || 0,
  };
}

function serialize(items) {
  return items.map((x) => `${x.name}|${x.grams}g|${x.kcal}|${x.protein}|${x.carbs}|${x.fat}`).join("\n");
}

function calc(food, grams) {
  const scale = Number(grams || 0) / 100;
  return {
    kcal: Math.round(food[3] * scale),
    protein: Number((food[4] * scale).toFixed(1)),
    carbs: Number((food[5] * scale).toFixed(1)),
    fat: Number((food[6] * scale).toFixed(1)),
  };
}

function css() {
  if (document.getElementById("ff-nutrition-builder-style")) return;
  const style = document.createElement("style");
  style.id = "ff-nutrition-builder-style";
  style.textContent = `
    .ff-food-builder{margin-top:8px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#0a0a0a}
    .ff-food-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
    .ff-food-head b{color:#fff;font-size:13px}.ff-food-head span{color:#777;font-size:10px}
    .ff-food-row{display:grid;grid-template-columns:minmax(0,1fr) 100px auto;gap:8px;align-items:center}
    .ff-food-builder input,.ff-food-builder select{box-sizing:border-box;width:100%;min-height:38px;background:#111;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:8px 10px;outline:none}
    .ff-food-builder input:focus,.ff-food-builder select:focus{border-color:rgba(255,255,255,.5)}
    .ff-food-preview{margin-top:9px;padding:10px;border-radius:10px;background:#111;border:1px solid rgba(255,255,255,.08);color:#aaa;font-size:10.5px;display:none}
    .ff-food-preview strong{color:#fff}.ff-food-add{margin-top:9px;width:100%;border:0;border-radius:10px;padding:10px;background:#fff;color:#000;font-weight:900;cursor:pointer}
    .ff-food-items{display:flex;flex-direction:column;gap:6px;margin-top:10px}.ff-food-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;background:#111;border:1px solid rgba(255,255,255,.08)}
    .ff-food-item-main{flex:1;min-width:0}.ff-food-item-main b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ff-food-item-main span{color:#777;font-size:10px}
    .ff-food-remove{border:0;background:transparent;color:#777;font-size:18px;cursor:pointer;padding:2px 5px}.ff-food-remove:hover{color:#ef4444}
    .ff-food-total{display:flex;gap:10px;flex-wrap:wrap;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08);color:#aaa;font-size:10px}.ff-food-total b{color:#fff}
    @media(max-width:700px){.ff-food-row{grid-template-columns:1fr 92px}.ff-food-row .ff-food-add-placeholder{display:none}}
  `;
  document.head.appendChild(style);
}

function enhanceTextarea(textarea) {
  if (!textarea || textarea.__ffNutritionEnhanced) return;
  textarea.__ffNutritionEnhanced = true;
  css();

  const initial = String(textarea.value || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  let items = initial.map(parseLine);

  textarea.style.display = "none";
  const builder = document.createElement("div");
  builder.className = "ff-food-builder";
  textarea.parentElement.insertBefore(builder, textarea.nextSibling);

  const render = () => {
    const totals = items.reduce((s, x) => ({
      kcal: s.kcal + x.kcal, protein: s.protein + x.protein, carbs: s.carbs + x.carbs, fat: s.fat + x.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    builder.querySelector(".ff-food-items").innerHTML = items.map((x, i) => `
      <div class="ff-food-item">
        <div class="ff-food-item-main"><b>${escapeHtml(x.name)} · ${x.grams}g</b><span>${x.kcal} kcal · P ${x.protein}g · C ${x.carbs}g · F ${x.fat}g</span></div>
        <button type="button" class="ff-food-remove" data-remove="${i}" aria-label="Remove">×</button>
      </div>`).join("");
    builder.querySelector(".ff-food-total").innerHTML = `<b>${Math.round(totals.kcal)} kcal</b><b>${totals.protein.toFixed(1)}g P</b><b>${totals.carbs.toFixed(1)}g C</b><b>${totals.fat.toFixed(1)}g F</b>`;
    builder.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => { items.splice(Number(b.dataset.remove), 1); sync(); render(); });
  };

  builder.innerHTML = `
    <div class="ff-food-head"><b>Build this meal</b><span>Choose food → grams → Add</span></div>
    <div class="ff-food-row">
      <input class="ff-food-search" placeholder="Search food… / ابحث عن أكلة" autocomplete="off" />
      <input class="ff-food-grams" type="number" min="1" step="1" value="100" aria-label="grams" />
      <div class="ff-food-add-placeholder"></div>
    </div>
    <div class="ff-food-preview"></div>
    <button type="button" class="ff-food-add">+ Add food to this meal</button>
    <div class="ff-food-items"></div>
    <div class="ff-food-total"></div>`;

  const search = builder.querySelector(".ff-food-search");
  const grams = builder.querySelector(".ff-food-grams");
  const preview = builder.querySelector(".ff-food-preview");
  let selected = null;

  const updatePreview = () => {
    const q = search.value.trim().toLowerCase();
    selected = q ? NUTRITION_FOODS.find((f) => `${f[1]} ${f[2]} ${f[0]}`.toLowerCase().includes(q)) : null;
    if (!selected) { preview.style.display = "none"; return; }
    const n = calc(selected, grams.value);
    preview.style.display = "block";
    preview.innerHTML = `<strong>${escapeHtml(selected[1])}</strong> · ${escapeHtml(selected[2])}<br>${grams.value || 0}g → ${n.kcal} kcal · P ${n.protein}g · C ${n.carbs}g · F ${n.fat}g`;
  };
  search.oninput = updatePreview; grams.oninput = updatePreview;
  builder.querySelector(".ff-food-add").onclick = () => {
    if (!selected) { alert("Choose a food from the search results first."); return; }
    const g = Number(grams.value);
    if (!Number.isFinite(g) || g <= 0) { alert("Enter a valid gram amount."); return; }
    const n = calc(selected, g);
    items.push({ id: `${selected[0]}-${uidPart()}`, name: selected[1], grams: g, ...n });
    sync(); render(); search.value = ""; grams.value = 100; selected = null; preview.style.display = "none";
  };

  function sync() {
    textarea.value = serialize(items);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

function scanNutritionEditor() {
  document.querySelectorAll("#nutrition-day textarea[data-meal-items]").forEach(enhanceTextarea);
}

const observer = new MutationObserver(scanNutritionEditor);
observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
scanNutritionEditor();
