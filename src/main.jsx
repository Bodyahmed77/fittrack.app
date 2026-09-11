import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Keyboard } from "@capacitor/keyboard";
import logoSrc from "./assets/logo.png";

async function applySystemBarColors(dark = true) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: dark ? "#000000" : "#ffffff" });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    await StatusBar.show();
  } catch (e) {
    console.warn("[SystemBars] status bar config failed", e);
  }
}

function syncDocumentChrome({ dark = true, lang = "en" } = {}) {
  try {
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.fiftyFitTheme = dark ? "dark" : "light";
    window.dispatchEvent(new CustomEvent("fiftyfit-theme-change", { detail: { dark } }));
  } catch (_) {}
}

async function setupKeyboardInsets() {
  try {
    const syncKeyboardFromViewport = () => {
      try {
        const vv = window.visualViewport;
        const inset = vv
          ? Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)))
          : 0;
        document.documentElement.style.setProperty("--ff-keyboard-height", `${inset}px`);
      } catch (_) {}
    };
    const handles = await Promise.all([
      Keyboard.addListener("keyboardWillShow", (info) => {
        const h = Math.max(0, Number(info?.keyboardHeight) || 0);
        document.documentElement.style.setProperty("--ff-keyboard-height", `${h}px`);
      }),
      Keyboard.addListener("keyboardDidShow", (info) => {
        const h = Math.max(0, Number(info?.keyboardHeight) || 0);
        document.documentElement.style.setProperty("--ff-keyboard-height", `${h}px`);
      }),
      Keyboard.addListener("keyboardWillHide", () => {
        document.documentElement.style.setProperty("--ff-keyboard-height", "0px");
      }),
      Keyboard.addListener("keyboardDidHide", () => {
        document.documentElement.style.setProperty("--ff-keyboard-height", "0px");
      }),
    ]);
    window.addEventListener("fiftyfit-theme-change", (event) => {
      syncDocumentChrome({ dark: event?.detail?.dark !== false, lang: document.documentElement.lang || "en" });
    });
    window.addEventListener("fiftyfit-language-change", (event) => {
      const lang = event?.detail?.language === "ar" ? "ar" : "en";
      syncDocumentChrome({ dark: document.documentElement.style.colorScheme !== "light", lang });
    });
    syncKeyboardFromViewport();
    window.visualViewport?.addEventListener("resize", syncKeyboardFromViewport, { passive: true });
    window.visualViewport?.addEventListener("scroll", syncKeyboardFromViewport, { passive: true });
    window.addEventListener("resize", syncKeyboardFromViewport, { passive: true });
    return () => {
      handles.forEach((h) => { try { h?.remove?.(); } catch (_) {} });
    };
  } catch (e) {
    console.warn("[Keyboard] listeners failed", e);
  }
}

setupKeyboardInsets();
applySystemBarColors(true);
syncDocumentChrome({ dark: true, lang: "en" });

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
  handleRetry = () => {
    try { window.location.reload(); } catch (_) {}
  };
  render() {
    if (this.state.error) {
      const lang = typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";
      const errorId = (() => {
        try {
          const raw = String(this.state.error?.message || this.state.error || "error");
          let hash = 0;
          for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
          return `FF-${Math.abs(hash).toString(36).toUpperCase()}`;
        } catch (_) { return "FF-UNKNOWN"; }
      })();
      return (
        <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 28, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
            <img src={logoSrc} alt="Fifty Fit" width={64} height={64} style={{ objectFit: "contain", marginBottom: 16 }} />
            <div style={{ fontWeight: 900, fontSize: 20 }}>{lang === "ar" ? "حصل خطأ غير متوقع" : "Something went wrong"}</div>
            <div style={{ color: "#9a9a9a", fontSize: 13, lineHeight: 1.6, marginTop: 9 }}>{lang === "ar" ? "بياناتك لم يتم حذفها. أعد فتح التطبيق وحاول مرة أخرى." : "Your data was not deleted. Restart the app and try again."}</div>
            <button onClick={this.handleRetry} style={{ marginTop: 20, width: "100%", border: "none", borderRadius: 13, padding: "13px 16px", background: "#fff", color: "#000", fontWeight: 900, fontSize: 14 }}>{lang === "ar" ? "إعادة المحاولة" : "Try again"}</button>
            <div style={{ color: "#555", fontSize: 10.5, marginTop: 12 }}>Error ID: {errorId}</div>
          </div>
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
        <img src={logoSrc} alt="Fifty Fit" width={92} height={92} style={{ display: "block", objectFit: "contain", margin: "0 auto 18px", animation: "fiftyLogoIn 1.15s cubic-bezier(.22,.8,.3,1) both", filter: "drop-shadow(0 0 18px rgba(255,255,255,.18))" }} />
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: .4 }}>Fifty Fit</div>
      </div>
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

try { window.__FIFTYFIT_MARK_BOOT_OK__?.(); } catch (_) {}
