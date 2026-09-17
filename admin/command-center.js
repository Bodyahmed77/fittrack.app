/* FIFTYFIT_ADMIN_COMMAND_CENTER_V1 */

const ADMIN_API_ENDPOINT = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-api";
const AI_HEALTH_ENDPOINT = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach-health";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const EXERCISES = [
  ["bench_press", "Bench Press", "ضغط البنش"], ["incline_db_press", "Incline Dumbbell Press", "ضغط دمبل مائل"], ["chest_fly", "Chest Fly", "فراشة صدر"],
  ["dips", "Dips", "ديبس"], ["tricep_pushdown", "Triceps Pushdown", "ضغط الترايسبس"], ["overhead_ext", "Overhead Tricep Extension", "ترايسبس فوق الرأس"],
  ["push_up", "Push Up", "ضغط"], ["zigzag_tricep_ext", "Zigzag Tricep Extension", "ترايسبس زجزاج"], ["lat_pulldown", "Lat Pulldown", "سحب عالي"],
  ["barbell_row", "T-Bar Row", "تجديف T-Bar"], ["seated_row", "Seated Row", "سحب أرضي"], ["single_arm_seated_row", "Single Arm Seated Row", "سحب أرضي بذراع واحدة"],
  ["bicep_curl", "Behind Body Bicep Curl", "بايسبس خلف الجسم"], ["behind_body_bicep_curl", "Behind Body Bicep Curl", "بايسبس خلف الجسم"], ["hammer_curl", "Hammer Curl", "هامر كيرل"],
  ["supported_db_curl", "Supported Dumbbell Curl", "بايسبس دمبل مسنود"], ["squat", "Smith Machine Squat", "سكوات سميث"], ["hack_squat", "Hack Squat", "هاك سكوات"],
  ["leg_press", "Leg Press", "ضغط الأرجل"], ["leg_extension", "Leg Extension", "تمديد الأرجل"], ["abduction", "Abduction Machine", "جهاز إبعاد الفخذ"],
  ["reverse_curl", "Cable Reverse Curl", "كيرل عكسي"], ["face_pull", "Face Pull", "فيس بول"], ["lunges", "Bulgarian Split Squat", "سكوات بلغاري"],
  ["leg_curl", "Leg Curl", "خلفيات"], ["calf_raise", "Standing Calf Raise", "سمانة واقف"], ["ohp", "Shoulder Press Machine", "ضغط كتف"],
  ["lateral_raise", "Lateral Raise", "رفرفة جانبية"], ["rear_delt_fly", "Rear Delt Fly", "فراشة كتف خلفي"], ["shrugs", "Cable or Dumbbell Shrugs", "هز الكتفين"],
  ["deadlift", "Romanian Deadlift", "ديد ليفت روماني"], ["pull_up", "Pull Up", "عقلة"], ["plank", "Plank", "بلانك"],
  ["treadmill", "Treadmill Walk/Run", "مشاية"], ["bike", "Stationary Bike", "دراجة ثابتة"], ["crunches", "Abs Rope Crunches", "بطن بالحبل"],
  ["leg_raise", "Hanging Leg Raise", "رفع الرجل"], ["jump_rope", "Jump Rope", "نط الحبل"], ["burpees", "Burpees", "بيربيس"],
];

let state = {
  root: null,
  main: null,
  nav: null,
  page: "overview",
  users: [],
  reports: [],
  billing: [],
  audit: [],
  overview: null,
  loading: false,
  lastRefresh: null,
  idleTimer: null,
  idleResetBound: false,
};

const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[c]));
const isoDate = (v) => {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
};
const uidShort = (v) => {
  const s = String(v || "");
  return s.length > 18 ? `${s.slice(0, 8)}…${s.slice(-7)}` : s;
};
const emailOf = (u) => String(u?.account?.email || "").trim().toLowerCase();
const nameOf = (u) => String(u?.account?.name || "Unnamed user");
const hasPro = (u) => {
  const e = u?.entitlements || {};
  return !!(e.trainingPro || e.nutritionPro || e.aiCoachPro || e.everythingPro || e.bothPro);
};
const hasRequest = (u) => !!(u?.trainingPlanRequestedAt || u?.nutritionPlanRequestedAt);
const requestLabel = (u) => u?.nutritionPlanRequestedAt ? "Nutrition plan" : "Training plan";
const requestDate = (u) => u?.nutritionPlanRequestedAt || u?.trainingPlanRequestedAt || null;
const planBadges = (u) => {
  const e = u?.entitlements || {};
  return [e.trainingPro && "Training Pro", e.nutritionPro && "Nutrition Pro", e.aiCoachPro && "AI Coach"].filter(Boolean);
};

