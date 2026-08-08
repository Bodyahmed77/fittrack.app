// ============================================================
// Lazy-loading wrapper around Recharts.
//
// Recharts (~528 KB minified) is the single largest third-party
// dependency in the app. It is ONLY needed to render charts on a
// few screens (Home weight card, Exercise progress, Progress, Body
// Weight). It is NOT needed for the Auth/Welcome/Home shell.
//
// By loading it through React.lazy + Suspense, Recharts is split
// into its own chunk and is NOT fetched or parsed during app
// startup. It is fetched only when a chart first renders.
//
// All charts render through the single `ChartCore` component
// (see ./ChartCore.jsx), which is the only module that statically
// imports recharts.
// ============================================================
import React, { Suspense, lazy } from "react";

const ChartCore = lazy(() => import("./ChartCore"));

// Fallback placeholder shown while the chart chunk downloads.
// Keeps the layout stable and never blocks the main thread.
function ChartFallback({ height = 150 }) {
  return (
    <div
      style={{
        width: "100%",
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontSize: 12,
      }}
    >
      Loading chart…
    </div>
  );
}

/**
 * Lazy chart wrapper. Props are passed straight through to ChartCore.
 * Use this anywhere a chart is needed — it guarantees Recharts is
 * only loaded on demand.
 */
export default function LazyChart(props) {
  return (
    <Suspense fallback={<ChartFallback height={props.height || 150} />}>
      <ChartCore {...props} />
    </Suspense>
  );
}
