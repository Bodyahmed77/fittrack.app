import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_APP = getApps().length ? getApp() : initializeApp(firebaseConfig);
const AUTH = getAuth(FIREBASE_APP);
const DB = getFirestore(FIREBASE_APP);
const FEED_URL = "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-billing-feed";
const STORAGE_KEY = "fiftyfit-admin-last-billing-event";
let timer = null;
let firstPoll = true;

function esc(value = "") { return String(value).replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c])); }
function formatDate(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString("en-EG", { dateStyle:"medium", timeStyle:"short" }) : ""; }
function productLabel(key) { return ({ training_pro:"Training Pro", nutrition_pro:"Nutrition Pro", ai_coach_pro:"AI Coach Pro" })[key] || key || "Pro"; }
async function customer(uid) {
  try { const snap = await getDoc(doc(DB, "users", uid)); const a = snap.exists() ? (snap.data()?.account || {}) : {}; return { name: a.name || "Customer", email: a.email || uid }; }
  catch { return { name: "Customer", email: uid }; }
}
function ensureUi() {
  if (document.getElementById("ff-admin-billing-center")) return;
  const host = document.createElement("div"); host.id = "ff-admin-billing-center"; host.innerHTML = `
    <button id="ff-admin-bell" type="button" aria-label="Billing notifications" style="position:fixed;right:20px;bottom:20px;z-index:9999;width:52px;height:52px;border:0;border-radius:50%;background:#151515;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer;font-size:22px">🔔<span id="ff-admin-badge" style="display:none;position:absolute;right:-2px;top:-2px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#21c16b;color:#050505;font:800 10px/18px system-ui">0</span></button>
    <div id="ff-admin-panel" hidden style="position:fixed;right:20px;bottom:84px;z-index:9999;width:min(420px,calc(100vw - 32px));max-height:65vh;overflow:auto;background:#0b0b0b;border:1px solid #252525;border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.55);padding:14px;color:#fff;font-family:system-ui,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><b>Billing activity</b><button id="ff-admin-close" type="button" style="background:none;border:0;color:#999;cursor:pointer;font-size:18px">×</button></div>
      <div id="ff-admin-items" style="display:flex;flex-direction:column;gap:8px"><div style="color:#888;font-size:12px">No recent billing events.</div></div>
    </div>`;
  document.body.appendChild(host);
  document.getElementById("ff-admin-bell").onclick = () => { const panel = document.getElementById("ff-admin-panel"); panel.hidden = !panel.hidden; if (!panel.hidden) { const b = document.getElementById("ff-admin-badge"); b.style.display = "none"; b.textContent = "0"; } };
  document.getElementById("ff-admin-close").onclick = () => { document.getElementById("ff-admin-panel").hidden = true; };
}
function addItems(events) {
  const box = document.getElementById("ff-admin-items"); if (!box) return;
  const fragment = document.createDocumentFragment();
  events.forEach((event) => {
    const row = document.createElement("div"); row.style.cssText = "padding:10px 11px;border:1px solid #222;border-radius:12px;background:#111";
    row.innerHTML = `<div style="font-weight:800;font-size:12px">Payment/entitlement update</div><div data-customer style="margin-top:4px;color:#ddd;font-size:12px">Loading customer…</div><div style="margin-top:4px;color:#888;font-size:10.5px">${esc(productLabel(event.product_key))} · ${esc(formatDate(event.created_at))}</div><div style="margin-top:4px;color:#999;font-size:10.5px">Expires: ${esc(event.expires_at ? formatDate(event.expires_at) : "No expiry")}</div>`;
    fragment.appendChild(row);
    customer(event.uid).then((c) => { const el = row.querySelector("[data-customer]"); if (el) el.textContent = `${c.name} · ${c.email}`; });
  });
  if (events.length) { box.querySelectorAll("[data-empty]").forEach((e) => e.remove()); box.prepend(fragment); }
}
async function poll() {
  const user = AUTH.currentUser; if (!user) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch(FEED_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const payload = await response.json();
    const events = (payload.events || []).filter((e) => e.purchase_token_present && e.purchase_state === "active");
    if (!events.length) return;
    const lastId = Number(localStorage.getItem(STORAGE_KEY) || 0);
    const fresh = events.filter((e) => Number(e.id) > lastId).sort((a,b) => Number(a.id)-Number(b.id));
    if (fresh.length && !firstPoll) {
      addItems(fresh.slice(-10));
      const badge = document.getElementById("ff-admin-badge"); badge.style.display = "block"; badge.textContent = String(Math.min(99, Number(badge.textContent || 0) + fresh.length));
    } else if (firstPoll) {
      addItems(events.slice(0, 10));
    }
    localStorage.setItem(STORAGE_KEY, String(Math.max(lastId, ...events.map((e) => Number(e.id)))));
    firstPoll = false;
  } catch {}
}
function start(user) {
  ensureUi();
  if (timer) clearInterval(timer);
  firstPoll = true;
  if (user) { poll(); timer = setInterval(poll, 15000); }
}

ensureUi();
onAuthStateChanged(AUTH, (user) => start(user));