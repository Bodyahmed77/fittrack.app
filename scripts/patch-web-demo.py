#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"
TIKTOK = ROOT / "src" / "tiktokWebView.js"


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_DEMO_V1" in s:
        return
    s = s.replace('import { Keyboard } from "@capacitor/keyboard";\n', 'import { Keyboard } from "@capacitor/keyboard";\nimport { bootstrapDemoSession } from "./demoBootstrap";\n', 1)
    marker = 'setupKeyboardInsets();\n\nconst App = React.lazy(() => import("./App.jsx"));'
    replacement = '''setupKeyboardInsets();\n\n/* FIFTYFIT_WEB_DEMO_V1 */\nconst FIFTYFIT_WEB_DEMO_V1 = typeof window !== "undefined" &&\n  (new URLSearchParams(window.location.search).get("demo") === "1");\nif (FIFTYFIT_WEB_DEMO_V1) {\n  window.__FIFTYFIT_DEMO_MODE__ = true;\n  document.documentElement.classList.add("fiftyfit-web-demo");\n  document.documentElement.style.overflowX = "hidden";\n  if (document.body) {\n    document.body.style.overflowX = "hidden";\n    document.body.style.width = "100%";\n  }\n}\n\nconst App = React.lazy(() => import("./App.jsx"));'''
    if marker not in s:
        raise SystemExit("web-demo: main marker not found")
    s = s.replace(marker, replacement, 1)
    old = '''createRoot(document.getElementById("root")).render(\n  <ErrorBoundary>\n    <StartupGate>\n      <Suspense fallback={<StartupShell />}>\n        <App />\n      </Suspense>\n    </StartupGate>\n  </ErrorBoundary>\n);'''
    new = '''const renderApplication = () => createRoot(document.getElementById("root")).render(\n  <ErrorBoundary>\n    <StartupGate>\n      <Suspense fallback={<StartupShell />}>\n        <App />\n      </Suspense>\n    </StartupGate>\n  </ErrorBoundary>\n);\n\n(FIFTYFIT_WEB_DEMO_V1 ? bootstrapDemoSession().catch((error) => {\n  console.error("[Fifty Fit Demo] automatic demo session failed", error);\n}) : Promise.resolve()).finally(renderApplication);'''
    if old not in s:
        raise SystemExit("web-demo: main render block not found")
    s = s.replace(old, new, 1)
    MAIN.write_text(s, encoding="utf-8")


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_DEMO_APP_V1" in s:
        return
    old_phase = '''    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (!loaded || writePending) return;'''
    new_phase = '''    if (firebaseUser === null) {\n      setPhase("welcome");\n      return;\n    }\n    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__ && loaded) {\n      setPhase("app");\n      return;\n    }\n    if (!loaded || writePending) return;'''
    if old_phase not in s:
        raise SystemExit("web-demo: phase gate not found")
    s = s.replace(old_phase, new_phase, 1)

    old_purchase = '''    setBusy(true);\n    try {\n      // 1) Try real Google Play Billing.'''
    new_purchase = '''    setBusy(true);\n    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {\n      try {\n        const next = clone(data);\n        next.entitlements = { ...(next.entitlements || {}) };\n        if (planId === "training" || planId === "both") next.entitlements.trainingPro = true;\n        if (planId === "nutrition" || planId === "both") next.entitlements.nutritionPro = true;\n        if (planId === "ai") next.entitlements.aiCoachPro = true;\n        const expiry = new Date();\n        expiry.setDate(expiry.getDate() + 30);\n        next.entitlements.proExpiresAt = expiry.toISOString();\n        setData(next);\n        setSuccessModal({ kind: "demo", plan: planId, duration: durationId });\n      } catch (error) {\n        console.error("[Fifty Fit Demo] simulated purchase failed", error);\n        showToast(ar ? "حصل خطأ في تجربة الـDemo" : "Demo action failed");\n      } finally {\n        setBusy(false);\n      }\n      return;\n    }\n    try {\n      // 1) Try real Google Play Billing.'''
    if old_purchase not in s:
        raise SystemExit("web-demo: paywall purchase anchor not found")
    s = s.replace(old_purchase, new_purchase, 1)

    old_reminder = '''  const requestPermission = async () => {\n    try {\n      const perm = await LocalNotifications.requestPermissions();'''
    new_reminder = '''  const requestPermission = async () => {\n    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) return true;\n    try {\n      const perm = await LocalNotifications.requestPermissions();'''
    if old_reminder in s:
        s = s.replace(old_reminder, new_reminder, 1)

    old_test = '''  const sendTest = async () => {\n    setBusy(true);\n    try {\n      const perm = await LocalNotifications.checkPermissions();'''
    new_test = '''  const sendTest = async () => {\n    if (typeof window !== "undefined" && window.__FIFTYFIT_DEMO_MODE__) {\n      showToast(ar ? "الإشعار التجريبي اتجهز للـDemo" : "Demo notification simulated");\n      return;\n    }\n    setBusy(true);\n    try {\n      const perm = await LocalNotifications.checkPermissions();'''
    if old_test in s:
        s = s.replace(old_test, new_test, 1)
    APP.write_text(s, encoding="utf-8")


