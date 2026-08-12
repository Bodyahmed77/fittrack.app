from pathlib import Path
import re

path = Path('admin/app.js')
s = path.read_text(encoding='utf-8')

# Add verified-entitlement helper once.
anchor = 'const db = getFirestore(app);\nconst root = document.getElementById("app");\n'
helper = '''const db = getFirestore(app);\nconst root = document.getElementById("app");\n\nconst SUPABASE_ADMIN_ENTITLEMENTS =\n  "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/admin-entitlements";\n\nasync function getVerifiedEntitlementsForAdmin(uid) {\n  if (!uid || !currentUser) return null;\n  try {\n    const token = await currentUser.getIdToken();\n    const response = await fetch(SUPABASE_ADMIN_ENTITLEMENTS, {\n      method: "POST",\n      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },\n      body: JSON.stringify({ uid }),\n    });\n    if (!response.ok) return null;\n    const payload = await response.json();\n    return payload?.ok ? payload : null;\n  } catch {\n    return null;\n  }\n}\n'''
if anchor not in s:
    raise SystemExit('admin helper anchor not found')
s = s.replace(anchor, helper, 1)

# openCustomer: fetch verified status before rendering.
old = '''  currentCustomer = { id: snap.id, ...snap.data() };\n  planDraft = normalizeTraining(currentCustomer.customTrainingPlan);\n  nutritionDraft = normalizeNutrition(currentCustomer.customNutritionPlan);'''
new = '''  const rawCustomer = { id: snap.id, ...snap.data() };\n  rawCustomer.verifiedEntitlements = await getVerifiedEntitlementsForAdmin(uid);\n  currentCustomer = rawCustomer;\n  planDraft = normalizeTraining(currentCustomer.customTrainingPlan);\n  nutritionDraft = normalizeNutrition(currentCustomer.customNutritionPlan);'''
if old not in s:
    raise SystemExit('openCustomer block not found')
s = s.replace(old, new, 1)

# Subscription panel: use verified state for displayed billing truth.
old = '  const a = currentCustomer.account || {}, e = currentCustomer.entitlements || {};\n  const hasTraining = !!e.trainingPro, hasNutrition = !!e.nutritionPro;'
new = '  const a = currentCustomer.account || {};\n  const e = currentCustomer.verifiedEntitlements || { trainingPro: false, nutritionPro: false, aiCoachPro: false };\n  const firestoreFlags = currentCustomer.entitlements || {};\n  const hasVerified = !!currentCustomer.verifiedEntitlements;\n  const hasTraining = !!e.trainingPro, hasNutrition = !!e.nutritionPro;'
if old not in s:
    raise SystemExit('subscription state block not found')
s = s.replace(old, new, 1)

s = s.replace('${hasTraining ? \'Active\' : \'Not active\'}', '${hasTraining ? \'Verified active\' : \'Not verified\'}', 1)
s = s.replace('${hasNutrition ? \'Active\' : \'Not active\'}', '${hasNutrition ? \'Verified active\' : \'Not verified\'}', 1)
s = s.replace('${e.aiCoachPro ? \'Active\' : \'Not active\'}', '${e.aiCoachPro ? \'Verified active\' : \'Not verified\'}', 1)

# Add a clear mismatch banner under the subscription card.
needle = '</div></section></div>\n  <div class="editor-tabs">'
banner = '''</div><div class="admin-billing-note">${hasVerified\n    ? "Billing status shown here is verified from Supabase/Google Play entitlement state."\n    : "Billing verification is currently unavailable. Firestore flags are not treated as verified Play subscriptions."}</div></section></div>\n  <div class="editor-tabs">'''
if needle not in s:
    raise SystemExit('subscription panel closing marker not found')
s = s.replace(needle, banner, 1)

