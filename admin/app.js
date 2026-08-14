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

const SUPABASE_ADMIN_ENTITLEMENTS =
  "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-entitlements";

async function getVerifiedEntitlementsForAdmin(uid) {
  if (!uid || !currentUser) return null;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(SUPABASE_ADMIN_ENTITLEMENTS, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.ok ? payload : null;
  } catch {
    return null;
  }
}

const EXERCISES = [
  ["bench_press", "Bench Press", "ضغط البنش"], ["incline_db_press", "Incline Dumbbell Press", "ضغط دمبل مائل"],
  ["chest_fly", "Chest Fly", "فراشة صدر"], ["dips", "Dips", "ديبس"], ["tricep_pushdown", "Tricep Pushdown", "ترايسبس"],
  ["overhead_ext", "Overhead Tricep Extension", "ترايسبس فوق الرأس"], ["push_up", "Push Up", "ضغط"], ["zigzag_tricep_ext", "Zigzag Tricep Extension", "ترايسبس زجزاج"],
  ["lat_pulldown", "Lat Pulldown", "سحب عالي"], ["barbell_row", "T-Bar Row", "تجديف T-Bar"], ["seated_row", "Seated Row", "سحب أرضي"],
  ["single_arm_seated_row", "Single Arm Seated Row", "سحب أرضي بذراع واحدة"], ["bicep_curl", "Behind Body Bicep Curl", "بايسبس خلف الجسم"], ["behind_body_bicep_curl", "Behind Body Bicep Curl", "بايسبس خلف الجسم"], ["hammer_curl", "Hammer Curl", "هامر كيرل"],
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
  const snap = await getDocs(query(collection(db, "users"), limit(250)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
function customerIsSubscribed(u) { const e=u.entitlements||{}; return !!(e.trainingPro||e.nutritionPro||e.aiCoachPro||e.everythingPro||e.bothPro); }
function customerMatches(u, term) { const q=term.trim().toLowerCase(); if(!q)return true; const a=u.account||{}; return [a.name,a.email,a.phone,u.id].some(v=>String(v||"").toLowerCase().includes(q)); }
function customerHasPlanRequest(u) { return !!u.nutritionPlanRequestedAt || !!u.trainingPlanRequestedAt; }
function customerPlanStatus(u) { const e=u.entitlements||{}; return [e.trainingPro&&"Training Pro",e.nutritionPro&&"Nutrition Pro",e.aiCoachPro&&"AI Coach"].filter(Boolean); }
function sortCustomers(rows,mode) { const c=[...rows]; if(mode==='subscribed')return c.sort((a,b)=>Number(customerIsSubscribed(b))-Number(customerIsSubscribed(a))); if(mode==='unsubscribed')return c.sort((a,b)=>Number(customerIsSubscribed(a))-Number(customerIsSubscribed(b))); if(mode==='training')return c.sort((a,b)=>Number(b.entitlements?.trainingPro)-Number(a.entitlements?.trainingPro)); if(mode==='nutrition')return c.sort((a,b)=>Number(b.entitlements?.nutritionPro)-Number(a.entitlements?.nutritionPro)); if(mode==='ai')return c.sort((a,b)=>Number(b.entitlements?.aiCoachPro)-Number(a.entitlements?.aiCoachPro)); if(mode==='requests')return c.sort((a,b)=>Number(customerHasPlanRequest(b))-Number(customerHasPlanRequest(a))); return c.sort((a,b)=>String(a.account?.name||'').localeCompare(String(b.account?.name||''))); }
function customerRow(u) { const a=u.account||{}, badges=customerPlanStatus(u), request=customerHasPlanRequest(u); return `<button class="customer-row ${request?'attention':''}" data-user-id="${esc(u.id)}"><div class="avatar">${esc((a.name||'?').slice(0,1).toUpperCase())}</div><div class="customer-main"><b>${esc(a.name||'Unnamed user')}</b><span>${esc(a.email||'No email')} · ${esc(a.phone||'No phone')}</span>${request?`<small class="request-flag">${u.nutritionPlanRequestedAt?'🍽️ Nutrition plan requested':'🏋️ Training plan requested'}</small>`:''}</div><div class="badges">${badges.length?badges.map(x=>`<span class="badge">${x}</span>`).join(''):`<span class="muted">Free</span>`}</div></button>`; }
async function searchCustomer(term) { const q=term.trim(); if(!q)return getRecentCustomers(); if(/^[A-Za-z0-9_-]{20,}$/.test(q)){const s=await getDoc(doc(db,'users',q));return s.exists()?[{id:s.id,...s.data()}]:[];} const out=[]; for(const field of ['account.email','account.phone']){const snap=await getDocs(query(collection(db,'users'),where(field,'==',q),limit(20)));snap.docs.forEach(d=>{if(!out.some(x=>x.id===d.id))out.push({id:d.id,...d.data()});});} return out.length?out:(await getRecentCustomers()).filter(u=>customerMatches(u,q)); }
async function renderCustomers(customers=null) {
  shell(`<div class="page-head"><div><span class="eyebrow">CONTROL CENTER</span><h1>Customers</h1><p class="muted">Manage subscriptions and deliver custom plans directly into Fifty Fit.</p></div><div class="search"><input id="customer-search" placeholder="Search name, email, phone or user ID" autocomplete="off" /></div></div><div class="toolbar"><select id="customer-filter"><option value="all">All customers</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Not subscribed</option><option value="training">Training Pro</option><option value="nutrition">Nutrition Pro</option><option value="ai">AI Coach Pro</option><option value="requests">Plan requests first</option></select><button id="refresh-customers" class="secondary">Refresh</button><span id="customer-notice" class="notice-inline"></span></div><div id="customer-list" class="customer-list"><div class="loading">Loading customers…</div></div>`);
  const list=document.getElementById('customer-list'), search=document.getElementById('customer-search'), filter=document.getElementById('customer-filter'), notice=document.getElementById('customer-notice'); let rows=customers||await getRecentCustomers();
  const render=()=>{let f=rows.filter(u=>customerMatches(u,search.value)); if(filter.value==='subscribed')f=f.filter(customerIsSubscribed); if(filter.value==='unsubscribed')f=f.filter(u=>!customerIsSubscribed(u)); if(filter.value==='training')f=f.filter(u=>!!u.entitlements?.trainingPro); if(filter.value==='nutrition')f=f.filter(u=>!!u.entitlements?.nutritionPro); if(filter.value==='ai')f=f.filter(u=>!!u.entitlements?.aiCoachPro); f=sortCustomers(f,filter.value); const requests=rows.filter(customerHasPlanRequest).length; list.innerHTML=f.length?f.map(customerRow).join(''):`<div class="empty">No customers match this filter.</div>`; document.querySelectorAll('[data-user-id]').forEach(b=>b.onclick=()=>openCustomer(b.dataset.userId)); notice.textContent=requests?`🔔 ${requests} plan request${requests===1?'':'s'} need attention`:'';};
  render(); search.oninput=render; filter.onchange=render; const refresh=async()=>{rows=await getRecentCustomers();render();}; document.getElementById('refresh-customers').onclick=refresh; setInterval(()=>refresh().catch(()=>{}),30000);
}

async function openCustomer(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return renderCustomers();
  const rawCustomer = { id: snap.id, ...snap.data() };
  rawCustomer.verifiedEntitlements = await getVerifiedEntitlementsForAdmin(uid);
  currentCustomer = rawCustomer;
  planDraft = normalizeTraining(currentCustomer.customTrainingPlan);
  nutritionDraft = normalizeNutrition(currentCustomer.customNutritionPlan);
  renderCustomerDetail();
}

function renderCustomerDetail() {
  const a = currentCustomer.account || {};
  const e = currentCustomer.verifiedEntitlements || { trainingPro: false, nutritionPro: false, aiCoachPro: false };
  const firestoreFlags = currentCustomer.entitlements || {};
  const hasVerified = !!currentCustomer.verifiedEntitlements;
  const hasTraining = !!e.trainingPro, hasNutrition = !!e.nutritionPro;
  shell(`<div class="page-head"><div><button id="back-customers" class="back">← Customers</button><h1>${esc(a.name || "Customer")}</h1><p class="muted">${esc(a.email || "")} · ${esc(a.phone || "")}</p></div><div class="status-pills">${hasTraining ? '<span class="badge gold">Training Pro</span>' : ''}${hasNutrition ? '<span class="badge gold">Nutrition Pro</span>' : ''}${e.aiCoachPro ? '<span class="badge ai">AI Coach</span>' : ''}</div></div>
  <div class="profile-grid"><section class="panel"><div class="panel-head"><h2>Account</h2><span class="muted">UID ${esc(currentCustomer.id)}</span></div><div class="facts"><div><span>Name</span><b>${esc(a.name || "—")}</b></div><div><span>Phone</span><b>${esc(a.phone || "—")}</b></div><div><span>Email</span><b>${esc(a.email || "—")}</b></div><div><span>Goal</span><b>${esc(a.goal || "—")}</b></div><div><span>Weight</span><b>${esc(a.weight || "—")} kg</b></div><div><span>Height</span><b>${esc(a.height || "—")} cm</b></div></div></section><section class="panel"><div class="panel-head"><h2>Subscription</h2><span class="muted">Read-only</span></div><div class="entitlements"><div class="ent ${hasTraining ? 'on' : ''}"><b>Training Pro</b><span>${hasTraining ? 'Verified active' : 'Not verified'}</span></div><div class="ent ${hasNutrition ? 'on' : ''}"><b>Nutrition Pro</b><span>${hasNutrition ? 'Verified active' : 'Not verified'}</span></div><div class="ent ${e.aiCoachPro ? 'on' : ''}"><b>AI Coach Pro</b><span>${e.aiCoachPro ? 'Verified active' : 'Not verified'}</span></div></div><div class="admin-billing-note">${hasVerified
    ? "Billing status shown here is verified from Supabase/Google Play entitlement state."
    : "Billing verification is currently unavailable. Firestore flags are not treated as verified Play subscriptions."}</div></section></div>
  <div class="editor-tabs"><button class="tab active" data-editor="training">Training plan</button><button class="tab" data-editor="nutrition">Nutrition plan</button></div><div id="editor"></div>`);
  document.getElementById("back-customers").onclick = () => renderCustomers();
  document.querySelectorAll("[data-editor]").forEach((b) => b.onclick = () => { document.querySelectorAll("[data-editor]").forEach(x => x.classList.remove("active")); b.classList.add("active"); b.dataset.editor === "training" ? renderTrainingEditor() : renderNutritionEditor(); });
  renderTrainingEditor();
}

function renderTrainingEditor() {
  const editor = document.getElementById("editor");
  const allowed = true;
  editor.innerHTML = `<section class="panel plan-editor"><div class="panel-head"><div><h2>Custom Training</h2><p class="muted">This plan starts from the date below and runs Day 1 → Day 7.</p></div><button id="save-training" class="primary">Publish plan</button></div><div class="form-grid"><label>Plan name<input id="training-title" value="${esc(planDraft.title)}"/></label><label>Start date<input id="training-start" type="date" value="${esc(planDraft.startDate)}"/></label></div><div class="day-tabs">${DAY_NAMES.map((d,i)=>`<button class="day-tab ${i===activeDay?'active':''}" data-day="${i}">${d}</button>`).join("")}</div><div id="training-day"></div></section>`;
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
  const payload = { ...normalizeTraining(planDraft), updatedAt: new Date().toISOString(), assignedBy: currentUser.uid };
  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });
  const userLang = String(currentCustomer?.settings?.language || currentCustomer?.settings?.lang || currentCustomer?.account?.language || currentCustomer?.account?.lang || "en").toLowerCase();
  const ar = userLang.startsWith("ar");
  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`training-plan-${Date.now()}`), {
    type: "training_plan_ready",
    route: { screen: "workout", params: {} },
    title: ar ? "اتضافت لك خطة تدريب جديدة 💪" : "A new training plan was added 💪",
    body: ar ? "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized training plan is now ready in Fifty Fit.",
    titleAr: "اتضافت لك خطة تدريب جديدة 💪",
    bodyAr: "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit.",
    titleEn: "A new training plan was added 💪",
    bodyEn: "Your personalized training plan is now ready in Fifty Fit.",
    createdAt: new Date().toISOString(),
    read: false,
  }, { merge: false });
  currentCustomer.customTrainingPlan = payload;
  planDraft = normalizeTraining(payload);
  alert("Training plan published. The customer will see it in the app.");
}

