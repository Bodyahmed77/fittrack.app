from pathlib import Path
import re


def require_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {n}")
    return text.replace(old, new, 1)

# ----------------------------- App.jsx -----------------------------
path = Path('src/App.jsx')
s = path.read_text(encoding='utf-8')

# Imports: updateDoc for notification read state.
s = require_once(
    s,
    '  setDoc,\n  deleteDoc,',
    '  setDoc,\n  updateDoc,\n  deleteDoc,',
    'updateDoc import',
)

# useAppData: notification history state.
s = require_once(
    s,
    '  const [data, setDataRaw] = useState(freshState());\n  const [loaded, setLoaded] = useState(false);',
    '  const [data, setDataRaw] = useState(freshState());\n  const [notifications, setNotifications] = useState([]);\n  const [loaded, setLoaded] = useState(false);',
    'notifications state',
)

old = '''    const notificationsRef = collection(db, "users", uid, "notifications");\n    const notificationSessionStartedAt = Date.now();\n    const unsubNotifications = onSnapshot(notificationsRef, (notificationSnap) => {\n      notificationSnap.docChanges().forEach((change) => {\n        if (change.type !== "added") return;\n        const n = change.doc.data() || {};\n        const createdAtMs = Date.parse(String(n.createdAt || ""));\n        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;\n        LocalNotifications.schedule({ notifications: [{\n          id: Math.floor(Math.random() * 900000000) + 100000000,\n          title: n.title || "Fifty Fit",\n          body: n.body || "You have a new update.",\n          schedule: { at: new Date(Date.now() + 300) },\n        }] }).catch(() => {});\n      });\n    });'''
new = '''    const notificationsRef = collection(db, "users", uid, "notifications");\n    const notificationSessionStartedAt = Date.now();\n    const unsubNotifications = onSnapshot(notificationsRef, (notificationSnap) => {\n      const history = notificationSnap.docs\n        .map((snap) => ({ id: snap.id, ...snap.data() }))\n        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));\n      setNotifications(history);\n\n      notificationSnap.docChanges().forEach((change) => {\n        if (change.type !== "added") return;\n        const n = change.doc.data() || {};\n        const createdAtMs = Date.parse(String(n.createdAt || ""));\n        if (!Number.isFinite(createdAtMs) || createdAtMs < notificationSessionStartedAt - 2000) return;\n        LocalNotifications.schedule({ notifications: [{\n          id: Math.floor(Math.random() * 900000000) + 100000000,\n          title: n.title || "Fifty Fit",\n          body: n.body || "You have a new update.",\n          schedule: { at: new Date(Date.now() + 300) },\n        }] }).catch(() => {});\n      });\n    });'''
s = require_once(s, old, new, 'notification listener')

s = require_once(
    s,
    '      setLoaded(false);\n      verifiedEntitlementsRef.current = null;\n      return;',
    '      setLoaded(false);\n      setNotifications([]);\n      verifiedEntitlementsRef.current = null;\n      return;',
    'notification reset',
)

s = require_once(
    s,
    '  return { data, setData, setVerifiedEntitlements, loaded };',
    '  return { data, setData, setVerifiedEntitlements, loaded, notifications };',
    'useAppData return',
)

# Root hook destructuring.
s = require_once(
    s,
    '  const { data, setData, setVerifiedEntitlements, loaded } = useAppData(uid);',
    '  const { data, setData, setVerifiedEntitlements, loaded, notifications } = useAppData(uid);',
    'root notifications destructure',
)

# Paywall IDs / duration selection.
s = require_once(
    s,
    '  const [storeProducts, setStoreProducts] = useState([]);\n\n  // Launch policy: expose only a real monthly subscription until the native',
    '  const [storeProducts, setStoreProducts] = useState([]);\n  const planIds = ["training", "nutrition", "both", "ai"];\n\n  // All four durations are shown. The billing wrapper maps each duration to its own Google Play subscription product.\n',
    'planIds and duration policy',
)

