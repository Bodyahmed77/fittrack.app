import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();
const SUPABASE_PROJECT = "zemqiedqcujevyewfpld";
const SUPABASE_FUNCTION = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/admin-entitlements`;

let observer = null;
let refreshTimer = null;
let currentAdminUser = null;
let lastVerifiedUid = null;
let lastVerifiedAt = 0;
let subscriptionWatchUnsub = null;
const entitlementFingerprintByUid = new Map();
const recentSubscriptionAlerts = [];

function adminUidFromPage() {
  const node = Array.from(document.querySelectorAll(".facts span + b, .facts b, .status-pills, .panel .muted, .page-head"))
    .find((el) => /\bUID\s+[A-Za-z0-9_-]{10,}/.test(el.textContent || "") || /UID\s+[A-Za-z0-9_-]{10,}/.test(el.innerHTML || ""));
  if (!node) {
    const text = document.body?.innerText || "";
    const m = text.match(/\bUID\s+([A-Za-z0-9_-]{10,})/);
    return m ? m[1] : "";
  }
  const match = String(node.textContent || node.innerHTML || "").match(/\bUID\s+([A-Za-z0-9_-]{10,})/);
  return match ? match[1] : "";
}

function fingerprintEntitlements(e = {}) {
  return [!!e.trainingPro, !!e.nutritionPro, !!e.aiCoachPro].join("|");
}

function gainedPlans(prevFp, nextFp) {
  const prev = String(prevFp || "false|false|false").split("|");
  const next = String(nextFp || "false|false|false").split("|");
  const labels = ["Training Pro", "Nutrition Pro", "AI Coach Pro"];
  const gained = [];
  for (let i = 0; i < 3; i++) {
    if (next[i] === "true" && prev[i] !== "true") gained.push(labels[i]);
  }
  return gained;
}

function ensureNotifStyles() {
  if (document.getElementById("fiftyfit-admin-notif-style")) return;
  const style = document.createElement("style");
  style.id = "fiftyfit-admin-notif-style";
  style.textContent = `
    #fiftyfit-sub-toast {
      position: fixed; right: 18px; bottom: 18px; z-index: 99999;
      max-width: 360px; background: #111; color: #fff; border: 1px solid #2a2a2a;
      border-radius: 14px; padding: 14px 16px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
      font: 14px/1.4 system-ui, sans-serif;
    }
    #fiftyfit-sub-toast strong { display:block; margin-bottom: 4px; }
    #fiftyfit-sub-toast .plans { color: #9ae6b4; font-size: 13px; }
    #fiftyfit-sub-bell {
      position: fixed; top: 16px; right: 16px; z-index: 99998;
      background: #1a1a1a; border: 1px solid #333; color: #fff;
      border-radius: 999px; padding: 8px 14px; cursor: pointer;
      font: 13px system-ui, sans-serif;
    }
    #fiftyfit-sub-bell.has-new { border-color: #48bb78; box-shadow: 0 0 0 2px rgba(72,187,120,.25); }
    #fiftyfit-sub-panel {
      position: fixed; top: 56px; right: 16px; z-index: 99998; width: 340px;
      max-height: 420px; overflow: auto; background: #0d0d0d; border: 1px solid #2a2a2a;
      border-radius: 14px; padding: 12px; display: none;
      font: 13px/1.4 system-ui, sans-serif; color: #eee;
    }
    #fiftyfit-sub-panel.open { display: block; }
    #fiftyfit-sub-panel .item {
      border-bottom: 1px solid #222; padding: 10px 4px;
    }
    #fiftyfit-sub-panel .item:last-child { border-bottom: none; }
    #fiftyfit-sub-panel .item .time { color: #888; font-size: 11px; }
    .admin-dual-note { margin-top: 10px; font-size: 12px; color: #9aa; line-height: 1.45; }
  `;
  document.head.appendChild(style);
}

function ensureNotifUi() {
  ensureNotifStyles();
  if (!document.getElementById("fiftyfit-sub-bell")) {
    const bell = document.createElement("button");
    bell.id = "fiftyfit-sub-bell";
    bell.type = "button";
    bell.textContent = "🔔 Subscriptions";
    bell.onclick = () => {
      const panel = document.getElementById("fiftyfit-sub-panel");
      if (!panel) return;
      panel.classList.toggle("open");
      bell.classList.remove("has-new");
    };
    document.body.appendChild(bell);
  }
  if (!document.getElementById("fiftyfit-sub-panel")) {
    const panel = document.createElement("div");
    panel.id = "fiftyfit-sub-panel";
    panel.innerHTML = `<div class="muted" style="color:#888;padding:6px 4px">Live alerts when a customer gains Pro (Firestore or Play).</div>`;
    document.body.appendChild(panel);
  }
}

function renderAlertFeed() {
  const panel = document.getElementById("fiftyfit-sub-panel");
  if (!panel) return;
  if (!recentSubscriptionAlerts.length) {
    panel.innerHTML = `<div style="color:#888;padding:8px 4px">No new subscriptions yet while this page is open.</div>`;
    return;
  }
  panel.innerHTML = recentSubscriptionAlerts
    .slice(0, 30)
    .map(
      (a) => `<div class="item"><strong>${escapeHtml(a.name)}</strong><div>${escapeHtml(a.email)}</div><div class="plans" style="color:#9ae6b4">${escapeHtml(a.plans.join(" · "))}</div><div class="time">${escapeHtml(a.at)}</div></div>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showSubscriptionToast(alert) {
  ensureNotifUi();
  let toast = document.getElementById("fiftyfit-sub-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "fiftyfit-sub-toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<strong>New subscription</strong><div>${escapeHtml(alert.name)}</div><div class="plans">${escapeHtml(alert.plans.join(" · "))}</div>`;
  toast.style.display = "block";
  clearTimeout(showSubscriptionToast._t);
  showSubscriptionToast._t = setTimeout(() => {
    if (toast) toast.style.display = "none";
  }, 8000);
  const bell = document.getElementById("fiftyfit-sub-bell");
  if (bell) bell.classList.add("has-new");
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Fifty Fit — new subscription", {
        body: `${alert.name}: ${alert.plans.join(", ")}`,
      });
    } catch (_) {}
  }
}

function pushSubscriptionAlert(userId, data, gained) {
  const account = data?.account || {};
  const alert = {
    uid: userId,
    name: account.name || "Customer",
    email: account.email || userId,
    plans: gained,
    at: new Date().toLocaleString(),
  };
  recentSubscriptionAlerts.unshift(alert);
  if (recentSubscriptionAlerts.length > 40) recentSubscriptionAlerts.length = 40;
  ensureNotifUi();
  renderAlertFeed();
  showSubscriptionToast(alert);
}

function startSubscriptionWatcher() {
  if (subscriptionWatchUnsub || !currentAdminUser) return;
  ensureNotifUi();
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try { Notification.requestPermission().catch(() => {}); } catch (_) {}
  }
  subscriptionWatchUnsub = onSnapshot(
    collection(db, "users"),
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== "added" && change.type !== "modified") return;
        const data = change.doc.data() || {};
        const nextFp = fingerprintEntitlements(data.entitlements || {});
        const prevFp = entitlementFingerprintByUid.get(change.doc.id);
        if (prevFp === undefined) {
          entitlementFingerprintByUid.set(change.doc.id, nextFp);
          return;
        }
        if (prevFp === nextFp) return;
        const gained = gainedPlans(prevFp, nextFp);
        entitlementFingerprintByUid.set(change.doc.id, nextFp);
        if (gained.length) pushSubscriptionAlert(change.doc.id, data, gained);
      });
    },
    (err) => {
      console.warn("Fifty Fit subscription watcher failed", err);
    },
  );
}

async function getVerifiedEntitlements(uid) {
  if (!uid || !currentAdminUser) return null;
  const now = Date.now();
  if (uid === lastVerifiedUid && now - lastVerifiedAt < 5000 && window.__FIFTYFIT_VERIFIED_ENTITLEMENTS__) {
    return window.__FIFTYFIT_VERIFIED_ENTITLEMENTS__;
  }
  const token = await currentAdminUser.getIdToken();
  const response = await fetch(SUPABASE_FUNCTION, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) throw new Error(`verified entitlement lookup failed (${response.status})`);
  const payload = await response.json();
  window.__FIFTYFIT_VERIFIED_ENTITLEMENTS__ = payload;
  lastVerifiedUid = uid;
  lastVerifiedAt = now;
  return payload;
}

async function getFirestoreEntitlements(uid) {
  if (!uid) return {};
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return {};
  return snap.data()?.entitlements || {};
}

function renderVerifiedSubscription(payload, firestoreEnt = {}) {
  const panel = Array.from(document.querySelectorAll(".panel"))
    .find((el) => /Subscription/.test(el.textContent || ""));
  const ent = panel?.querySelector(".entitlements");
  if (!ent) return;

  const rows = [
    ["Training Pro", !!payload?.trainingPro, !!firestoreEnt.trainingPro],
    ["Nutrition Pro", !!payload?.nutritionPro, !!firestoreEnt.nutritionPro],
    ["AI Coach Pro", !!payload?.aiCoachPro, !!firestoreEnt.aiCoachPro],
  ];
  ent.innerHTML = rows
    .map(([name, play, app]) => {
      const active = play || app;
      let label = "Not active";
      if (play && app) label = "Play verified + in app";
      else if (play) label = "Play verified";
      else if (app) label = "In app (admin/local)";
      return `<div class="ent ${active ? "on" : ""}"><b>${name}</b><span>${label}</span></div>`;
    })
    .join("");

  let note = panel.querySelector(".admin-dual-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "admin-dual-note";
    panel.appendChild(note);
  }
  note.textContent =
    "Play verified = Supabase/Google Play. In app = Firestore flags (admin grant or client unlock). List badges use Firestore; detail now shows both.";

  const pills = document.querySelector(".status-pills");
  if (pills) {
    const activeNames = [];
    if (payload?.trainingPro || firestoreEnt.trainingPro) activeNames.push("Training Pro");
    if (payload?.nutritionPro || firestoreEnt.nutritionPro) activeNames.push("Nutrition Pro");
    if (payload?.aiCoachPro || firestoreEnt.aiCoachPro) activeNames.push("AI Coach");
    pills.innerHTML = activeNames.length
      ? activeNames.map((name) => `<span class="badge gold">${name}</span>`).join("")
      : `<span class="badge">No Pro</span>`;
  }
}

async function refreshVerifiedSubscription() {
  const uid = adminUidFromPage();
  if (!uid) return;
  try {
    const [payload, fs] = await Promise.all([
      getVerifiedEntitlements(uid).catch(() => null),
      getFirestoreEntitlements(uid).catch(() => ({})),
    ]);
    renderVerifiedSubscription(payload && payload.ok ? payload : {}, fs || {});
  } catch (error) {
    console.warn("Fifty Fit admin verified subscription lookup failed", error);
  }
}

async function localizeLatestNotification(uid, type, afterMs) {
  const notificationsRef = collection(db, "users", uid, "notifications");
  const snaps = await getDocs(notificationsRef);
  let latest = null;
  snaps.forEach((snap) => {
    const data = snap.data() || {};
    const createdAtMs = Date.parse(String(data.createdAt || ""));
    if (!Number.isFinite(createdAtMs) || createdAtMs < afterMs - 2000) return;
    if (!latest || createdAtMs > latest.createdAtMs) {
      latest = { snap, data, createdAtMs };
    }
  });
  if (!latest) return;
  const ar = String(latest.data.lang || latest.data.language || "").toLowerCase().startsWith("ar");
  const localized =
    type === "training_plan_ready"
      ? ar
        ? { title: "اتضافت لك خطة تدريب جديدة 🏋️", body: "خطتك الشخصية جاهزة دلوقتي جوه Fifty Fit." }
        : { title: "A new training plan was added 🏋️", body: "Your personalized training plan is now ready in Fifty Fit." }
      : ar
        ? { title: "اتضافت لك خطة تغذية جديدة 🍽️", body: "خطتك الغذائية الشخصية جاهزة دلوقتي جوه Fifty Fit." }
        : { title: "A new nutrition plan was added 🍽️", body: "Your personalized nutrition plan is now ready in Fifty Fit." };

  await setDoc(
    latest.snap.ref,
    {
      title: localized.title,
      body: localized.body,
      titleAr: ar ? localized.title : "اتضافت لك خطة جديدة",
      bodyAr: ar ? localized.body : "Your personalized plan is now ready in Fifty Fit.",
      localizedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function requireVerifiedEntitlement(uid, type) {
  const field = type === "training_plan_ready" ? "trainingPro" : "nutritionPro";
  try {
    const fs = await getFirestoreEntitlements(uid);
    if (fs?.[field]) return true;
  } catch (error) {
    console.warn("Firestore entitlement read failed", error);
  }
  try {
    const payload = await getVerifiedEntitlements(uid);
    if (payload?.ok && payload?.[field]) return true;
  } catch (error) {
    console.warn("Play entitlement lookup failed", error);
  }
  alert("This customer does not have Pro for this plan (neither Play-verified nor in-app flags).");
  return false;
}

function wrapPublishButton(button, type) {
  if (!button || button.__fiftyFitWrapped) return;
  const original = button.onclick;
  if (typeof original !== "function") return;
  button.__fiftyFitWrapped = true;
  button.onclick = async function wrappedPublish(event) {
    const uid = adminUidFromPage();
    try {
      const allowed = await requireVerifiedEntitlement(uid, type);
      if (!allowed) return;
    } catch (error) {
      console.warn("Fifty Fit verified entitlement check failed", error);
      alert("Could not check Pro status. The plan was not published.");
      return;
    }

    const startedAt = Date.now();
    await original.call(this, event);
    try {
      await localizeLatestNotification(uid, type, startedAt);
    } catch (error) {
      console.warn("Fifty Fit notification localization failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    await refreshVerifiedSubscription();
  };
}

function scanAdminUi() {
  wrapPublishButton(document.getElementById("save-training"), "training_plan_ready");
  wrapPublishButton(document.getElementById("save-nutrition"), "nutrition_plan_ready");
  refreshVerifiedSubscription().catch(() => {});
}

onAuthStateChanged(auth, (user) => {
  currentAdminUser = user;
  if (observer) observer.disconnect();
  if (refreshTimer) clearInterval(refreshTimer);
  if (subscriptionWatchUnsub) {
    subscriptionWatchUnsub();
    subscriptionWatchUnsub = null;
  }
  entitlementFingerprintByUid.clear();
  if (!user) return;
  observer = new MutationObserver(() => scanAdminUi());
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  refreshTimer = setInterval(() => scanAdminUi(), 4000);
  scanAdminUi();
  startSubscriptionWatcher();
});
