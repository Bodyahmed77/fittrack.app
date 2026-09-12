#!/usr/bin/env python3
"""Make web-demo runtime crashes diagnosable instead of an opaque black screen.

This is used only for VITE_WEB_DEMO builds. Production/native ErrorBoundary UX is
unchanged. In demo builds an App crash is rendered with a compact diagnostic marker
so the Pages smoke test fails loudly and can report the real error.
"""
from pathlib import Path
import os
import re

MAIN = Path("src/main.jsx")
MARKER = "FIFTYFIT_WEB_DEMO_ERROR_DIAGNOSTICS_V1"

if os.environ.get("VITE_WEB_DEMO") != "1":
    print("demo error diagnostics skipped (VITE_WEB_DEMO != 1)")
    raise SystemExit(0)

s = MAIN.read_text(encoding="utf-8")
if MARKER in s:
    print("demo error diagnostics already present")
    raise SystemExit(0)

anchor = '    if (this.state.error) {\n      const lang = typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";'
replacement = '''    if (this.state.error) {
      const lang = typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";
      if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {
        const message = String(this.state.error?.message || this.state.error || "Unknown runtime error");
        return (
          <div dir="ltr" data-fiftyfit-demo-runtime-error="1" style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ width: "100%", maxWidth: 620 }}>
              <div style={{ fontWeight: 900, fontSize: 22 }}>Fifty Fit demo runtime error</div>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#ff8a8a", fontSize: 13, lineHeight: 1.55, marginTop: 14 }}>{message}</pre>
            </div>
          </div>
        );
      }'''
if anchor not in s:
    raise SystemExit("demo error diagnostics: ErrorBoundary anchor not found")
s = s.replace(anchor, replacement, 1)
s = f"/* {MARKER} */\n" + s
MAIN.write_text(s, encoding="utf-8")
print("demo error diagnostics patch applied")
