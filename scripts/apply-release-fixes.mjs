import fs from 'node:fs';

const replaceOnce = (path, from, to, label) => {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(`${label}: pattern not found in ${path}`);
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
};

replaceOnce('src/App.jsx',
  'customPlan: parsed.customPlan || {},',
  'customPlan: parsed.customPlan || {},\n          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,',
  'custom plan merge');

replaceOnce('src/App.jsx',
  '  const embedSrc = isTikTok\n    ? (resolvedTikTokId ? `https://www.tiktok.com/player/v1/${resolvedTikTokId}?controls=1&autoplay=0&description=0&music_info=0&rel=0` : "about:blank")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;',
  '  const embedSrc = isTikTok\n    ? String(videoId || "")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;',
  'direct TikTok WebView');

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
const prefetchBlock = `  useEffect(() => {\n    if (!videoId || typeof document === "undefined") return undefined;\n    const isTikTok = /^\\d+$/.test(videoId);\n    const href = isTikTok\n      ? \`https://www.tiktok.com/player/v1/\${videoId}?controls=1&autoplay=0&description=0&music_info=0&rel=0\`\n      : \`https://www.youtube-nocookie.com/embed/\${videoId}?playsinline=1&rel=0\`;\n    const link = document.createElement("link");\n    link.rel = "prefetch";\n    link.as = "document";\n    link.href = href;\n    document.head.appendChild(link);\n    return () => link.remove();\n  }, [videoId]);`;
if (app.includes(prefetchBlock)) app = app.replace(prefetchBlock, '');

const listenerAnchor = '    return unsub;\n  }, [uid]);';
const listenerReplacement = `    const notificationsRef = collection(db, "users", uid, "notifications");\n    const notificationSessionStartedAt = Date.now();\n    const unsubNotifications = onSnapshot(notificationsRef, (notificationSnap) => {\n      notificationSnap.docChanges().forEach((change) => {\n        if (change.type !== "added") return;\n        const n = change.doc.data() || {};\n        const createdAtMs = Date.parse(String(n.createdAt || ""));\n        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;\n        LocalNotifications.schedule({ notifications: [{\n          id: Math.floor(Math.random() * 900000000) + 100000000,\n          title: n.title || "Fifty Fit",\n          body: n.body || "You have a new update.",\n          schedule: { at: new Date(Date.now() + 300) },\n        }] }).catch(() => {});\n      });\n    });\n    return () => { unsub(); unsubNotifications(); };\n  }, [uid]);`;
if (!app.includes(listenerAnchor)) throw new Error('Firestore listener anchor not found');
app = app.replace(listenerAnchor, listenerReplacement);
fs.writeFileSync(appPath, app);

const adminPath = 'admin/app.js';
let admin = fs.readFileSync(adminPath, 'utf8');
const trainingOld = '  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });\n  currentCustomer.customTrainingPlan = payload;';
const trainingNew = '  await setDoc(doc(db,"users",currentCustomer.id), { customTrainingPlan: payload, workoutStartDate: payload.startDate }, { merge: true });\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`training-plan-${Date.now()}`), { type: "training_plan_ready", title: "Your training plan is ready", body: "Your personalized training plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });\n  currentCustomer.customTrainingPlan = payload;';
if (!admin.includes(trainingOld)) throw new Error('training publish pattern not found');
admin = admin.replace(trainingOld, trainingNew);
const nutritionOld = '  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });\n  currentCustomer.customNutritionPlan = payload;';
const nutritionNew = '  await setDoc(doc(db,"users",currentCustomer.id), { customNutritionPlan: payload }, { merge: true });\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`nutrition-plan-${Date.now()}`), { type: "nutrition_plan_ready", title: "Your nutrition plan is ready", body: "Your personalized nutrition plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });\n  currentCustomer.customNutritionPlan = payload;';
if (!admin.includes(nutritionOld)) throw new Error('nutrition publish pattern not found');
admin = admin.replace(nutritionOld, nutritionNew);
fs.writeFileSync(adminPath, admin);

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');
const anchor = '    }\n  }\n}\n';
const block = '    }\n\n    match /users/{userId}/notifications/{notificationId} {\n      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());\n      allow create: if isAdmin();\n      allow update, delete: if request.auth != null && request.auth.uid == userId;\n    }\n  }\n}\n';
if (!rules.includes(anchor)) throw new Error('rules anchor not found');
rules = rules.replace(anchor, block);
fs.writeFileSync(rulesPath, rules);

console.log('release fixes applied');