function injectStyle() {
  if (document.getElementById("fifty-fit-command-center-style")) return;
  const style = document.createElement("style");
  style.id = "fifty-fit-command-center-style";
  style.textContent = `
    .ffcc-shell{display:grid;gap:18px}
    .ffcc-top{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap}
    .ffcc-top h1{margin:6px 0 5px;font-size:34px;letter-spacing:-.5px}
    .ffcc-eyebrow{font-size:10px;letter-spacing:1.8px;color:#777;font-weight:900}
    .ffcc-muted{color:#777;font-size:12px;line-height:1.55}
    .ffcc-actions{display:flex;gap:8px;flex-wrap:wrap}
    .ffcc-btn{border:1px solid rgba(255,255,255,.12);background:#101010;color:#fff;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}
    .ffcc-btn:hover{border-color:rgba(255,255,255,.28);background:#151515}
    .ffcc-btn.primary{background:#fff;color:#050505;border-color:#fff}
    .ffcc-btn.danger{color:#ff6b6b;border-color:rgba(239,68,68,.25)}
    .ffcc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .ffcc-stat{background:linear-gradient(180deg,#101010,#0b0b0b);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;min-height:112px}
    .ffcc-stat-label{font-size:11px;color:#777;font-weight:800}
    .ffcc-stat-value{font-size:30px;font-weight:950;line-height:1.05;margin-top:10px}
    .ffcc-layout{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}
    .ffcc-panel{background:linear-gradient(180deg,#0d0d0d,#090909);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:18px}
    .ffcc-panel h2{margin:0;font-size:16px}
    .ffcc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}
    .ffcc-list{display:grid;gap:8px}
    .ffcc-row{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#0b0b0b}
    .ffcc-row-main{flex:1;min-width:0}.ffcc-row-main b,.ffcc-row-main span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ffcc-row-main span{color:#777;font-size:11px;margin-top:3px}
    .ffcc-avatar{width:34px;height:34px;border-radius:10px;background:#fff;color:#050505;display:grid;place-items:center;font-weight:950;flex:0 0 auto}
    .ffcc-chip{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.08);color:#bbb;font-size:9px;font-weight:850;margin:2px}
    .ffcc-chip.gold{color:#f0c400;background:rgba(234,179,8,.08);border-color:rgba(234,179,8,.22)}
    .ffcc-status{font-size:10px;font-weight:850}.ffcc-status.ok{color:#22c55e}.ffcc-status.warn{color:#eab308}.ffcc-status.bad{color:#ef4444}
    .ffcc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .ffcc-input,.ffcc-select{width:100%;box-sizing:border-box;background:#101010;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px 12px;outline:none}
    .ffcc-input:focus,.ffcc-select:focus{border-color:rgba(255,255,255,.42)}
    .ffcc-search{flex:1;min-width:260px}
    .ffcc-table{width:100%;border-collapse:collapse}.ffcc-table th,.ffcc-table td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;font-size:11px;vertical-align:top}.ffcc-table th{color:#666;text-transform:uppercase;letter-spacing:.5px;font-size:9px}
    .ffcc-table-wrap{overflow:auto}
    .ffcc-nav-section{font-size:9px;letter-spacing:1.2px;color:#555;padding:13px 12px 5px;text-transform:uppercase;font-weight:900}
    .ffcc-nav-btn{position:relative}
    .ffcc-nav-badge{position:absolute;right:9px;top:7px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#eab308;color:#050505;font-size:9px;font-weight:950;display:grid;place-items:center}
    .ffcc-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .ffcc-health-card{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#0b0b0b}
    .ffcc-health-line{display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-top:8px;color:#999}.ffcc-health-line b{color:#fff}
    .ffcc-empty{padding:38px 10px;text-align:center;color:#666}
    .ffcc-danger-note{padding:11px 12px;border-radius:10px;border:1px solid rgba(239,68,68,.2);background:rgba(239,68,68,.06);color:#f87171;font-size:11px;line-height:1.5}
    .ffcc-request{border-color:rgba(234,179,8,.38);background:rgba(234,179,8,.035)}
    .ffcc-content-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .ffcc-ex{padding:11px;border:1px solid rgba(255,255,255,.07);background:#0b0b0b;border-radius:12px}.ffcc-ex b{font-size:11px}.ffcc-ex span{display:block;color:#777;font-size:10px;margin-top:3px}
    @media(max-width:1050px){.ffcc-grid{grid-template-columns:repeat(2,1fr)}.ffcc-layout{grid-template-columns:1fr}.ffcc-card-grid{grid-template-columns:repeat(2,1fr)}.ffcc-content-list{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:700px){.ffcc-top h1{font-size:28px}.ffcc-grid{grid-template-columns:1fr 1fr}.ffcc-card-grid,.ffcc-content-list{grid-template-columns:1fr 1fr}.ffcc-search{min-width:100%}.ffcc-table th:nth-child(4),.ffcc-table td:nth-child(4){display:none}}
    @media(max-width:480px){.ffcc-grid,.ffcc-card-grid,.ffcc-content-list{grid-template-columns:1fr}.ffcc-panel{padding:14px}.ffcc-stat{min-height:92px}.ffcc-stat-value{font-size:25px}}
  `;
  document.head.appendChild(style);
}

