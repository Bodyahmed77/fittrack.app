import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const root = document.getElementById("app");

const EXERCISES = [
  ["bench_press", "Bench Press", "ضغط البنش"], ["incline_db_press", "Incline Dumbbell Press", "ضغط دمبل مائل"],
  ["chest_fly", "Chest Fly", "فراشة صدر"], ["dips", "Dips", "ديبس"], ["tricep_pushdown", "Tricep Pushdown", "ترايسبس"],
  ["overhead_ext", "Overhead Tricep Extension", "ترايسبس فوق الرأس"], ["push_up", "Push Up", "ضغط"], ["zigzag_tricep_ext", "Zigzag Tricep Extension", "ترايسبس زجزاج"],
  ["lat_pulldown", "Lat Pulldown", "سحب عالي"], ["barbell_row", "T-Bar Row", "تجديف T-Bar"], ["seated_row", "Seated Row", "سحب أرضي"],
  ["single_arm_seated_row", "Single Arm Seated Row", "سحب أرضي بذراع واحدة"], ["bicep_curl", "Behind Body Bicep Curl", "بايسبس خلف الجسم"], ["hammer_curl", "Hammer Curl", "هامر كيرل"],
  ["supported_db_curl", "Supported Dumbbell Curl", "بايسبس دمبل مسنود"], ["squat", "Smith Machine Squat", "سكوات سميث"], ["hack_squat", "Hack Squat", "هاك سكوات"],
  ["leg_press", "Leg Press", "ضغط الأرجل"], ["leg_extension", "Leg Extension", "تمديد الأرجل"], ["abduction", "Abduction Machine", "جهاز إبعاد الفخذ"],
  ["reverse_curl", "Cable Reverse Curl", "كيرل عكسي"], ["face_pull", "Face Pull", "فيس بول"], ["lunges", "Bulgarian Split Squat", "سكوات بلغاري"],
  ["leg_curl", "Leg Curl", "خلفيات"], ["calf_raise", "Standing Calf Raise", "سمانة واقف"], ["ohp", "Shoulder Press Machine", "ضغط كتف"],
  ["lateral_raise", "Lateral Raise", "رفرفة جانبية"], ["rear_delt_fly", "Rear Delt Fly", "فراشة كتف خلفي"], ["shrugs", "Shrugs", "هز كتف"],
  ["deadlift", "Romanian Deadlift", "ديد ليفت روماني"], ["pull_up", "Pull Up", "عقلة"], ["plank", "Plank", "بلانك"],
  ["treadmill", "Treadmill Walk/Run", "مشاية"], ["bike", "Stationary Bike", "دراجة ثابتة"], ["crunches", "Abs Rope Crunches", "بطن بالحبل"],
  ["leg_raise", "Hanging Leg Raise", "رفع الرجل"], ["jump_rope", "Jump Rope", "نط الحبل"], ["burpees", "Burpees", "بيربيس"],
];
const DAY_NAMES = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
const MEALS = [
  ["breakfast", "Breakfast", "الفطار"],
  ["lunch", "Lunch", "الغدا"],
  ["dinner", "Dinner", "العشا"],
  ["snacks", "Snacks", "سناكس"],
];

