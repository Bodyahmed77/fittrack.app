import fs from 'node:fs';

const replaceIfPresent = (path, from, to) => {
  let s = fs.readFileSync(path, 'utf8');
  if (s.includes(from)) {
    s = s.replace(from, to);
    fs.writeFileSync(path, s);
    return true;
  }
  return false;
};

replaceIfPresent('src/App.jsx',
  'customPlan: parsed.customPlan || {},',
  'customPlan: parsed.customPlan || {},\n          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,');

replaceIfPresent('src/App.jsx',
  '  const embedSrc = isTikTok\n    ? (resolvedTikTokId ? `https://www.tiktok.com/player/v1/${resolvedTikTokId}?controls=1&autoplay=0&description=0&music_info=0&rel=0` : "about:blank")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;',
  '  const embedSrc = isTikTok\n    ? String(videoId || "")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;');

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
// Remove the old TikTok Player-v1 prefetch block if it is still present.
app = app.replace(/\n\s*useEffect\(\(\) => \{\n\s*if \(!videoId \|\| typeof document === "undefined"\) return undefined;\n\s*const isTikTok = \/\^\\\\d\+\$\/\.test\(videoId\);\n\s*const href = isTikTok[\s\S]*?return \(\) => link\.remove\(\);\n\s*\}, \[videoId\]\);/m, '\n');

const listenerAnchor = '    return unsub;\n  }, [uid]);';
if (!app.includes('const notificationsRef = collection(db, "users", uid, "notifications")')) {
  const listenerReplacement = `    const notificationsRef = collection(db, "users", uid, "notifications");
    const notificationSessionStartedAt = Date.now();
    const unsubNotifications = onSnapshot(notificationsRef, (notificationSnap) => {
      notificationSnap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const n = change.doc.data() || {};
        const createdAtMs = Date.parse(String(n.createdAt || ""));
        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;
        LocalNotifications.schedule({ notifications: [{
          id: Math.floor(Math.random() * 900000000) + 100000000,
          title: n.title || "Fifty Fit",
          body: n.body || "You have a new update.",
          schedule: { at: new Date(Date.now() + 300) },
        }] }).catch(() => {});
      });
    });
    return () => { unsub(); unsubNotifications(); };
  }, [uid]);`;
  if (!app.includes(listenerAnchor)) throw new Error('Firestore listener anchor not found');
  app = app.replace(listenerAnchor, listenerReplacement);
}
fs.writeFileSync(appPath, app);

const adminPath = 'admin/app.js';
let admin = fs.readFileSync(adminPath, 'utf8');
const trainingOld = '  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });\n  currentCustomer.customTrainingPlan = payload;';
const trainingNew = '  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`training-plan-${Date.now()}`), { type: "training_plan_ready", title: "Your training plan is ready", body: "Your personalized training plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });\n  currentCustomer.customTrainingPlan = payload;';
if (admin.includes(trainingOld)) admin = admin.replace(trainingOld, trainingNew);
const nutritionOld = '  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });\n  currentCustomer.customNutritionPlan = payload;';
const nutritionNew = '  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`nutrition-plan-${Date.now()}`), { type: "nutrition_plan_ready", title: "Your nutrition plan is ready", body: "Your personalized nutrition plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });\n  currentCustomer.customNutritionPlan = payload;';
if (admin.includes(nutritionOld)) admin = admin.replace(nutritionOld, nutritionNew);
fs.writeFileSync(adminPath, admin);

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');
if (!rules.includes('match /users/{userId}/notifications/{notificationId}')) {
  const anchor = '    }\n  }\n}\n';
  const block = '    }\n\n    match /users/{userId}/notifications/{notificationId} {\n      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());\n      allow create: if isAdmin();\n      allow update, delete: if request.auth != null && request.auth.uid == userId;\n    }\n  }\n}\n';
  if (!rules.includes(anchor)) throw new Error('rules anchor not found');
  rules = rules.replace(anchor, block);
  fs.writeFileSync(rulesPath, rules);
}

// This is intentionally a one-shot migration script; remove the temporary CI tooling.
try { fs.rmSync('scripts/apply-release-fixes.mjs'); } catch {}
try { fs.rmSync('.github/workflows/apply-release-fixes.yml'); } catch {}
console.log('release fixes applied');
