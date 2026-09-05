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
    await StatusBar.setBackgroundColor({ color: dark ? "#000000" : "#ffffff" });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
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
  document.documentElement.style.minHeight = "100%";
  if (document.body) {
    document.body.style.backgroundColor = bg;
    document.body.style.color = isDark ? "#ffffff" : "#000000";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100%";
  }
  const root = document.getElementById("root");
  if (root) {
    root.style.minHeight = "100vh";
    root.style.minHeight = "100dvh";
    root.style.backgroundColor = bg;
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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const dark = document.documentElement.style.colorScheme !== "light";
      applySystemBarColors(dark);
    }
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
  handleRetry = () => {
    try {
      window.location.reload();
    } catch (_) {}
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
        } catch (_) {
          return "FF-UNKNOWN";
        }
      })();
      return (
        <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 28, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
            <img src={logoSrc} alt="Fifty Fit" width={64} height={64} style={{ objectFit: "contain", marginBottom: 16 }} />
            <div style={{ fontWeight: 900, fontSize: 20 }}>{lang === "ar" ? "حصل خطأ غير متوقع" : "Something went wrong"}</div>
            <div style={{ color: "#9a9a9a", fontSize: 13, lineHeight: 1.6, marginTop: 9 }}>
              {lang === "ar" ? "بياناتك لم يتم حذفها. أعد فتح التطبيق وحاول مرة أخرى." : "Your data was not deleted. Restart the app and try again."}
            </div>
            <button onClick={this.handleRetry} style={{ marginTop: 20, width: "100%", border: "none", borderRadius: 13, padding: "13px 16px", background: "#fff", color: "#000", fontWeight: 900, fontSize: 14 }}>
              {lang === "ar" ? "إعادة المحاولة" : "Try again"}
            </button>
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