function adminContext() {
  return window.__FiftyFitAdmin || null;
}

async function api(action, payload = {}) {
  const ctx = adminContext();
  const user = ctx?.auth?.currentUser;
  if (!user) throw new Error("Authentication required");
  const token = await user.getIdToken(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(ADMIN_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || !data?.ok) {
      if (response.status === 401) {
        const refreshed = await user.getIdToken(true);
        const retryResponse = await fetch(ADMIN_API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${refreshed}` },
          body: JSON.stringify({ action, ...payload }),
        });
        let retryData = null;
        try { retryData = await retryResponse.json(); } catch (_) {}
        if (!retryResponse.ok || !retryData?.ok) throw new Error(String(retryData?.message || retryData?.error || `Admin request failed (${retryResponse.status})`));
        return retryData.data;
      }
      throw new Error(String(data?.message || data?.error || `Admin request failed (${response.status})`));
    }
    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

async function loadUsers() {
  const db = adminContext()?.db;
  if (!db) throw new Error("Admin Firestore is not ready");
  const ctx = adminContext();
  const { collection, getDocs, limit, query } = ctx.fs;
  const snap = await getDocs(query(collection(db, "users"), limit(500)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function goLegacyCustomers(uid = "") {
  const button = document.querySelector('[data-nav="customers"]');
  if (!button) return;
  button.click();
  if (!uid) return;
  const started = Date.now();
  const timer = setInterval(() => {
    const input = document.getElementById("customer-search");
    if (input) {
      clearInterval(timer);
      input.value = uid;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      return;
    }
    if (Date.now() - started > 5000) clearInterval(timer);
  }, 100);
}

function installSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.dataset.ffccInstalled === "1") return;
  sidebar.dataset.ffccInstalled = "1";
  const nav = sidebar.querySelector("nav");
  if (!nav) return;
  nav.innerHTML = `
    <div class="ffcc-nav-section">Operations</div>
    <button class="nav-btn ffcc-nav-btn active" data-ffcc-page="overview">Overview</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="users">Users</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="requests">Plan Requests<span class="ffcc-nav-badge" data-ffcc-request-badge style="display:none">0</span></button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="reports">AI Reports</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="billing">Billing</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="operations">System Health</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="content">Content</button>
    <button class="nav-btn ffcc-nav-btn" data-ffcc-page="audit">Audit Log</button>
    <div class="ffcc-nav-section">Existing Workspaces</div>
    <button class="nav-btn" data-nav="customers">Customers & Plan Builder</button>
    <button class="nav-btn" data-nav="help">Staff & Access</button>
  `;
  nav.querySelectorAll("[data-ffcc-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.ffccPage;
      updateSidebarActive();
      renderPage();
    });
  });
  nav.querySelectorAll('[data-nav="customers"]').forEach((button) => button.addEventListener("click", () => clearCommandActive()));
  nav.querySelectorAll('[data-nav="help"]').forEach((button) => button.addEventListener("click", () => clearCommandActive()));
}

function clearCommandActive() {
  document.querySelectorAll("[data-ffcc-page]").forEach((b) => b.classList.remove("active"));
}
function updateSidebarActive() {
  document.querySelectorAll("[data-ffcc-page]").forEach((b) => b.classList.toggle("active", b.dataset.ffccPage === state.page));
}

function shellPage(title, eyebrow, subtitle, actions = "") {
  return `<div class="ffcc-shell"><div class="ffcc-top"><div><div class="ffcc-eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><div class="ffcc-muted">${esc(subtitle)}</div></div><div class="ffcc-actions">${actions}</div></div><div id="ffcc-page-body"></div></div>`;
}

function stat(label, value) {
  return `<div class="ffcc-stat"><div class="ffcc-stat-label">${esc(label)}</div><div class="ffcc-stat-value">${esc(value ?? "—")}</div></div>`;
}

async function renderOverview() {
  state.main.innerHTML = shellPage("Admin Overview", "FIFTY FIT OPERATIONS", "One control surface for customer support, AI, billing, requests, and system health.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button><button class="ffcc-btn primary" data-ffcc-open-customers>Customer workspace</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-grid">${stat("Customers", "…")}${stat("Active Pro", "…")}${stat("Open AI Reports", "…")}${stat("Plan Requests", "…")}</div><div style="height:14px"></div><div class="ffcc-layout"><section class="ffcc-panel"><div class="ffcc-panel-head"><h2>Recent AI reports</h2><span class="ffcc-muted">Latest 5</span></div><div id="ffcc-recent-reports" class="ffcc-list"><div class="ffcc-empty">Loading…</div></div></section><section class="ffcc-panel"><div class="ffcc-panel-head"><h2>Operations</h2><span class="ffcc-muted" id="ffcc-last-refresh">—</span></div><div id="ffcc-overview-ops" class="ffcc-list"><div class="ffcc-empty">Loading…</div></div></section></div>`;
  document.querySelector("[data-ffcc-refresh]").onclick = () => refreshAll().catch(console.error);
  document.querySelector("[data-ffcc-open-customers]").onclick = () => goLegacyCustomers();
  try {
    const [overview, reports, users] = await Promise.all([api("overview"), api("reports_list", { status: "open", limit: 5 }), loadUsers()]);
    state.overview = overview;
    state.reports = reports || [];
    state.users = users || [];
    state.lastRefresh = new Date();
    const active = state.users.filter(hasPro).length;
    const requests = state.users.filter(hasRequest).length;
    document.querySelector(".ffcc-grid").innerHTML = [stat("Customers", state.users.length), stat("Active Pro", active), stat("Open AI Reports", overview?.stats?.openReports ?? 0), stat("Plan Requests", requests)].join("");
    document.getElementById("ffcc-last-refresh").textContent = `Updated ${isoDate(state.lastRefresh)}`;
    renderReportsList(document.getElementById("ffcc-recent-reports"), state.reports.slice(0,5), true);
    document.getElementById("ffcc-overview-ops").innerHTML = `
      <div class="ffcc-row"><div class="ffcc-row-main"><b>AI messages today</b><span>Quota usage across all users</span></div><strong>${esc(overview?.stats?.aiMessagesToday ?? 0)}</strong></div>
      <div class="ffcc-row"><div class="ffcc-row-main"><b>Billing events / 24h</b><span>Server billing event log</span></div><strong>${esc(overview?.stats?.billing24h ?? 0)}</strong></div>
      <div class="ffcc-row"><div class="ffcc-row-main"><b>Audit events / 7d</b><span>Admin activity</span></div><strong>${esc(overview?.stats?.audit7d ?? 0)}</strong></div>`;
    updateRequestBadge(requests);
  } catch (error) {
    body.insertAdjacentHTML("afterbegin", `<div class="ffcc-danger-note">${esc(error?.message || error)}</div>`);
  }
}

function renderReportsList(host, reports, compact = false) {
  if (!host) return;
  if (!reports.length) { host.innerHTML = `<div class="ffcc-empty">No reports found.</div>`; return; }
  host.innerHTML = reports.map((r) => `<div class="ffcc-row"><div class="ffcc-row-main"><b>${esc(r.reason || "Report")}</b><span>${esc(uidShort(r.uid))} · ${esc(isoDate(r.created_at))}${r.model ? ` · ${esc(r.model)}` : ""}</span><span>${esc(r.response_text || "")}</span></div>${compact ? "" : `<div class="ffcc-actions"><button class="ffcc-btn" data-report-action="review" data-report-id="${esc(r.id)}">Reviewed</button><button class="ffcc-btn danger" data-report-action="dismiss" data-report-id="${esc(r.id)}">Dismiss</button></div>`}</div>`).join("");
  if (!compact) host.querySelectorAll("[data-report-action]").forEach((b) => b.onclick = async () => {
    b.disabled = true;
    const status = b.dataset.reportAction === "review" ? "reviewed" : "dismissed";
    try { await api("report_update", { reportId: b.dataset.reportId, status }); await renderReports(); } catch (error) { alert(error?.message || error); b.disabled = false; }
  });
}

async function renderReports() {
  state.main.innerHTML = shellPage("AI Reports", "AI SAFETY & QUALITY", "Review user-reported AI responses without exposing service credentials.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-toolbar"><select id="ffcc-report-filter" class="ffcc-select" style="width:190px"><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option></select></div><div id="ffcc-reports" class="ffcc-list"><div class="ffcc-empty">Loading…</div></div>`;
  const load = async () => { const status = document.getElementById("ffcc-report-filter").value; const rows = await api("reports_list", { status, limit: 100 }); state.reports = rows || []; renderReportsList(document.getElementById("ffcc-reports"), state.reports); };
  document.querySelector("[data-ffcc-refresh]").onclick = () => load().catch(console.error);
  document.getElementById("ffcc-report-filter").onchange = () => load().catch(console.error);
  try { await load(); } catch (error) { document.getElementById("ffcc-reports").innerHTML = `<div class="ffcc-danger-note">${esc(error?.message || error)}</div>`; }
}

function renderUserRows(rows, queryText = "") {
  const q = queryText.trim().toLowerCase();
  let filtered = rows.filter((u) => !q || [u.id, emailOf(u), nameOf(u), String(u?.account?.phone || "")].some((v) => String(v || "").toLowerCase().includes(q)));
  filtered = filtered.slice(0, 250);
  const host = document.getElementById("ffcc-users");
  if (!host) return;
  if (!filtered.length) { host.innerHTML = `<div class="ffcc-empty">No users match this search.</div>`; return; }
  host.innerHTML = filtered.map((u) => `<div class="ffcc-row ${hasRequest(u) ? "ffcc-request" : ""}"><div class="ffcc-avatar">${esc(nameOf(u).slice(0,1).toUpperCase())}</div><div class="ffcc-row-main"><b>${esc(nameOf(u))}</b><span>${esc(emailOf(u) || "No email")} · ${esc(String(u?.account?.phone || "No phone"))}</span><span>${planBadges(u).map((x) => `<span class="ffcc-chip ${x.includes("Pro") ? "gold" : ""}">${esc(x)}</span>`).join("")}${hasRequest(u) ? `<span class="ffcc-chip gold">${esc(requestLabel(u))} requested</span>` : ""}</span></div><button class="ffcc-btn" data-user-open="${esc(u.id)}">Open</button></div>`).join("");
  host.querySelectorAll("[data-user-open]").forEach((b) => b.onclick = () => goLegacyCustomers(b.dataset.userOpen));
}

async function renderUsers() {
  state.main.innerHTML = shellPage("Users", "CUSTOMER SUPPORT", "Fast support search with clear subscription and plan-request context.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button><button class="ffcc-btn" data-ffcc-export>Export CSV</button><button class="ffcc-btn primary" data-ffcc-legacy>Open full plan builder</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-toolbar"><div class="ffcc-search"><input id="ffcc-user-search" class="ffcc-input" placeholder="Search name, email, phone, or UID" autocomplete="off" /></div><select id="ffcc-user-filter" class="ffcc-select" style="width:190px"><option value="all">All users</option><option value="pro">Pro users</option><option value="free">Free users</option><option value="requests">Plan requests</option><option value="training">Training Pro</option><option value="nutrition">Nutrition Pro</option><option value="ai">AI Coach Pro</option></select></div><div id="ffcc-users" class="ffcc-list"><div class="ffcc-empty">Loading…</div></div>`;
  try {
    if (!state.users.length) state.users = await loadUsers();
    const render = () => {
      const filter = document.getElementById("ffcc-user-filter").value;
      let rows = [...state.users];
      if (filter === "pro") rows = rows.filter(hasPro);
      if (filter === "free") rows = rows.filter((u) => !hasPro(u));
      if (filter === "requests") rows = rows.filter(hasRequest);
      if (filter === "training") rows = rows.filter((u) => !!u.entitlements?.trainingPro);
      if (filter === "nutrition") rows = rows.filter((u) => !!u.entitlements?.nutritionPro);
      if (filter === "ai") rows = rows.filter((u) => !!u.entitlements?.aiCoachPro);
      if (filter === "requests") rows.sort((a,b) => String(requestDate(b)||"").localeCompare(String(requestDate(a)||"")));
      renderUserRows(rows, document.getElementById("ffcc-user-search").value);
      updateRequestBadge(state.users.filter(hasRequest).length);
    };
    document.getElementById("ffcc-user-search").oninput = render;
    document.getElementById("ffcc-user-filter").onchange = render;
    document.querySelector("[data-ffcc-refresh]").onclick = async () => { state.users = await loadUsers(); render(); };
    document.querySelector("[data-ffcc-legacy]").onclick = () => goLegacyCustomers();
    document.querySelector("[data-ffcc-export]").onclick = () => exportUsersCSV(state.users);
    render();
  } catch (error) { document.getElementById("ffcc-users").innerHTML = `<div class="ffcc-danger-note">${esc(error?.message || error)}</div>`; }
}

async function renderRequests() {
  state.main.innerHTML = shellPage("Plan Requests", "CUSTOMER SUCCESS", "Users who explicitly asked for a custom training or nutrition plan.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button><button class="ffcc-btn primary" data-ffcc-open-builder>Open plan builder</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div id="ffcc-requests" class="ffcc-list"><div class="ffcc-empty">Loading…</div></div>`;
  try {
    state.users = await loadUsers();
    const rows = state.users.filter(hasRequest).sort((a,b) => String(requestDate(b)||"").localeCompare(String(requestDate(a)||"")));
    const host = document.getElementById("ffcc-requests");
    host.innerHTML = rows.length ? rows.map((u) => `<div class="ffcc-row ffcc-request"><div class="ffcc-avatar">${esc(nameOf(u).slice(0,1).toUpperCase())}</div><div class="ffcc-row-main"><b>${esc(nameOf(u))}</b><span>${esc(emailOf(u) || "No email")} · ${esc(requestLabel(u))} requested</span><span>Requested ${esc(isoDate(requestDate(u)))}</span></div><div class="ffcc-actions"><button class="ffcc-btn primary" data-request-open="${esc(u.id)}">Handle</button></div></div>`).join("") : `<div class="ffcc-empty">No active plan requests.</div>`;
    host.querySelectorAll("[data-request-open]").forEach((b) => b.onclick = () => goLegacyCustomers(b.dataset.requestOpen));
    document.querySelector("[data-ffcc-refresh]").onclick = () => renderRequests();
    document.querySelector("[data-ffcc-open-builder]").onclick = () => goLegacyCustomers();
    updateRequestBadge(rows.length);
  } catch (error) { document.getElementById("ffcc-requests").innerHTML = `<div class="ffcc-danger-note">${esc(error?.message || error)}</div>`; }
}

async function renderBilling() {
  state.main.innerHTML = shellPage("Billing", "REVENUE OPERATIONS", "Server-side billing event history. Verified purchase state remains read-only here.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-panel"><div class="ffcc-table-wrap"><table class="ffcc-table"><thead><tr><th>Time</th><th>Event</th><th>Product</th><th>User</th><th>State</th><th>Expiry</th></tr></thead><tbody id="ffcc-billing"><tr><td colspan="6">Loading…</td></tr></tbody></table></div></div>`;
  const load = async () => {
    state.billing = await api("billing_recent", { limit: 100 });
    const rows = state.billing || [];
    document.getElementById("ffcc-billing").innerHTML = rows.length ? rows.map((e) => `<tr><td>${esc(isoDate(e.created_at))}</td><td>${esc(e.event_type || "—")}</td><td>${esc(e.product_key || "—")}</td><td>${esc(uidShort(e.uid))}</td><td><span class="ffcc-status ${e.purchase_state === "active" ? "ok" : e.purchase_state ? "warn" : ""}">${esc(e.purchase_state || "—")}</span></td><td>${esc(e.expires_at ? isoDate(e.expires_at) : "—")}</td></tr>`).join("") : `<tr><td colspan="6"><div class="ffcc-empty">No billing events found.</div></td></tr>`;
  };
  document.querySelector("[data-ffcc-refresh]").onclick = () => load().catch(console.error);
  try { await load(); } catch (error) { document.getElementById("ffcc-billing").innerHTML = `<tr><td colspan="6"><div class="ffcc-danger-note">${esc(error?.message || error)}</div></td></tr>`; }
}

async function renderAudit() {
  state.main.innerHTML = shellPage("Audit Log", "ADMIN GOVERNANCE", "Immutable operational history for sensitive support and moderation actions.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-panel"><div class="ffcc-table-wrap"><table class="ffcc-table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Metadata</th></tr></thead><tbody id="ffcc-audit"><tr><td colspan="5">Loading…</td></tr></tbody></table></div></div>`;
  const load = async () => {
    state.audit = await api("audit_recent", { limit: 100 });
    const rows = state.audit || [];
    document.getElementById("ffcc-audit").innerHTML = rows.length ? rows.map((e) => `<tr><td>${esc(isoDate(e.created_at))}</td><td>${esc(uidShort(e.admin_uid))}</td><td><b>${esc(e.action || "—")}</b></td><td>${esc(e.target_type || "—")} · ${esc(uidShort(e.target_id))}</td><td>${esc(JSON.stringify(e.metadata || {}))}</td></tr>`).join("") : `<tr><td colspan="5"><div class="ffcc-empty">No audit events found.</div></td></tr>`;
  };
  document.querySelector("[data-ffcc-refresh]").onclick = () => load().catch(console.error);
  try { await load(); } catch (error) { document.getElementById("ffcc-audit").innerHTML = `<tr><td colspan="5"><div class="ffcc-danger-note">${esc(error?.message || error)}</div></td></tr>`; }
}

async function renderOperations() {
  state.main.innerHTML = shellPage("System Health", "OPERATIONS", "Non-secret health indicators for the AI and data layers.", `<button class="ffcc-btn" data-ffcc-refresh>Refresh</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-card-grid"><div class="ffcc-health-card"><b>Admin API</b><div id="ffcc-health-admin" class="ffcc-health-line"><span>Checking…</span></div></div><div class="ffcc-health-card"><b>AI Coach endpoint</b><div id="ffcc-health-ai" class="ffcc-health-line"><span>Checking…</span></div></div><div class="ffcc-health-card"><b>Database metrics</b><div id="ffcc-health-db" class="ffcc-health-line"><span>Checking…</span></div></div></div><div style="height:14px"></div><div class="ffcc-panel"><div class="ffcc-panel-head"><h2>Release safety notes</h2><span class="ffcc-muted">Operational rules</span></div><div class="ffcc-list"><div class="ffcc-row"><div class="ffcc-row-main"><b>Do not mutate paid entitlements from support tools</b><span>Play-verified purchases and admin support access remain separate.</span></div></div><div class="ffcc-row"><div class="ffcc-row-main"><b>Use the full Customers & Plan Builder for plan publishing</b><span>Existing training/nutrition editors remain the canonical publishing workspace.</span></div></div><div class="ffcc-row"><div class="ffcc-row-main"><b>Real Play lifecycle still requires Internal Testing</b><span>CI cannot prove purchase, renewal, cancellation, expiry, or restore on a physical device.</span></div></div></div></div>`;
  const load = async () => {
    const started = performance.now();
    try { await api("overview"); document.getElementById("ffcc-health-admin").innerHTML = `<span>Response</span><b class="ffcc-status ok">OK · ${Math.round(performance.now()-started)}ms</b>`; } catch (e) { document.getElementById("ffcc-health-admin").innerHTML = `<span>Response</span><b class="ffcc-status bad">FAIL</b>`; }
    try { const res = await fetch(`${AI_HEALTH_ENDPOINT}?v=${Date.now()}`, { cache: "no-store" }); document.getElementById("ffcc-health-ai").innerHTML = `<span>Liveness</span><b class="ffcc-status ${res.ok ? "ok" : "bad"}">${res.ok ? "OK" : `HTTP ${res.status}`}</b>`; } catch (_) { document.getElementById("ffcc-health-ai").innerHTML = `<span>Liveness</span><b class="ffcc-status bad">FAIL</b>`; }
    document.getElementById("ffcc-health-db").innerHTML = `<span>Tracked metrics</span><b class="ffcc-status ok">${esc(state.overview?.stats ? "AVAILABLE" : "LIVE")}</b>`;
  };
  document.querySelector("[data-ffcc-refresh]").onclick = () => load().catch(console.error);
  try { await load(); } catch (error) { console.error(error); }
}

function renderContent() {
  state.main.innerHTML = shellPage("Content Library", "CONTENT OPERATIONS", "Read-only inventory of the exercise catalog that the customer app already understands.", `<button class="ffcc-btn" data-ffcc-content-refresh>Reset</button>`);
  const body = document.getElementById("ffcc-page-body");
  body.innerHTML = `<div class="ffcc-toolbar"><div class="ffcc-search"><input id="ffcc-content-search" class="ffcc-input" placeholder="Search exercise name or Arabic name" /></div></div><div id="ffcc-content-list" class="ffcc-content-list"></div>`;
  const host = document.getElementById("ffcc-content-list");
  const render = () => { const q = document.getElementById("ffcc-content-search").value.trim().toLowerCase(); const rows = EXERCISES.filter(([id,en,ar]) => !q || `${id} ${en} ${ar}`.toLowerCase().includes(q)); host.innerHTML = rows.map(([id,en,ar]) => `<div class="ffcc-ex"><b>${esc(en)}</b><span>${esc(ar)} · ${esc(id)}</span></div>`).join(""); };
  document.getElementById("ffcc-content-search").oninput = render;
  document.querySelector("[data-ffcc-content-refresh]").onclick = () => { document.getElementById("ffcc-content-search").value = ""; render(); };
  render();
}

function updateRequestBadge(count) {
  const badge = document.querySelector("[data-ffcc-request-badge]");
  if (!badge) return;
  badge.textContent = String(count || 0);
  badge.style.display = count ? "grid" : "none";
}

function exportUsersCSV(rows) {
  const headers = ["uid","name","email","phone","trainingPro","nutritionPro","aiCoachPro","proExpiresAt","planRequest","planRequestAt"];
  const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((u) => {
    const e = u.entitlements || {};
    return [u.id, nameOf(u), emailOf(u), u.account?.phone || "", !!e.trainingPro, !!e.nutritionPro, !!e.aiCoachPro, e.proExpiresAt || "", hasRequest(u) ? requestLabel(u) : "", requestDate(u) || ""].map(escapeCell).join(",");
  })].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fifty-fit-users-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function refreshAll() {
  if (state.loading) return;
  state.loading = true;
  try {
    state.overview = await api("overview");
    state.users = await loadUsers();
    updateRequestBadge(state.users.filter(hasRequest).length);
    state.lastRefresh = new Date();
    if (state.page === "overview") await renderOverview();
  } finally {
    state.loading = false;
  }
}

function renderPage() {
  if (!state.main) return;
  if (state.page === "overview") return renderOverview();
  if (state.page === "users") return renderUsers();
  if (state.page === "requests") return renderRequests();
  if (state.page === "reports") return renderReports();
  if (state.page === "billing") return renderBilling();
  if (state.page === "operations") return renderOperations();
  if (state.page === "content") return renderContent();
  if (state.page === "audit") return renderAudit();
}

function installIdleTimeout() {
  if (state.idleResetBound) return;
  state.idleResetBound = true;
  const reset = () => {
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(async () => {
      try { await adminContext()?.auth?.signOut(); } catch (_) {}
    }, IDLE_TIMEOUT_MS);
  };
  ["pointerdown","keydown","mousemove","touchstart"].forEach((event) => window.addEventListener(event, reset, { passive: true }));
  reset();
}

function ready() {
  injectStyle();
  const shell = document.querySelector(".admin-shell");
  if (!shell) return false;
  state.root = document.getElementById("app");
  state.main = shell.querySelector(".main");
  state.nav = shell.querySelector(".sidebar nav");
  installSidebar();
  installIdleTimeout();
  updateSidebarActive();
  const badgeSource = state.users.length ? state.users : null;
  if (badgeSource) updateRequestBadge(badgeSource.filter(hasRequest).length);
  return true;
}

let observer = new MutationObserver(() => {
  if (!ready()) return;
});
observer.observe(document.body, { childList: true, subtree: true });

const start = () => {
  if (!ready()) {
    setTimeout(start, 100);
    return;
  }
  renderPage();
};
start();