function renderNutritionEditor() {
  const editor = document.getElementById("editor");
  const allowed = true;
  editor.innerHTML = `<section class="panel plan-editor"><div class="panel-head"><div><h2>Custom Nutrition</h2><p class="muted">Build the customer's real meal plan. It appears as a premium in-app plan, separate from food logging.</p></div><button id="save-nutrition" class="primary">Publish plan</button></div><div class="form-grid"><label>Plan name<input id="nutrition-title" value="${esc(nutritionDraft.title)}"/></label><label>Start date<input id="nutrition-start" type="date" value="${esc(nutritionDraft.startDate)}"/></label></div><div class="day-tabs">${DAY_NAMES.map((d,i)=>`<button class="day-tab ${i===activeDay?'active':''}" data-nut-day="${i}">${d}</button>`).join("")}</div><div id="nutrition-day"></div></section>`;
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
  const payload = { ...normalizeNutrition(nutritionDraft), updatedAt: new Date().toISOString(), assignedBy: currentUser.uid };
  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });
  const userLang = String(currentCustomer?.settings?.language || currentCustomer?.settings?.lang || currentCustomer?.account?.language || currentCustomer?.account?.lang || "en").toLowerCase();
  const ar = userLang.startsWith("ar");
  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`nutrition-plan-${Date.now()}`), {
    type: "nutrition_plan_ready",
    route: { screen: "nutritionPlan", params: {} },
    title: ar ? "اتضاف لك نظام أكل جديد 🍽️" : "A new nutrition plan was added 🍽️",
    body: ar ? "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized nutrition plan is now ready in Fifty Fit.",
    titleAr: "اتضاف لك نظام أكل جديد 🍽️",
    bodyAr: "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit.",
    titleEn: "A new nutrition plan was added 🍽️",
    bodyEn: "Your personalized nutrition plan is now ready in Fifty Fit.",
    createdAt: new Date().toISOString(),
    read: false,
  }, { merge: false });
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