s = require_once(
    s,
    '  // Launch policy: expose only a real monthly subscription until the native\n  // billing bridge supports selecting Google Play base-plan offer tokens.\n  // This prevents the UI from showing four prices that all purchase the same\n  // underlying product/base plan. Longer periods can be enabled later without\n  // changing the entitlement model.\n  const availableDurations = DURATIONS.filter((d) => d.id === "monthly");',
    '  const availableDurations = DURATIONS;',
    'monthly-only duration filter',
)

s = require_once(
    s,
    '  const storeProduct = storeProducts.find(\n    (p) => p?.productId === BILLING_PRODUCTS[selectedPlan],\n  );',
    '  const selectedProductId =\n    typeof BILLING_PRODUCTS[selectedPlan] === "string"\n      ? BILLING_PRODUCTS[selectedPlan]\n      : BILLING_PRODUCTS[selectedPlan]?.[selectedDuration];\n  const storeProduct = storeProducts.find(\n    (p) => p?.productId === selectedProductId,\n  );',
    'store product lookup',
)

# Nutrition null safety: inject an explicit empty-state before reading startDate.
pattern = re.compile(r'(\{\(\(\) => \{\n\s*)const start = customNutritionPlan\.startDate \|\| today;', re.M)
replacement = r'''\1if (!customNutritionPlan) {\n              return (\n                <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.6 }}>\n                  {ar\n                    ? "خطة الأكل المخصصة لسه بتتجهز. لما الأدمن ينشرها هتظهر هنا."\n                    : "Your personalized nutrition plan is being prepared. It will appear here once published."}\n                </div>\n              );\n            }\n            const start = customNutritionPlan.startDate || today;'''
if not pattern.search(s):
    raise SystemExit('nutrition null safety injection point not found')
s = pattern.sub(replacement, s, count=1)

# AI keyboard: remove the manual inset state and keyboard event machinery inside AICoachDrawer.
start = s.find('function AICoachDrawer(')
if start < 0:
    raise SystemExit('AICoachDrawer not found')
end = s.find('function AICoachSideTab(', start)
if end < 0:
    raise SystemExit('AICoachSideTab not found')
segment = s[start:end]
segment, n1 = re.subn(r'\s*const \[keyboardInset, setInset\] = useState\(0\);', '\n  const keyboardInset = 0;', segment, count=1)
if n1 != 1:
    raise SystemExit(f'keyboardInset state replacements: {n1}')
# Remove any effect whose body references KeyboardApi/keyboardInset listeners.
keyboard_effect = re.compile(r'\n  useEffect\(\(\) => \{[\s\S]*?Keyboard\.setResizeMode[\s\S]*?\}, \[\]\);', re.M)
segment, n2 = keyboard_effect.subn('', segment, count=1)
if n2 != 1:
    raise SystemExit(f'keyboard effect replacements: {n2}')
# Force composer directly against the drawer bottom; no bottom inset/padding gap.
segment = segment.replace('bottom: keyboardInset,', 'bottom: 0,')
segment = segment.replace('transition: "bottom 0.12s ease-out",', 'transition: "none",')
segment = segment.replace('padding: keyboardInset > 0 ? "10px 12px 6px" : "10px 12px max(8px, env(safe-area-inset-bottom))",', 'padding: "10px 12px 0",')
segment = segment.replace('minHeight: keyboardInset > 0 ? 58 : 62,', 'minHeight: 58,')
segment = segment.replace('          // Lift entire drawer above the soft keyboard (dynamic inset).\n', '')
s = s[:start] + segment + s[end:]

# Make numeric TikTok URLs direct WebView pages and remove iframe sandbox restrictions that can trigger TikTok server-error rendering.
s = s.replace('          sandbox="allow-scripts allow-same-origin allow-presentation"\n', '')

# Add notification history screen before RemindersScreen.
marker = '/* ============================== REMINDERS ============================== */'
idx = s.find(marker)
if idx < 0:
    raise SystemExit('Reminders marker not found')
