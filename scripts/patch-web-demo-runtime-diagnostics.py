#!/usr/bin/env python3
"""Demo-only runtime diagnostics.

This does not change the native Android build. In web-demo builds it exposes the
raw React error + component stack on <html> so CI can identify the real runtime
crash instead of only seeing the hashed FF-* error id.
"""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
APP = ROOT / "src" / "App.jsx"
MARKER = "FIFTYFIT_WEB_DEMO_RUNTIME_DIAGNOSTICS_V1"

if os.environ.get("VITE_WEB_DEMO") != "1":
    raise SystemExit(0)


def esc_js(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\"", "\\\"")


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    anchor = 'async function applySystemBarColors(dark = true) {'
    if anchor not in s:
        raise SystemExit("runtime diagnostics: main anchor not found")

    block = '''/* FIFTYFIT_WEB_DEMO_RUNTIME_DIAGNOSTICS_V1 */
if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
  window.__FIFTYFIT_DEMO_RUNTIME_ERRORS__ = [];
  const recordDemoRuntimeError = (type, error, stack = "") => {
    try {
      const message = String(error?.message || error || "Unknown runtime error");
      const normalizedStack = String(stack || error?.stack || "");
      const payload = { type, message, stack: normalizedStack.slice(0, 12000) };
      window.__FIFTYFIT_DEMO_RUNTIME_ERRORS__.push(payload);
      const html = document.documentElement;
      html.dataset.fiftyfitDemoRuntimeError = message.slice(0, 1500);
      html.dataset.fiftyfitDemoRuntimeStack = normalizedStack.slice(0, 5000);
    } catch (_) {}
  };
  window.addEventListener("error", (event) => recordDemoRuntimeError("window.error", event?.error || event?.message, event?.error?.stack));
  window.addEventListener("unhandledrejection", (event) => recordDemoRuntimeError("unhandledrejection", event?.reason, event?.reason?.stack));
}

'''
    s = s.replace(anchor, block + anchor, 1)
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    anchor = '  static getDerivedStateFromError(error) {\n    return { error };\n  }'
    replacement = '''  static getDerivedStateFromError(error) {
    try {
      if (typeof document !== "undefined" && window?.__FIFTYFIT_DEMO_MODE__) {
        const html = document.documentElement;
        html.dataset.fiftyfitDemoRuntimeError = String(error?.message || error || "Unknown runtime error").slice(0, 1500);
        html.dataset.fiftyfitDemoRuntimeStack = String(error?.stack || "").slice(0, 5000);
      }
    } catch (_) {}
    return { error };
  }'''
    if anchor not in s:
        raise SystemExit("runtime diagnostics: ErrorBoundary anchor not found")
    s = s.replace(anchor, replacement, 1)

    anchor2 = '  componentDidCatch(error, info) {\n    console.error("App crashed:", error, info);\n  }'
    replacement2 = '''  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
    try {
      if (typeof document !== "undefined" && window?.__FIFTYFIT_DEMO_MODE__) {
        const html = document.documentElement;
        html.dataset.fiftyfitDemoRuntimeError = String(error?.message || error || "Unknown runtime error").slice(0, 1500);
        html.dataset.fiftyfitDemoRuntimeStack = String(error?.stack || "").slice(0, 5000);
        html.dataset.fiftyfitDemoComponentStack = String(info?.componentStack || "").slice(0, 5000);
      }
    } catch (_) {}
  }'''
    if anchor2 not in s:
        raise SystemExit("runtime diagnostics: componentDidCatch anchor not found")
    s = s.replace(anchor2, replacement2, 1)
    APP.write_text(s, encoding="utf-8")


patch_main()
patch_app()
print("web-demo runtime diagnostics applied")