let currentUser = null;
let currentCustomer = null;
let activeDay = 0;
let planDraft = null;
let nutritionDraft = null;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
function dateToday() { return new Date().toISOString().slice(0, 10); }
function emptyTrainingPlan() {
  return { version: 1, title: "Personal Training Plan", titleAr: "خطة التدريب المخصصة", startDate: dateToday(), days: DAY_NAMES.map((title) => ({ title, titleAr: title.replace("Day", "اليوم"), exercises: [] })) };
}
function emptyNutritionPlan() {
  return {
    version: 1, title: "Your Nutrition Plan", titleAr: "خطتك الغذائية", startDate: dateToday(),
    days: DAY_NAMES.map((title, i) => ({
      title, titleAr: `اليوم ${i + 1}`, targetKcal: "", targetProtein: "", targetCarbs: "", targetFat: "",
      meals: MEALS.map(([id, name, nameAr]) => ({ id, title: name, titleAr: nameAr, items: "", note: "", noteAr: "" })),
    })),
  };
}
function normalizeTraining(raw) {
  const p = raw && Array.isArray(raw.days) ? raw : emptyTrainingPlan();
  p.days = DAY_NAMES.map((fallback, i) => ({ title: p.days[i]?.title || fallback, titleAr: p.days[i]?.titleAr || `اليوم ${i + 1}`, exercises: Array.isArray(p.days[i]?.exercises) ? p.days[i].exercises : [] }));
  p.startDate ||= dateToday();
  return p;
}
function normalizeNutrition(raw) {
  const p = raw && Array.isArray(raw.days) ? raw : emptyNutritionPlan();
  p.days = DAY_NAMES.map((fallback, i) => ({
    title: p.days[i]?.title || fallback, titleAr: p.days[i]?.titleAr || `اليوم ${i + 1}`,
    targetKcal: p.days[i]?.targetKcal ?? "", targetProtein: p.days[i]?.targetProtein ?? "", targetCarbs: p.days[i]?.targetCarbs ?? "", targetFat: p.days[i]?.targetFat ?? "",
    meals: MEALS.map(([id, name, nameAr]) => {
      const old = (p.days[i]?.meals || []).find((m) => m.id === id) || {};
      return { id, title: old.title || name, titleAr: old.titleAr || nameAr, items: old.items || "", note: old.note || "", noteAr: old.noteAr || "" };
    }),
  }));
  p.startDate ||= dateToday();
  return p;
}

function shell(content, active = "customers") {
  root.innerHTML = `<div class="admin-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div>
      <nav>
        <button class="nav-btn ${active === "customers" ? "active" : ""}" data-nav="customers">Customers</button>
        <button class="nav-btn ${active === "help" ? "active" : ""}" data-nav="help">Staff & Access</button>
      </nav>
      <button id="logout" class="ghost-btn">Sign out</button>
    </aside>
    <main class="main">${content}</main>
  </div>`;
  document.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => b.dataset.nav === "customers" ? renderCustomers() : renderHelp());
  document.getElementById("logout")?.addEventListener("click", () => signOut(auth));
}

function renderLogin(error = "") {
  root.innerHTML = `<div class="login-page"><div class="login-card">
    <div class="brand center"><div class="brand-mark big">F</div><div><b>Fifty Fit</b><span>Admin Console</span></div></div>
    <h1>Welcome back</h1><p class="muted">Authorized staff only.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ""}
    <form id="login-form"><label>Email<input id="email" type="email" autocomplete="username" required /></label><label>Password<input id="password" type="password" autocomplete="current-password" required /></label><button class="primary" type="submit">Sign in</button></form>
  </div></div>`;
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Signing in…";
    try { await signInWithEmailAndPassword(auth, document.getElementById("email").value.trim(), document.getElementById("password").value); }
    catch (err) { renderLogin("Invalid credentials or account access."); }
  };
}

async function isAdmin(user) {
  if (!user) return false;
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists();
}