def patch_tiktok():
    s = TIKTOK.read_text(encoding="utf-8")
    if "FIFTYFIT_WEB_TIKTOK_V1" in s:
        return
    replacement = '''import { registerPlugin, Capacitor } from "@capacitor/core";\n\nconst TikTokWebView = registerPlugin("TikTokWebView");\n\nfunction extractTikTokId(value) {\n  const raw = String(value || "").trim();\n  if (/^\\d{15,}$/.test(raw)) return raw;\n  const match = raw.match(/(?:\\/video\\/|data-video-id=["'])(\\d{15,})/i);\n  return match ? match[1] : null;\n}\n\nfunction ensureOverlay() {\n  let root = document.getElementById("fiftyfit-web-tiktok-overlay");\n  if (root) return root;\n  root = document.createElement("div");\n  root.id = "fiftyfit-web-tiktok-overlay";\n  root.setAttribute("role", "dialog");\n  root.setAttribute("aria-modal", "true");\n  root.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;overscroll-behavior:contain;";\n  document.body.appendChild(root);\n  return root;\n}\n\nexport async function openTikTokWebView(url) {\n  const value = String(url || "").trim();\n  if (!/^https?:\\/\\//i.test(value) && !/^\\d{15,}$/.test(value)) {\n    throw new Error("TikTok WebView requires an http(s) URL or post id");\n  }\n  if (Capacitor.isNativePlatform()) return TikTokWebView.open({ url: value });\n\n  let id = extractTikTokId(value);\n  if (!id && /^https?:\\/\\//i.test(value)) {\n    try {\n      const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(value)}`);\n      if (response.ok) {\n        const data = await response.json();\n        id = extractTikTokId(data?.html || "") || String(data?.video_id || "").match(/\\d{15,}/)?.[0] || null;\n      }\n    } catch (_) {}\n  }\n  if (!id) {\n    window.open(value, "_blank", "noopener,noreferrer");\n    return { external: true };\n  }\n\n  const root = ensureOverlay();\n  root.innerHTML = "";\n  const bar = document.createElement("div");\n  bar.style.cssText = "height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#fff;font:700 14px system-ui,sans-serif;flex:none;";\n  const title = document.createElement("div");\n  title.textContent = "Fifty Fit · Exercise Video";\n  const close = document.createElement("button");\n  close.type = "button";\n  close.textContent = "×";\n  close.setAttribute("aria-label", "Close video");\n  close.style.cssText = "width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:28px;line-height:1;cursor:pointer;";\n  close.onclick = () => root.remove();\n  bar.append(title, close);\n\n  const frameWrap = document.createElement("div");\n  frameWrap.style.cssText = "flex:1;min-height:0;display:flex;justify-content:center;background:#000;overflow:hidden;";\n  const iframe = document.createElement("iframe");\n  iframe.src = `https://www.tiktok.com/player/v1/${id}?autoplay=1&controls=1&description=1&fullscreen_button=1&progress_bar=1&play_button=1&volume_control=1`;\n  iframe.title = "Fifty Fit exercise video";\n  iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";\n  iframe.allowFullscreen = true;\n  iframe.referrerPolicy = "strict-origin-when-cross-origin";\n  iframe.style.cssText = "height:100%;width:min(100%,430px);border:0;background:#000;";\n  frameWrap.appendChild(iframe);\n  root.append(bar, frameWrap);\n\n  const escape = (event) => {\n    if (event.key === "Escape") { root.remove(); document.removeEventListener("keydown", escape); }\n  };\n  document.addEventListener("keydown", escape);\n  return { embedded: true, videoId: id };\n}\n\nexport const FIFTYFIT_WEB_TIKTOK_V1 = true;\n'''
    TIKTOK.write_text(replacement, encoding="utf-8")


def main():
    patch_main()
    patch_app()
    patch_tiktok()
    print("web demo patches applied")

if __name__ == "__main__":
    main()
