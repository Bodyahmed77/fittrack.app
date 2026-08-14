import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { startPublishedPlansUx } from "./publishedPlansUx";
import logoSrc from "./assets/logo.png";
import { Keyboard } from "@capacitor/keyboard";

// Keep Android system bars black (matches app chrome after Cap 7 edge-to-edge margins).
async function applySystemBarColors() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#000000" });
    // Style.Dark => light icons for dark backgrounds
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    console.warn("[SystemBars] status bar color apply failed", e);
  }
}
applySystemBarColors();
setTimeout(applySystemBarColors, 400);
setTimeout(applySystemBarColors, 1200);

// Android keyboard bridge. Do not rely on visualViewport alone: Android
// WebView versions can report stale innerHeight/visualViewport values while
// the IME is open. Capacitor gives the actual keyboard height, so fixed bottom
// sheets can sit directly on the keyboard with no hidden Save/Add controls.
function setKeyboardHeight(height) {
  const px = Math.max(0, Number(height) || 0);
  document.documentElement.style.setProperty("--ff-keyboard-height", `${px}px`);
}

if (typeof window !== "undefined") {
  setKeyboardHeight(0);
  Keyboard.addListener("keyboardWillShow", (event) => {
    setKeyboardHeight(event?.keyboardHeight);
  });
  Keyboard.addListener("keyboardDidShow", (event) => {
    setKeyboardHeight(event?.keyboardHeight);
  });
  Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
  Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
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
        <div
          style={{
            minHeight: "100vh",
            background: "#000",
            color: "#fff",
            padding: 24,
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>
            Something went wrong
          </div>
          {String(this.state.error?.stack || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function StartupShell() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: 24 }}>
        <img
          src={logoSrc}
          alt="Fifty Fit"
          width={72}
          height={72}
          style={{
            display: "block",
            objectFit: "contain",
            margin: "0 auto 14px",
            animation: "fiftyLogoIn .62s cubic-bezier(.22,.8,.3,1) both",
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 18 }}>Fifty</div>
      </div>
      <style>{`@keyframes fiftyLogoIn { 0% { opacity: 0; transform: scale(.9); } 55% { opacity: 1; transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function StartupGate({ children }) {
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumTimeElapsed(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return minimumTimeElapsed ? children : <StartupShell />;
}

startPublishedPlansUx();

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <StartupGate>
      <Suspense fallback={<StartupShell />}>
        <App />
      </Suspense>
    </StartupGate>
  </ErrorBoundary>,
);
