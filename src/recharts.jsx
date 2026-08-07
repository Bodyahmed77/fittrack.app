import React, { useEffect, useMemo, useState } from "react";

// Recharts is loaded lazily so the chart library does not block Android startup.
// If the WebView cannot load the split Recharts chunk, chart containers fall
// back to a lightweight SVG renderer instead of disappearing completely.
let rechartsPromise;
function loadRecharts() {
  if (!rechartsPromise) rechartsPromise = import("recharts");
  return rechartsPromise;
}

function FallbackChart({ data = [], dataKey = "kg", width = "100%", height = "100%" }) {
  const points = useMemo(() => {
    const values = data
      .map((item) => Number(item?.[dataKey]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 92 - ((value - min) / range) * 76;
      return `${x},${y}`;
    });
  }, [data, dataKey]);

  if (!points.length) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
      aria-label="weight chart"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function lazyRechartsComponent(name) {
  return function LazyRechartsComponent(props) {
    const [Component, setComponent] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      let active = true;
      loadRecharts()
        .then((mod) => {
          if (!active) return;
          if (mod?.[name]) setComponent(() => mod[name]);
          else setFailed(true);
        })
        .catch((error) => {
          console.error(`Failed to load Recharts component: ${name}`, error);
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, []);

    if (Component) {
      const { children, ...rest } = props;
      return React.createElement(Component, rest, children);
    }

    if (failed && name === "ResponsiveContainer") {
      const { children, width = "100%", height = "100%", style, ...rest } = props;
      return (
        <div
          {...rest}
          style={{
            width,
            height,
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            ...style,
          }}
        >
          {children}
        </div>
      );
    }

    if (failed && (name === "LineChart" || name === "AreaChart")) {
      return <FallbackChart {...props} />;
    }

    return null;
  };
}

export const LineChart = lazyRechartsComponent("LineChart");
export const Line = lazyRechartsComponent("Line");
export const AreaChart = lazyRechartsComponent("AreaChart");
export const Area = lazyRechartsComponent("Area");
export const XAxis = lazyRechartsComponent("XAxis");
export const YAxis = lazyRechartsComponent("YAxis");
export const CartesianGrid = lazyRechartsComponent("CartesianGrid");
export const Tooltip = lazyRechartsComponent("Tooltip");
export const ResponsiveContainer = lazyRechartsComponent("ResponsiveContainer");
