#!/usr/bin/env python3
"""Ensure full-bleed safe-area chrome in src/App.jsx (TopBar + AI Coach).

Idempotent. Run from repo root before Vite build if needed.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"


def main() -> None:
    if not APP.is_file():
        raise SystemExit(f"missing {APP}")
    src = APP.read_text(encoding="utf-8")
    original = src

    replacements = [
        (
            '''function TopBar({ title, onBack, right }) {
  const { C } = useUI();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 18px 14px",
      }}
    >''',
            '''function TopBar({ title, onBack, right }) {
  const { C } = useUI();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        // Full-bleed under status bar / notch; pad content only.
        padding: "calc(14px + env(safe-area-inset-top, 0px)) 18px 14px",
        background: C.bg,
        boxSizing: "border-box",
      }}
    >''',
        ),
        (
            '''        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px 10px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >''',
            '''        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px 10px",
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >''',
        ),
        (
            '''        <div
          ref={inputBarRef}
          style={{
            display: "flex",
            gap: 8,
            // Panel bottom already accounts for keyboardInset; keep safe-area only.
            padding: "10px 12px 0",
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            flexShrink: 0,
            minHeight: 58,
          }}
        >''',
            '''        <div
          ref={inputBarRef}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            // Keyboard open: no extra bottom inset (avoids gray strip above IME).
            // Keyboard closed: keep home-indicator padding on the same black bg.
            padding: keyboardInset > 0
              ? "10px 12px 10px"
              : "10px 12px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            flexShrink: 0,
            minHeight: 58,
            boxSizing: "border-box",
          }}
        >''',
        ),
    ]

    applied = 0
    for old, new in replacements:
        if old in src:
            src = src.replace(old, new, 1)
            applied += 1
        elif new[:80] in src:
            # already patched
            applied += 1
        else:
            print(f"WARN: pattern not found ({old[:60]!r}...)")

    if src != original:
        APP.write_text(src, encoding="utf-8")
        print(f"patch-fullscreen-ui: wrote {APP} ({applied} patterns)")
    else:
        print(f"patch-fullscreen-ui: already up to date ({applied} patterns matched)")


if __name__ == "__main__":
    main()
