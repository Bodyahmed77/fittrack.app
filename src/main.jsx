import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import logoSrc from "./assets/logo.png";
import { Keyboard } from "@capacitor/keyboard";

async function applySystemBarColors(dark = true) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // The native activity keeps system bars hidden by default. Overlaying the
    // webview lets transient bars reveal the actual app background instead of
    // a platform-generated gray strip.
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
  } catch (e) {
    console.warn("[SystemBars] status bar config failed", e);
  }
}

applySystemBarColors(true);
setTimeout(() => applySystemBarColors(true), 400);
setTimeout(() => applySystemBarColors(true), 1200);
if (typeof window !== "undefined") {
  window.addEventListener("fiftyfit-theme-change", (event) => {
    applySystemBarColors(event?.detail?.dark !== false);
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

function keepFocusedFieldVisible() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const el = document.activeElement;
  if (
    !el ||
    (!["INPUT", "TEXTAREA"].includes(el.tagName) && !el.isContentEditable)
  )
    return;

  const vv = window.visualViewport;
  const visibleBottom = (vv?.height || window.innerHeight) - 16;
  const rect = el.getBoundingClientRect();

  if (rect.bottom > visibleBottom) {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }
}

if (typeof window !== "undefined") {
  setKeyboardHeight(0);
  let syncFrame = 0;
  let focusTimer = 0;

  const scheduleKeyboardSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      syncKeyboardFromViewport();
      keepFocusedFieldVisible();
    });
  };

  window.addEventListener("resize", scheduleKeyboardSync, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleKeyboardSync, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleKeyboardSync, { passive: true });

  const onFocusIn = () => {
    window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(scheduleKeyboardSync, 180);
  };
  document.addEventListener("focusin", onFocusIn, true);

  let keyboardShowHandle;
  let keyboardHideHandle;
  try {
    keyboardShowHandle = Keyboard.addListener("keyboardDidShow", scheduleKeyboardSync);
    keyboardHideHandle = Keyboard.addListener("keyboardDidHide", () => {
      window.setTimeout(scheduleKeyboardSync, 60);
    });
  } catch (e) {
    console.warn("[Keyboard] native listener registration failed", e);
  }

  window.setTimeout(scheduleKeyboardSync, 0);

  window.addEventListener("beforeunload", () => {
    window.clearTimeout(focusTimer);
    cancelAnimationFrame(syncFrame);
    keyboardShowHandle?.remove?.();
    keyboardHideHandle?.remove?.();
  }, { once: true });
}

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
  </ErrorBoundary>,
);
