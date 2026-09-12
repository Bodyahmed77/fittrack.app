#!/usr/bin/env python3
"""Add a deterministic marker after the React root is mounted in demo builds."""
from pathlib import Path

MAIN = Path("src/main.jsx")
MARKER = "FIFTYFIT_WEB_DEMO_MOUNTED_MARKER_V1"

s = MAIN.read_text(encoding="utf-8")
if MARKER in s:
    print("web demo mounted marker already present")
    raise SystemExit(0)

old = '''createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <StartupGate>
      <Suspense fallback={<StartupShell />}>
        <App />
      </Suspense>
    </StartupGate>
  </ErrorBoundary>
);'''
new = '''const fiftyFitRoot = createRoot(document.getElementById("root"));
fiftyFitRoot.render(
  <ErrorBoundary>
    <StartupGate>
      <Suspense fallback={<StartupShell />}>
        <App />
      </Suspense>
    </StartupGate>
  </ErrorBoundary>
);
try {
  document.documentElement.setAttribute("data-fiftyfit-demo-mounted", "1");
} catch (_) {}\n/* FIFTYFIT_WEB_DEMO_MOUNTED_MARKER_V1 */'''
if old not in s:
    raise SystemExit("web demo mounted marker: render root anchor not found")
s = s.replace(old, new, 1)
MAIN.write_text(s, encoding="utf-8")
print("web demo mounted marker applied")
