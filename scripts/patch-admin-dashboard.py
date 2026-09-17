from pathlib import Path

APP = Path("src/App.jsx")
MARKER = "FIFTYFIT_ADMIN_DASHBOARD_V1"
LAZY_IMPORT = 'const AdminDashboardLazy = React.lazy(() => import("./AdminDashboard"));\n'

s = APP.read_text(encoding="utf-8")

if MARKER not in s:
    if LAZY_IMPORT not in s:
        # App.jsx uses a multiline React import. Insert the lazy module immediately
        # before the stable lucide import rather than depending on import formatting.
        anchor = 'import {\n  Home as HomeIcon,'
        if anchor not in s:
            raise SystemExit("admin dashboard: lucide import anchor not found")
        s = s.replace(anchor, LAZY_IMPORT + anchor, 1)

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
