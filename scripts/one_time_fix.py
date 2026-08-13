from pathlib import Path
import re

p = Path('src/App.jsx')
s = p.read_text()

# Remove the legacy TikTok player prefetch. Direct TikTok web URLs should be
# loaded only by the existing full-screen iframe viewer.
s2, n = re.subn(
    r'  useEffect\(\(\) => \{\n    if \(!videoId \|\| typeof document === "undefined"\) return undefined;.*?  \}, \[videoId\]\);\n  const close = useCallback',
    '  const close = useCallback',
    s,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit('VideoPlayer prefetch block not found')
s = s2

# Replace the DOM-injected published-plan card with a native React card in Plans.
marker = '      <TopBar title={ar ? "الخطط" : "Plans"} />\n      <div style={{ padding: "0 18px 4px", color: C.sub, fontSize: 12.5 }}>'
insert = '''      <TopBar title={ar ? "الخطط" : "Plans"} />
      {data.customNutritionPlan && data.entitlements.nutritionPro && (
        <div style={{ padding: "0 18px 10px" }}>
          <Card
            onClick={() => go("nutritionPlan")}
            style={{
              background: C.greenSoft,
              border: `1.5px solid ${C.green}66`,
              cursor: "pointer",
            }}
          >
            <div style={{ color: C.sub, fontSize: 10, fontWeight: 900, letterSpacing: 0.6 }}>
              {ar ? "خطة مخصصة" : "PERSONALIZED PLAN"}
            </div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 900, marginTop: 4 }}>
              🍽️ {ar ? (data.customNutritionPlan.titleAr || "خطتك الغذائية") : (data.customNutritionPlan.title || "Your Nutrition Plan")}
            </div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 4 }}>
              {ar ? `تبدأ ${data.customNutritionPlan.startDate || dateKey(0)}` : `Starts ${data.customNutritionPlan.startDate || dateKey(0)}`}
            </div>
            <div style={{ color: C.text, fontSize: 11.5, fontWeight: 800, marginTop: 9 }}>
              {ar ? "فتح خطة التغذية ←" : "Open Nutrition Plan →"}
            </div>
          </Card>
        </div>
      )}
      <div style={{ padding: "0 18px 4px", color: C.sub, fontSize: 12.5 }}>'''
if marker not in s:
    raise SystemExit('Plans marker not found')
s = s.replace(marker, insert, 1)

# Make notification taps navigate to their target after marking them read.
s = s.replace('function NotificationsScreen({ back }) {', 'function NotificationsScreen({ back, onOpen }) {', 1)
old = '''  const markRead = async (notification) => {
    if (!notification?.id || notification.read || !auth.currentUser?.uid) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid, "notifications", notification.id), { read: true });
    } catch {}
  };'''
new = '''  const markRead = async (notification) => {
    if (!notification?.id || notification.read || !auth.currentUser?.uid) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid, "notifications", notification.id), { read: true });
    } catch {}
  };

  const openNotification = async (notification) => {
    await markRead(notification);
    const target = notification?.route?.screen || notification?.screen;
    const targetParams = notification?.route?.params || notification?.params || {};
    if (target) { onOpen?.(target, targetParams); return; }
    if (notification?.type === "nutrition_plan_ready") { onOpen?.("nutritionPlan", {}); return; }
    if (notification?.type === "training_plan_ready") { onOpen?.("workout", {}); return; }
    if (notification?.type === "subscription") { onOpen?.("paywall", {}); }
  };'''
if old not in s:
    raise SystemExit('Notification markRead block not found')
s = s.replace(old, new, 1)
if 'onClick={() => markRead(n)}' not in s:
    raise SystemExit('Notification click handler not found')
s = s.replace('onClick={() => markRead(n)}', 'onClick={() => openNotification(n)}', 1)
if 'content = <NotificationsScreen back={back} />;' not in s:
    raise SystemExit('Notifications screen mount not found')
s = s.replace(
    'content = <NotificationsScreen back={back} />;',
    'content = <NotificationsScreen back={back} onOpen={(target, targetParams) => go(target, targetParams)} />;',
    1,
)

p.write_text(s)
