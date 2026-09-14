#!/usr/bin/env python3
"""Final build-time compatibility fixes for browser demo shims."""
from pathlib import Path

p = Path("src/.web-demo/billing.js")
if not p.exists():
    raise SystemExit(f"missing {p}; patch-web-demo.py must run first")
s = p.read_text(encoding="utf-8")
if "export function productIdFor" not in s:
    s += '''
// Canonical App.jsx imports this helper for purchase registration.
// Web demo never starts Google Play Billing, so only a deterministic string
// is needed to keep the shared purchase wiring importable.
export function productIdFor(planId, durationId) {
  const plan = typeof planId === "string" ? planId : "plan";
  const duration = typeof durationId === "string" ? durationId : "duration";
  return `${plan}_${duration}`;
}
'''
    p.write_text(s, encoding="utf-8")
print("web demo billing shim export verified")
