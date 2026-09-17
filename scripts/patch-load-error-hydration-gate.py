from pathlib import Path

APP = Path("src/App.jsx")
OLD = 'if (loadError && !loaded) {'
NEW = 'if (loadError && !loaded && !data?.account?.email) {'

s = APP.read_text(encoding="utf-8")
if NEW in s:
    print("load-error hydration gate already applied")
elif s.count(OLD) != 1:
    raise SystemExit(f"load-error hydration gate: expected exactly 1 target, found {s.count(OLD)}")
else:
    s = s.replace(OLD, NEW, 1)
    APP.write_text(s, encoding="utf-8")
    print("load-error hydration gate applied")
