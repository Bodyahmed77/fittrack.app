import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";

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

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Suspense fallback={<StartupShell />}>
      <App />
    </Suspense>
  </ErrorBoundary>,
);
