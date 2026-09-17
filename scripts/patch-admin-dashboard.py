from pathlib import Path
import re

APP = Path("src/App.jsx")
MARKER = "FIFTYFIT_ADMIN_DASHBOARD_V1"

s = APP.read_text(encoding="utf-8")

if MARKER not in s:
    lazy_anchor = 'import React, {'
    if 'const AdminDashboardLazy = React.lazy(() => import("./AdminDashboard"));' not in s:
        m = re.search(r'^import React, \{[^\n]+\};\n', s, re.M)
        if not m:
            raise SystemExit("admin dashboard: React import anchor not found")
        s = s[:m.end()] + 'const AdminDashboardLazy = React.lazy(() => import("./AdminDashboard"));\n' + s[m.end():]

    start = s.find('function AdminScreen({ back, showToast }) {')
    end = s.find('/* ============================== APP ROOT ============================== */')
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("admin dashboard: AdminScreen block anchors not found")

    wrapper = '''function AdminScreen({ back, showToast }) {
  const { C, lang } = useUI();
  return (
    <React.Suspense
      fallback={
        <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: C.sub }}>
          {lang === "ar" ? "جاري تحميل لوحة الإدارة…" : "Loading admin console…"}
        </div>
      }
    >
      <AdminDashboardLazy C={C} lang={lang} back={back} showToast={showToast} />
    </React.Suspense>
  );
}

'''
    s = s[:start] + wrapper + s[end:]
    s = f"/* {MARKER} */\n" + s

APP.write_text(s, encoding="utf-8")
print("admin dashboard integration applied")
