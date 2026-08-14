import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { startPublishedPlansUx } from "./publishedPlansUx";


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
// Splash / Cap bridge can overwrite bar style once; re-apply after settle.
applySystemBarColors();
setTimeout(applySystemBarColors, 400);
setTimeout(applySystemBarColors, 1200);

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
        <div
          style={{
            width: 42,
            height: 42,
            margin: "0 auto 14px",
            border: "3px solid rgba(255,255,255,.18)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin .8s linear infinite",
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 18 }}>Fifty</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

startPublishedPlansUx();

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Suspense fallback={<StartupShell />}>
      <App />
    </Suspense>
  </ErrorBoundary>,
);
