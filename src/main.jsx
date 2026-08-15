import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import logoSrc from "./assets/logo.png";
import { Keyboard } from "@capacitor/keyboard";

async function applySystemBarColors() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#000000" });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    console.warn("[SystemBars] status bar color apply failed", e);
  }
}
applySystemBarColors();
setTimeout(applySystemBarColors, 400);
setTimeout(applySystemBarColors, 1200);

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
  // When Android uses adjustResize, innerHeight shrinks with the keyboard and
  // this delta becomes ~0. When the WebView is not resized, visualViewport
  // shrinks while innerHeight stays large, giving us the actual overlay inset.
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  setKeyboardHeight(inset);
}

function keepFocusedFieldVisible() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const el = document.activeElement;
  if (!el || !["INPUT", "TEXTAREA"].includes(el.tagName) && !el.isContentEditable) return;
  const vv = window.visualViewport;
  const visibleBottom = (vv?.height || window.innerHeight) - 14;
  const rect = el.getBoundingClientRect();
  if (rect.bottom > visibleBottom) {
    window.scrollBy({ top: rect.bottom - visibleBottom + 24, behavior: "smooth" });
  }
}

if (typeof window !== "undefined") {
  setKeyboardHeight(0);
  let syncFrame = 0;
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
  document.addEventListener(
    "focusin",
    () => {
      window.setTimeout(scheduleKeyboardSync, 120);
      window.setTimeout(scheduleKeyboardSync, 320);
    },
    true,
  );

  const onNativeShow = () => {
    window.setTimeout(scheduleKeyboardSync, 80);
    window.setTimeout(scheduleKeyboardSync, 250);
  };
  const onNativeHide = () => window.setTimeout(scheduleKeyboardSync, 80);

  Keyboard.addListener("keyboardWillShow", onNativeShow);
  Keyboard.addListener("keyboardDidShow", onNativeShow);
  Keyboard.addListener("keyboardWillHide", onNativeHide);
  Keyboard.addListener("keyboardDidHide", onNativeHide);

  window.setTimeout(scheduleKeyboardSync, 0);
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
        <div
          style={{
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 1.2,
            animation: "fiftyTextIn .85s ease-out .18s both",
          }}
        >
          Fifty Fit
        </div>
        <div
          style={{
            marginTop: 7,
            fontSize: 11,
            color: "#8e8e8e",
            letterSpacing: 0.6,
            animation: "fiftyTextIn .75s ease-out .32s both",
          }}
        >
          TRAIN • EAT • PROGRESS
        </div>
      </div>
      <style>{`
        @keyframes fiftyLogoIn {
          0% { opacity: 0; transform: scale(.72) rotate(-7deg); }
          45% { opacity: 1; transform: scale(1.08) rotate(2deg); }
          72% { transform: scale(.98) rotate(0deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes fiftyTextIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