async function getRecentCustomers() {
  const snap = await getDocs(query(collection(db, "users"), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function searchCustomer(term) {
  const q = term.trim();
  if (!q) return getRecentCustomers();
  if (/^[A-Za-z0-9_-]{20,}$/.test(q)) {
    const s = await getDoc(doc(db, "users", q)); return s.exists() ? [{ id: s.id, ...s.data() }] : [];
  }
  const fields = ["account.email", "account.phone"];
  const results = [];
  for (const field of fields) {
    const snap = await getDocs(query(collection(db, "users"), where(field, "==", q), limit(20)));
    snap.docs.forEach((d) => { if (!results.some((x) => x.id === d.id)) results.push({ id: d.id, ...d.data() }); });
  }
  return results;
}

function customerRow(u) {
  const a = u.account || {}, e = u.entitlements || {};
  const badges = [e.trainingPro && "Training Pro", e.nutritionPro && "Nutrition Pro", e.aiCoachPro && "AI Coach"].filter(Boolean);
  return `<button class="customer-row" data-user-id="${esc(u.id)}"><div class="avatar">${esc((a.name || "?").slice(0,1).toUpperCase())}</div><div class="customer-main"><b>${esc(a.name || "Unnamed user")}</b><span>${esc(a.email || "No email")} · ${esc(a.phone || "No phone")}</span></div><div class="badges">${badges.length ? badges.map((x) => `<span class="badge">${x}</span>`).join("") : `<span class="muted">Free</span>`}</div></button>`;
}

async function renderCustomers(customers = null) {
  shell(`<div class="page-head"><div><span class="eyebrow">CONTROL CENTER</span><h1>Customers</h1><p class="muted">View subscriptions and deliver custom plans directly into Fifty Fit.</p></div><div class="search"><input id="customer-search" placeholder="Email, phone or user ID"/><button id="search-btn">Search</button></div></div><div id="customer-list" class="customer-list"><div class="loading">Loading customers…</div></div>`);
  const list = document.getElementById("customer-list");
  const load = async (items = null) => {
    list.innerHTML = `<div class="loading">Loading…</div>`;
    try { const rows = items || await getRecentCustomers(); list.innerHTML = rows.length ? rows.map(customerRow).join("") : `<div class="empty">No customers found.</div>`; document.querySelectorAll("[data-user-id]").forEach((b) => b.onclick = () => openCustomer(b.dataset.userId)); }
    catch (e) { list.innerHTML = `<div class="error">Could not load customers. Check Firestore rules.</div>`; }
  };
  await load(customers);
  document.getElementById("search-btn").onclick = async () => load(await searchCustomer(document.getElementById("customer-search").value));
  document.getElementById("customer-search").onkeydown = (e) => { if (e.key === "Enter") document.getElementById("search-btn").click(); };
}

async function openCustomer(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return renderCustomers();
  currentCustomer = { id: snap.id, ...snap.data() };
  planDraft = normalizeTraining(currentCustomer.customTrainingPlan);
  nutritionDraft = normalizeNutrition(currentCustomer.customNutritionPlan);
  renderCustomerDetail();
}

function renderCustomerDetail() {
  const a = currentCustomer.account || {}, e = currentCustomer.entitlements || {};
  const hasTraining = !!e.trainingPro, hasNutrition = !!e.nutritionPro;
  shell(`<div class="page-head"><div><button id="back-customers" class="back">← Customers</button><h1>${esc(a.name || "Customer")}</h1><p class="muted">${esc(a.email || "")} · ${esc(a.phone || "")}</p></div><div class="status-pills">${hasTraining ? '<span class="badge gold">Training Pro</span>' : ''}${hasNutrition ? '<span class="badge gold">Nutrition Pro</span>' : ''}${e.aiCoachPro ? '<span class="badge ai">AI Coach</span>' : ''}</div></div>
  <div class="profile-grid"><section class="panel"><div class="panel-head"><h2>Account</h2><span class="muted">UID ${esc(currentCustomer.id)}</span></div><div class="facts"><div><span>Name</span><b>${esc(a.name || "—")}</b></div><div><span>Phone</span><b>${esc(a.phone || "—")}</b></div><div><span>Email</span><b>${esc(a.email || "—")}</b></div><div><span>Goal</span><b>${esc(a.goal || "—")}</b></div><div><span>Weight</span><b>${esc(a.weight || "—")} kg</b></div><div><span>Height</span><b>${esc(a.height || "—")} cm</b></div></div></section><section class="panel"><div class="panel-head"><h2>Subscription</h2><span class="muted">Read-only</span></div><div class="entitlements"><div class="ent ${hasTraining ? 'on' : ''}"><b>Training Pro</b><span>${hasTraining ? 'Active' : 'Not active'}</span></div><div class="ent ${hasNutrition ? 'on' : ''}"><b>Nutrition Pro</b><span>${hasNutrition ? 'Active' : 'Not active'}</span></div><div class="ent ${e.aiCoachPro ? 'on' : ''}"><b>AI Coach Pro</b><span>${e.aiCoachPro ? 'Active' : 'Not active'}</span></div></div></section></div>
  <div class="editor-tabs"><button class="tab active" data-editor="training">Training plan</button><button class="tab" data-editor="nutrition">Nutrition plan</button></div><div id="editor"></div>`);
  document.getElementById("back-customers").onclick = () => renderCustomers();
  document.querySelectorAll("[data-editor]").forEach((b) => b.onclick = () => { document.querySelectorAll("[data-editor]").forEach(x => x.classList.remove("active")); b.classList.add("active"); b.dataset.editor === "training" ? renderTrainingEditor() : renderNutritionEditor(); });
  renderTrainingEditor();
}

function renderTrainingEditor() {
  const editor = document.getElementById("editor");
  const allowed = !!currentCustomer.entitlements?.trainingPro;
  editor.innerHTML = `<section class="panel plan-editor"><div class="panel-head"><div><h2>Custom Training</h2><p class="muted">This plan starts from the date below and runs Day 1 → Day 7.</p></div><button id="save-training" class="primary">Publish plan</button></div>${!allowed ? '<div class="notice">Training Pro is not active. The plan is saved only when the customer has Training Pro.</div>' : ''}<div class="form-grid"><label>Plan name<input id="training-title" value="${esc(planDraft.title)}"/></label><label>Start date<input id="training-start" type="date" value="${esc(planDraft.startDate)}"/></label></div><div class="day-tabs">${DAY_NAMES.map((d,i)=>`<button class="day-tab ${i===activeDay?'active':''}" data-day="${i}">${d}</button>`).join("")}</div><div id="training-day"></div></section>`;
  document.getElementById("training-title").oninput = (e) => planDraft.title = e.target.value;
  document.getElementById("training-start").onchange = (e) => planDraft.startDate = e.target.value;
  document.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => { activeDay = Number(b.dataset.day); renderTrainingEditor(); });
  renderTrainingDay();
  document.getElementById("save-training").onclick = saveTraining;
}
function renderTrainingDay() {
  const wrap = document.getElementById("training-day"); if (!wrap) return;
  const day = planDraft.days[activeDay];
  wrap.innerHTML = `<div class="form-grid"><label>Day title<input id="day-title" value="${esc(day.title)}"/></label><label>Arabic title<input id="day-title-ar" value="${esc(day.titleAr)}"/></label></div><div class="exercise-editor">${day.exercises.map((x,i)=>exerciseEditorRow(x,i)).join("")}</div><button id="add-exercise" class="secondary">+ Add exercise</button>`;
  document.getElementById("day-title").oninput = (e) => day.title = e.target.value;
  document.getElementById("day-title-ar").oninput = (e) => day.titleAr = e.target.value;
  document.querySelectorAll("[data-remove-ex]").forEach((b) => b.onclick = () => { day.exercises.splice(Number(b.dataset.removeEx),1); renderTrainingDay(); });
  document.querySelectorAll("[data-ex-field]").forEach((input) => input.oninput = (e) => { const [i,field]=e.target.dataset.exField.split(":"); day.exercises[Number(i)][field]=field === "targetSets" ? Number(e.target.value) : e.target.value; });
  document.getElementById("add-exercise").onclick = () => { day.exercises.push({ id: EXERCISES[0][0], targetSets: 3, targetReps: "8-12" }); renderTrainingDay(); };
}
function exerciseEditorRow(x, i) {
  return `<div class="exercise-row"><select data-ex-field="${i}:id">${EXERCISES.map(([id,en,ar])=>`<option value="${id}" ${id===x.id?'selected':''}>${esc(en)} — ${esc(ar)}</option>`).join("")}</select><input data-ex-field="${i}:targetSets" type="number" min="1" max="10" value="${esc(x.targetSets || 3)}"/><input data-ex-field="${i}:targetReps" value="${esc(x.targetReps || '8-12')}"/><button data-remove-ex="${i}" class="icon-danger">×</button></div>`;
}
async function saveTraining() {
  if (!currentCustomer.entitlements?.trainingPro) return alert("Training Pro is not active for this customer.");
  const payload = { ...normalizeTraining(planDraft), updatedAt: new Date().toISOString(), assignedBy: currentUser.uid };
  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });
  currentCustomer.customTrainingPlan = payload;
  planDraft = normalizeTraining(payload);
  alert("Training plan published. The customer will see it in the app.");
}

