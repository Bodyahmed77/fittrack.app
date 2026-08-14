import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

const CHANNEL_ID = "fifty-fit-plans";
const seenNotificationIds = new Set();

function stableId(value) {
  let hash = 2166136261;
  for (const ch of String(value || "")) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 2000000000 || 1;
}

function textForNotification(data) {
  const type = String(data?.type || "");
  const title = data?.title ||
    (type === "nutrition_plan_ready"
      ? "Your nutrition plan is ready"
      : type === "training_plan_ready"
      ? "Your training plan is ready"
      : "Fifty Fit");
  const body = data?.body ||
    data?.message ||
    (type === "nutrition_plan_ready"
      ? "Your personalized nutrition plan is ready to use."
      : type === "training_plan_ready"
      ? "Your personalized training plan is ready to use."
      : "You have a new update in Fifty Fit.");
  return { title: String(title), body: String(body) };
}

async function prepareChannel() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Fifty Fit Plans",
      description: "Personalized training and nutrition plan notifications",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch {}
  try {
    const permissions = await LocalNotifications.checkPermissions();
    if (permissions.display !== "granted") await LocalNotifications.requestPermissions();
  } catch {}
  return true;
}

async function showNativeNotification(id, data) {
  if (!Capacitor.isNativePlatform()) return;
  const { title, body } = textForNotification(data);
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 300) },
        extra: {
          route: data?.route || null,
          screen: data?.screen || null,
          type: data?.type || null,
        },
      }],
    });
  } catch (error) {
    console.warn("[PLAN_NOTIFICATION] local notification failed", error);
  }
}

export function startPlanNotificationBridge() {
  if (!Capacitor.isNativePlatform()) return () => {};
  let unsubscribeFirestore = null;
  let unsubscribeAuth = null;
  let stopped = false;

  const startForUser = async (user) => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    unsubscribeFirestore = null;
    seenNotificationIds.clear();
    if (!user || stopped) return;
    await prepareChannel();
    if (stopped) return;

    const ref = collection(db, "users", user.uid, "notifications");
    let hydrated = false;
    unsubscribeFirestore = onSnapshot(
      ref,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const id = change.doc.id;
          const data = change.doc.data() || {};
          if (change.type === "removed") return;
          if (!hydrated) {
            seenNotificationIds.add(id);
            return;
          }
          if (change.type !== "added" || seenNotificationIds.has(id)) return;
          seenNotificationIds.add(id);
          if (["nutrition_plan_ready", "training_plan_ready"].includes(String(data.type || ""))) {
            void showNativeNotification(stableId(`plan:${user.uid}:${id}`), data);
          }
        });
        hydrated = true;
      },
      (error) => console.warn("[PLAN_NOTIFICATION] Firestore listener failed", error),
    );
  };

  unsubscribeAuth = onAuthStateChanged(auth, (user) => { void startForUser(user); });

  return () => {
    stopped = true;
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (unsubscribeAuth) unsubscribeAuth();
    unsubscribeFirestore = null;
    unsubscribeAuth = null;
    seenNotificationIds.clear();
  };
}