notification_component = r'''/* ============================== NOTIFICATION HISTORY ============================== */
function NotificationsScreen({ notifications, back, data }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const [rows, setRows] = useState(Array.isArray(notifications) ? notifications : []);

  useEffect(() => {
    setRows(Array.isArray(notifications) ? notifications : []);
  }, [notifications]);

  const markRead = async (notification) => {
    if (!notification?.id || notification.read) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid, "notifications", notification.id), {
        read: true,
      });
    } catch (e) {
      // The history remains useful even if a read marker fails.
    }
  };

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "الإشعارات" : "Notifications"} onBack={back} />
      <div style={{ padding: "0 18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!rows.length ? (
          <Card style={{ textAlign: "center", padding: 34, color: C.sub }}>
            {ar ? "مفيش إشعارات جديدة دلوقتي." : "No notifications yet."}
          </Card>
        ) : rows.map((n) => {
          const created = new Date(String(n.createdAt || ""));
          const when = Number.isFinite(created.getTime())
            ? created.toLocaleString(ar ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            : "";
          return (
            <Card
              key={n.id}
              onClick={() => markRead(n)}
              style={{
                border: n.read ? `1px solid ${C.border}` : `1px solid ${C.green}`,
                background: n.read ? C.card : C.greenSoft,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>
                    {ar ? (n.titleAr || n.title) : (n.titleEn || n.title)}
                  </div>
                  <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.55, marginTop: 5 }}>
                    {ar ? (n.bodyAr || n.body) : (n.bodyEn || n.body)}
                  </div>
                  <div style={{ color: C.sub2, fontSize: 10.5, marginTop: 8 }}>{when}</div>
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, marginTop: 5, flexShrink: 0 }} />}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

'''
s = s[:idx] + notification_component + s[idx:]

# Route notifications screen before reminders.
route_marker = '  else if (screen === "reminders")'
route_idx = s.find(route_marker)
if route_idx < 0:
    raise SystemExit('reminders route not found')
route_insert = '  else if (screen === "notifications")\n    content = <NotificationsScreen notifications={notifications} data={data} back={back} />;\n'
s = s[:route_idx] + route_insert + s[route_idx:]

# Home bell should open notification history, not reminder settings.
home_start = s.find('function HomeScreen(')
home_end = s.find('function greeting(', home_start)
if home_start < 0 or home_end < 0:
    raise SystemExit('HomeScreen bounds not found')
home = s[home_start:home_end]
old_bell = '<IconBtn onClick={() => go("reminders")}>\n            <Bell size={17} color={C.text} />\n          </IconBtn>'
new_bell = '<IconBtn onClick={() => go("notifications")}>\n            <Bell size={17} color={C.text} />\n          </IconBtn>'
home2 = require_once(home, old_bell, new_bell, 'home bell route')
s = s[:home_start] + home2 + s[home_end:]

# Fix invalid-plan crash: PlanDetail lookup should not assume valid IDs.
needle = 'const plan = PLAN_TEMPLATES[planId];'
if needle in s:
    s = s.replace(needle, 'const plan = PLAN_TEMPLATES[planId] || PLAN_TEMPLATES.beginner;', 1)

# Make profile/paywall Pro state not rely on stale Firestore flags after server verification: already handled by verifiedEntitlementsRef.

path.write_text(s, encoding='utf-8')

# ----------------------------- aiCoach.js -----------------------------
path = Path('src/aiCoach.js')
a = path.read_text(encoding='utf-8')
# The app owns keyboard positioning now; do not register manual keyboard inset listeners here.
a = re.sub(r'export async function ensureNativeKeyboardResize\(\)[\s\S]*?\n\}\n', 'export async function ensureNativeKeyboardResize() {\n  try {\n    const { Keyboard } = await import("@capacitor/keyboard");\n    await Keyboard.setResizeMode?.({ mode: "native" });\n  } catch {}\n}\n', a, count=1)
path.write_text(a, encoding='utf-8')

print('release hardening patch complete')