function renderNutritionEditor() {
  const editor = document.getElementById("editor");
  const allowed = !!currentCustomer.entitlements?.nutritionPro;
  editor.innerHTML = `<section class="panel plan-editor"><div class="panel-head"><div><h2>Custom Nutrition</h2><p class="muted">Build the customer's real meal plan. It appears as a premium in-app plan, separate from food logging.</p></div><button id="save-nutrition" class="primary">Publish plan</button></div>${!allowed ? '<div class="notice">Nutrition Pro is not active. The plan cannot be published until the subscription is active.</div>' : ''}<div class="form-grid"><label>Plan name<input id="nutrition-title" value="${esc(nutritionDraft.title)}"/></label><label>Start date<input id="nutrition-start" type="date" value="${esc(nutritionDraft.startDate)}"/></label></div><div class="day-tabs">${DAY_NAMES.map((d,i)=>`<button class="day-tab ${i===activeDay?'active':''}" data-nut-day="${i}">${d}</button>`).join("")}</div><div id="nutrition-day"></div></section>`;
  document.getElementById("nutrition-title").oninput = (e) => nutritionDraft.title = e.target.value;
  document.getElementById("nutrition-start").onchange = (e) => nutritionDraft.startDate = e.target.value;
  document.querySelectorAll("[data-nut-day]").forEach((b) => b.onclick = () => { activeDay = Number(b.dataset.nutDay); renderNutritionEditor(); });
  renderNutritionDay();
  document.getElementById("save-nutrition").onclick = saveNutrition;
}
function renderNutritionDay() {
  const wrap = document.getElementById("nutrition-day"); if (!wrap) return;
  const day = nutritionDraft.days[activeDay];
  wrap.innerHTML = `<div class="target-grid"><label>Calories<input id="nkcal" type="number" value="${esc(day.targetKcal)}" placeholder="e.g. 2400"/></label><label>Protein g<input id="nprotein" type="number" value="${esc(day.targetProtein)}"/></label><label>Carbs g<input id="ncarbs" type="number" value="${esc(day.targetCarbs)}"/></label><label>Fat g<input id="nfat" type="number" value="${esc(day.targetFat)}"/></label></div><div class="meal-editor">${day.meals.map((m,i)=>`<div class="meal-card"><div class="meal-title"><b>${esc(m.title)}</b><span>${esc(m.titleAr)}</span></div><label>Foods & quantities<textarea data-meal-items="${i}" placeholder="150g chicken\n200g rice\nSalad">${esc(m.items)}</textarea></label><label>Note<textarea data-meal-note="${i}" placeholder="Timing, substitutions, preparation…">${esc(m.note)}</textarea></label></div>`).join("")}</div>`;
  document.getElementById("nkcal").oninput=(e)=>day.targetKcal=e.target.value; document.getElementById("nprotein").oninput=(e)=>day.targetProtein=e.target.value; document.getElementById("ncarbs").oninput=(e)=>day.targetCarbs=e.target.value; document.getElementById("nfat").oninput=(e)=>day.targetFat=e.target.value;
  document.querySelectorAll("[data-meal-items]").forEach((x)=>x.oninput=(e)=>day.meals[Number(x.dataset.mealItems)].items=e.target.value);
  document.querySelectorAll("[data-meal-note]").forEach((x)=>x.oninput=(e)=>day.meals[Number(x.dataset.mealNote)].note=e.target.value);
}
async function saveNutrition() {
  if (!currentCustomer.entitlements?.nutritionPro) return alert("Nutrition Pro is not active for this customer.");
  const payload = { ...normalizeNutrition(nutritionDraft), updatedAt: new Date().toISOString(), assignedBy: currentUser.uid };
  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });
  currentCustomer.customNutritionPlan = payload;
  nutritionDraft = normalizeNutrition(payload);
  alert("Nutrition plan published. The customer will see it in the app.");
}

function renderHelp() {
  shell(`<div class="page-head"><div><span class="eyebrow">ACCESS</span><h1>Staff & Access</h1><p class="muted">Keep staff accounts separate from customer accounts.</p></div></div><section class="panel"><h2>Adding a staff member</h2><ol class="steps"><li>Create the staff email/password in Firebase Authentication.</li><li>Create <code>admins/{uid}</code> in Firestore for that staff user's Firebase UID.</li><li>Give the staff member the admin website URL. They can sign in with their own account.</li></ol><div class="notice">The dashboard cannot grant itself admin access. Firestore rules intentionally keep <code>admins</code> write-protected so a compromised client cannot create a new admin.</div></section>`);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) return renderLogin();
  try {
    if (!(await isAdmin(user))) { await signOut(auth); return renderLogin("This account is not authorized for the Fifty Fit Admin Console."); }
    renderCustomers();
  } catch { await signOut(auth); renderLogin("Could not verify admin access."); }
});
