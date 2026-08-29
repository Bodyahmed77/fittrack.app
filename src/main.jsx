import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import logoSrc from "./assets/logo.png";
import { Keyboard } from "@capacitor/keyboard";

async function applySystemBarColors(dark = true) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    // Immersive: hide system status bar (Wi‑Fi, clock, battery) at the top edge.
    await StatusBar.hide();
  } catch (e) {
    console.warn("[SystemBars] status bar config failed", e);
  }
}

function syncDocumentChrome({ dark, lang } = {}) {
  if (typeof document === "undefined") return;
  const isDark = dark !== false;
  const nextLang = lang === "ar" ? "ar" : "en";
  const bg = isDark ? "#000000" : "#ffffff";
  document.documentElement.lang = nextLang;
  document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  document.documentElement.style.backgroundColor = bg;
  if (document.body) {
    document.body.style.backgroundColor = bg;
    document.body.style.color = isDark ? "#ffffff" : "#000000";
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", bg);
}

syncDocumentChrome({ dark: true, lang: "en" });
applySystemBarColors(true);
setTimeout(() => applySystemBarColors(true), 400);
setTimeout(() => applySystemBarColors(true), 1200);
if (typeof window !== "undefined") {
  window.addEventListener("fiftyfit-theme-change", (event) => {
    const dark = event?.detail?.dark !== false;
    applySystemBarColors(dark);
    syncDocumentChrome({ dark, lang: document.documentElement.lang });
  });
  window.addEventListener("fiftyfit-language-change", (event) => {
    const lang = event?.detail?.language === "ar" ? "ar" : "en";
    syncDocumentChrome({ dark: document.documentElement.style.colorScheme !== "light", lang });
  });
}

function setKeyboardHeight(height) {
  const px = Math.max(0, Number(height) || 0);
  document.documentElement.style.setProperty("--ff-keyboard-height", `${px}px`);
}

function syncKeyboardFromViewport() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const vv = window.visualViewport;
  if (!vv) {
    setKeyboardHeight(0);
    return;
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  setKeyboardHeight(inset);
}

async function setupKeyboardInsets() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      syncKeyboardFromViewport();
      window.visualViewport?.addEventListener("resize", syncKeyboardFromViewport);
      window.visualViewport?.addEventListener("scroll", syncKeyboardFromViewport);
      return;
    }
  } catch {
    /* web fallback below */
  }

  let keyboardShowHandle;
  let keyboardHideHandle;
  try {
    keyboardShowHandle = Keyboard.addListener("keyboardDidShow", (info) => {
      setKeyboardHeight(info?.keyboardHeight || 0);
    });
    keyboardHideHandle = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
  } catch (e) {
    console.warn("[Keyboard] listeners failed", e);
  }

  // Always keep a viewport-based fallback for devices that don't emit keyboard events.
  syncKeyboardFromViewport();
  window.visualViewport?.addEventListener("resize", syncKeyboardFromViewport);
  window.visualViewport?.addEventListener("scroll", syncKeyboardFromViewport);

  return () => {
    keyboardShowHandle?.remove?.();
    keyboardHideHandle?.remove?.();
    window.visualViewport?.removeEventListener("resize", syncKeyboardFromViewport);
    window.visualViewport?.removeEventListener("scroll", syncKeyboardFromViewport);
  };
}

setupKeyboardInsets();

const App = React.lazy(() => import("./App.jsx"));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Something went wrong</div>
          {String(this.state.error?.stack || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function StartupShell() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <img
          src={logoSrc}
          alt="Fifty Fit"
          width={92}
          height={92}
          style={{
            display: "block",
            objectFit: "contain",
            margin: "0 auto 18px",
            animation: "fiftyLogoIn 1.15s cubic-bezier(.22,.8,.3,1) both",
            filter: "drop-shadow(0 0 18px rgba(255,255,255,.18))",
          }}
        />
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 1.2, animation: "fiftyTextIn .85s ease-out .18s both" }}>
          Fifty Fit
        </div>
        <div style={{ marginTop: 7, fontSize: 11, color: "#8e8e8e", letterSpacing: 0.6, animation: "fiftyTextIn .75s ease-out .32s both" }}>
          TRAIN • EAT • PROGRESS
        </div>
      </div>
      <style>{`@keyframes fiftyLogoIn{0%{opacity:0;transform:scale(.72) rotate(-7deg)}45%{opacity:1;transform:scale(1.08) rotate(2deg)}72%{transform:scale(.98) rotate(0deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}@keyframes fiftyTextIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function StartupGate({ children }) {
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumTimeElapsed(true), 1600);
    return () => window.clearTimeout(timer);
  }, []);
  return minimumTimeElapsed ? children : <StartupShell />;
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <StartupGate>
      <Suspense fallback={<StartupShell />}>
        <App />
      </Suspense>
    </StartupGate>
  </ErrorBoundary>
);
