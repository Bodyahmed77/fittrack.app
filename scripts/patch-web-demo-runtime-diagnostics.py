#!/usr/bin/env python3
"""Demo-only runtime crash diagnostics.

Runs only for VITE_WEB_DEMO=1. It instruments the real app entry/ErrorBoundary
so the deployed demo exposes the raw React exception, stack, and component
stack in data-* attributes for CI diagnostics. Native Android source behavior
is unchanged.
"""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
MARKER = "FIFTYFIT_WEB_DEMO_RUNTIME_DIAGNOSTICS_V3"

if os.environ.get("VITE_WEB_DEMO") != "1":
    raise SystemExit(0)


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    # The actual ErrorBoundary lives in main.jsx. Keep the diagnostic guard
    # based on the build constant/query instead of a late runtime flag.
    anchor = 'async function applySystemBarColors(dark = true) {'
    if anchor not in s:
        raise SystemExit("runtime diagnostics: main anchor not found")

    block = f'''/* {MARKER} */
if (typeof window !== "undefined" && (import.meta.env?.VITE_WEB_DEMO === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"))) {{
  window.__FIFTYFIT_DEMO_RUNTIME_ERRORS__ = window.__FIFTYFIT_DEMO_RUNTIME_ERRORS__ || [];
  const __ffDemoRecordRuntimeError = (type, error, stack = "") => {{
    try {{
      const message = String(error?.message || error || "Unknown runtime error");
      const normalizedStack = String(stack || error?.stack || "");
      const payload = {{ type, message, stack: normalizedStack.slice(0, 12000) }};
      window.__FIFTYFIT_DEMO_RUNTIME_ERRORS__.push(payload);
      const html = document.documentElement;
      html.dataset.fiftyfitDemoRuntimeError = message.slice(0, 1500);
      html.dataset.fiftyfitDemoRuntimeStack = normalizedStack.slice(0, 5000);
    }} catch (_) {{}}
  }};
  window.addEventListener("error", (event) => __ffDemoRecordRuntimeError("window.error", event?.error || event?.message, event?.error?.stack));
  window.addEventListener("unhandledrejection", (event) => __ffDemoRecordRuntimeError("unhandledrejection", event?.reason, event?.reason?.stack));
}}

'''
    s = s.replace(anchor, block + anchor, 1)

    get_derived = '''  static getDerivedStateFromError(error) {
    return { error };
  }'''
    get_derived_repl = f'''  static getDerivedStateFromError(error) {{
    try {{
      if (typeof document !== "undefined" && (import.meta.env?.VITE_WEB_DEMO === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"))) {{
        const html = document.documentElement;
        html.dataset.fiftyfitDemoRuntimeError = String(error?.message || error || "Unknown runtime error").slice(0, 1500);
        html.dataset.fiftyfitDemoRuntimeStack = String(error?.stack || "").slice(0, 5000);
      }}
    }} catch (_) {{}}
    return {{ error }};
  }}'''
    if get_derived not in s:
        raise SystemExit("runtime diagnostics: ErrorBoundary getDerivedStateFromError anchor not found")
    s = s.replace(get_derived, get_derived_repl, 1)

    did_catch = '''  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }'''
    did_catch_repl = '''  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
    try {
      if (typeof document !== "undefined" && (import.meta.env?.VITE_WEB_DEMO === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"))) {
        const html = document.documentElement;
        html.dataset.fiftyfitDemoRuntimeError = String(error?.message || error || "Unknown runtime error").slice(0, 1500);
        html.dataset.fiftyfitDemoRuntimeStack = String(error?.stack || "").slice(0, 5000);
        html.dataset.fiftyfitDemoComponentStack = String(info?.componentStack || "").slice(0, 5000);
      }
    } catch (_) {}
  }'''
    if did_catch not in s:
        raise SystemExit("runtime diagnostics: ErrorBoundary componentDidCatch anchor not found")
    s = s.replace(did_catch, did_catch_repl, 1)

    MAIN.write_text(s, encoding="utf-8")


patch_main()
print("web-demo runtime diagnostics v3 applied")