# Publish notifications: store Arabic + English variants and choose the user's language for the primary local notification text.
old_train = '''  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`training-plan-${Date.now()}`), { type: "training_plan_ready", title: "Your training plan is ready", body: "Your personalized training plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });'''
new_train = '''  const userLang = String(currentCustomer?.settings?.language || currentCustomer?.settings?.lang || currentCustomer?.account?.language || currentCustomer?.account?.lang || "en").toLowerCase();\n  const ar = userLang.startsWith("ar");\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`training-plan-${Date.now()}`), {\n    type: "training_plan_ready",\n    title: ar ? "اتضافت لك خطة تدريب جديدة 💪" : "A new training plan was added 💪",\n    body: ar ? "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized training plan is now ready in Fifty Fit.",\n    titleAr: "اتضافت لك خطة تدريب جديدة 💪",\n    bodyAr: "خطة التدريب المخصصة ليك بقت جاهزة داخل Fifty Fit.",\n    titleEn: "A new training plan was added 💪",\n    bodyEn: "Your personalized training plan is now ready in Fifty Fit.",\n    createdAt: new Date().toISOString(),\n    read: false,\n  }, { merge: false });'''
if old_train not in s:
    raise SystemExit('training notification block not found')
s = s.replace(old_train, new_train, 1)

old_nut = '''  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`nutrition-plan-${Date.now()}`), { type: "nutrition_plan_ready", title: "Your nutrition plan is ready", body: "Your personalized nutrition plan has been published.", createdAt: new Date().toISOString(), read: false }, { merge: false });'''
new_nut = '''  const userLang = String(currentCustomer?.settings?.language || currentCustomer?.settings?.lang || currentCustomer?.account?.language || currentCustomer?.account?.lang || "en").toLowerCase();\n  const ar = userLang.startsWith("ar");\n  await setDoc(doc(db,"users",currentCustomer.id,"notifications",`nutrition-plan-${Date.now()}`), {\n    type: "nutrition_plan_ready",\n    title: ar ? "اتضاف لك نظام أكل جديد 🍽️" : "A new nutrition plan was added 🍽️",\n    body: ar ? "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit." : "Your personalized nutrition plan is now ready in Fifty Fit.",\n    titleAr: "اتضاف لك نظام أكل جديد 🍽️",\n    bodyAr: "خطة الأكل المخصصة ليك بقت جاهزة داخل Fifty Fit.",\n    titleEn: "A new nutrition plan was added 🍽️",\n    bodyEn: "Your personalized nutrition plan is now ready in Fifty Fit.",\n    createdAt: new Date().toISOString(),\n    read: false,\n  }, { merge: false });'''
if old_nut not in s:
    raise SystemExit('nutrition notification block not found')
s = s.replace(old_nut, new_nut, 1)

path.write_text(s, encoding='utf-8')

# Add admin billing note style to styles.css.
css = Path('admin/styles.css')
style = css.read_text(encoding='utf-8')
if '.admin-billing-note' not in style:
    style += '''\n\n.admin-billing-note {\n  margin-top: 8px;\n  padding: 9px 11px;\n  border-radius: 9px;\n  background: #111;\n  border: 1px solid rgba(255,255,255,.08);\n  color: #777;\n  font-size: 11px;\n  line-height: 1.45;\n}\n'''
css.write_text(style, encoding='utf-8')

# Remove the old runtime enhancement module so it cannot overwrite the app's verified billing UI or duplicate listeners.
html = Path('admin/index.html')
h = html.read_text(encoding='utf-8')
h = h.replace('    <script type="module" src="./runtime-enhancements.js?v=20260812-3"></script>\n', '')
h = h.replace('    <script type="module" src="./boot.js?v=20260812-3"></script>', '    <script type="module" src="./boot.js?v=20260812-5"></script>')
h = h.replace('<link rel="stylesheet" href="./styles.css?v=20260812-3" />', '<link rel="stylesheet" href="./styles.css?v=20260812-5" />')
html.write_text(h, encoding='utf-8')

# Cache-bust app/cardio imports inside boot.js.
boot = Path('admin/boot.js')
b = boot.read_text(encoding='utf-8')
b = b.replace('import("./app.js").then(() => import("./cardio.js"))', 'import("./app.js?v=20260812-5").then(() => import("./cardio.js?v=20260812-5"))')
boot.write_text(b, encoding='utf-8')

print('admin release patch complete')
