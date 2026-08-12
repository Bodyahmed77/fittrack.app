import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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

function adminUidFromPage() {
  const node = Array.from(document.querySelectorAll(".facts span + b, .facts b, .status-pills, .panel .muted"))
    .find((el) => /\bUID\s+[A-Za-z0-9_-]{10,}/.test(el.textContent || ""));
  if (!node) return "";
  const match = String(node.textContent || "").match(/\bUID\s+([A-Za-z0-9_-]{10,})/);
  return match ? match[1] : "";
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

function renderVerifiedSubscription(payload) {
  const panel = Array.from(document.querySelectorAll(".panel"))
    .find((el) => /Subscription/.test(el.textContent || ""));
  const ent = panel?.querySelector(".entitlements");
  if (!ent) return;

  const rows = [
    ["Training Pro", !!payload?.trainingPro],
    ["Nutrition Pro", !!payload?.nutritionPro],
    ["AI Coach Pro", !!payload?.aiCoachPro],
  ];
  ent.innerHTML = rows.map(([name, active]) =>
    `<div class="ent ${active ? "on" : ""}"><b>${name}</b><span>${active ? "Verified active" : "Not verified"}</span></div>`
  ).join("");

  const source = panel.querySelector(".admin-billing-source");
  const banner = source || document.createElement("div");
  banner.className = "admin-billing-source";
  banner.style.cssText = "margin-top:10px;padding:9px 11px;border-radius:9px;background:#111;border:1px solid rgba(255,255,255,.08);color:#777;font-size:11px";
  banner.textContent = "Billing status source: Supabase verified entitlements (Google Play server state).";
  if (!source) panel.appendChild(banner);

  const pills = document.querySelector(".status-pills");
  if (pills) {
    const activeNames = rows.filter(([, active]) => active).map(([name]) => name);
    pills.innerHTML = activeNames.length
      ? activeNames.map((name) => `<span class="badge gold">${name}</span>`).join("")
      : `<span class="badge">No verified Pro subscription</span>`;
  }
}

async function refreshVerifiedSubscription() {
  const uid = adminUidFromPage();
  if (!uid || !currentAdminUser) return;
  try {
    const payload = await getVerifiedEntitlements(uid);
    if (payload?.ok) renderVerifiedSubscription(payload);
  } catch (error) {
    console.warn("Fifty Fit admin verified subscription lookup failed", error);
    const panel = Array.from(document.querySelectorAll(".panel")).find((el) => /Subscription/.test(el.textContent || ""));
    const source = panel?.querySelector(".admin-billing-source");
    if (source) source.textContent = "Billing verification temporarily unavailable. Firestore flags are not used as verified Play entitlement status.";
  }
}

async function localizeLatestNotification(uid, type, startedAt) {
  if (!uid) return;
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return;
  const user = userSnap.data() || {};
  const lang = user?.settings?.language || user?.settings?.lang || user?.account?.language || user?.account?.lang || "en";
  const ar = String(lang).toLowerCase().startsWith("ar");
  const notifications = await getDocs(collection(db, "users", uid, "notifications"));
  const matches = notifications.docs
    .map((snap) => ({ snap, data: snap.data() || {} }))
    .filter(({ data }) => data.type === type)
    .filter(({ data }) => {
      const created = Date.parse(String(data.createdAt || ""));
      return Number.isFinite(created) && created >= startedAt - 5000;
    })
    .sort((a, b) => String(b.data.createdAt || "").localeCompare(String(a.data.createdAt || "")));
  const latest = matches[0];
  if (!latest) return;

  const localized = type === "training_plan_ready"
    ? (ar
      ? { title: "اتضافت لك خطة تدريب جديدة 💪", body: "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit." }
      : { title: "A new training plan was added 💪", body: "Your personalized training plan is now ready in Fifty Fit." })
    : (ar
      ? { title: "اتضاف لك نظام أكل جديد 🍽️", body: "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit." }
      : { title: "A new nutrition plan was added 🍽️", body: "Your personalized nutrition plan is now ready in Fifty Fit." });

  await setDoc(latest.snap.ref, {
    title: localized.title,
    body: localized.body,
    titleAr: ar ? localized.title : "اتضافت لك خطة جديدة",
    bodyAr: ar ? localized.body : "Your personalized plan is now ready in Fifty Fit.",
    localizedAt: new Date().toISOString(),
  }, { merge: true });
}

function wrapPublishButton(button, type) {
  if (!button || button.__fiftyFitWrapped) return;
  const original = button.onclick;
  if (typeof original !== "function") return;
  button.__fiftyFitWrapped = true;
  button.onclick = async function wrappedPublish(event) {
    const startedAt = Date.now();
    await original.call(this, event);
    const uid = adminUidFromPage();
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
  if (!user) return;
  observer = new MutationObserver(() => scanAdminUi());
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  refreshTimer = setInterval(() => scanAdminUi(), 4000);
  scanAdminUi();
});
