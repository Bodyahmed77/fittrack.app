import React, { useEffect, useState } from "react";

// Recharts is intentionally loaded only after the application shell has rendered.
// This prevents the ~500 KB chart library from blocking Android startup.
let rechartsPromise;
function loadRecharts() {
  if (!rechartsPromise) {
    rechartsPromise = import("recharts");
  }
  return rechartsPromise;
}

function lazyRechartsComponent(name) {
  return function LazyRechartsComponent(props) {
    const [Component, setComponent] = useState(null);

    useEffect(() => {
      let active = true;
      loadRecharts()
        .then((mod) => {
          if (active && mod?.[name]) setComponent(() => mod[name]);
        })
        .catch((error) => {
          console.error(`Failed to load Recharts component: ${name}`, error);
        });
      return () => {
        active = false;
      };
    }, []);

    if (!Component) return null;

    const { children, ...rest } = props;
    return React.createElement(Component, rest, children);
  };
}

// Android WebView can intermittently fail to render Recharts' SVG when the
// chart and ResponsiveContainer are both waiting on a lazy-loaded chunk.
// Keep the large Recharts dependency lazy, but render simple LineChart graphs
// with a tiny dependency-free SVG implementation. This is especially important
// for the Body Weight screen: the data is already present, so the chart must not
// disappear just because the secondary chart chunk did not initialize in time.
function SafeLineChart({ data = [], children, margin = {} }) {
  const width = 600;
  const height = 220;
  const pad = {
    top: Math.max(8, margin.top || 8),
    right: Math.max(12, margin.right || 12),
    bottom: Math.max(26, margin.bottom || 26),
    left: Math.max(42, Math.abs(margin.left || 0) + 42),
  };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);

  const lineChild = React.Children.toArray(children).find(
    (child) => child?.props?.dataKey,
  );
  const dataKey = lineChild?.props?.dataKey || "kg";
  const stroke = lineChild?.props?.stroke || "currentColor";
  const strokeWidth = Number(lineChild?.props?.strokeWidth) || 2.5;

  const values = data
    .map((item) => Number(item?.[dataKey]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const yMin = Math.max(0, minValue - Math.max(2, range * 0.15));
  const yMax = maxValue + Math.max(2, range * 0.15);
  const yRange = Math.max(1, yMax - yMin);

  const points = data
    .map((item, index) => {
      const value = Number(item?.[dataKey]);
      if (!Number.isFinite(value)) return null;
      const x =
        pad.left +
        (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
      const y = pad.top + ((yMax - value) / yRange) * innerH;
      return { x, y, value, item };
    })
    .filter(Boolean);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  const gridRows = 4;
  const grid = Array.from({ length: gridRows + 1 }, (_, index) => {
    const ratio = index / gridRows;
    const y = pad.top + ratio * innerH;
    const value = yMax - ratio * yRange;
    return { y, value };
  });

  const labels = points.map((point) =>
    String(point.item?.date ?? "").slice(0, 10),
  );

  return (
    <div style={{ width: "100%", height: "100%", minWidth: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label="Line chart"
        style={{ display: "block", overflow: "visible" }}
      >
        {grid.map((row, index) => (
          <g key={`grid-${index}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={row.y}
              y2={row.y}
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="3 3"
            />
            <text
              x={pad.left - 6}
              y={row.y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
              fontSize="10"
            >
              {Number(row.value).toFixed(0)}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) => (
          <circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={stroke}
            stroke="rgba(0,0,0,1)"
            strokeWidth="2"
          />
        ))}

        {points.map((point, index) => {
          const label = labels[index];
          if (!label) return null;
          return (
            <text
              key={`label-${index}`}
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              fill="rgba(255,255,255,0.45)"
              fontSize="10"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Unlike Recharts' ResponsiveContainer, this wrapper has no async dependency.
// It gives its child a real layout box immediately inside Android WebView.
function SafeResponsiveContainer({ width = "100%", height = "100%", children }) {
  const styleWidth = width === "100%" ? "100%" : width;
  const styleHeight = height === "100%" ? "100%" : height;
  return (
    <div
      style={{
        width: styleWidth,
        height: styleHeight,
        minWidth: 0,
        minHeight: 0,
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

export const LineChart = SafeLineChart;
export const ResponsiveContainer = SafeResponsiveContainer;

// Other chart types continue to use lazy Recharts because they are not needed
// for the critical Body Weight rendering path.
export const Line = lazyRechartsComponent("Line");
export const AreaChart = lazyRechartsComponent("AreaChart");
export const Area = lazyRechartsComponent("Area");
export const XAxis = lazyRechartsComponent("XAxis");
export const YAxis = lazyRechartsComponent("YAxis");
export const CartesianGrid = lazyRechartsComponent("CartesianGrid");
export const Tooltip = lazyRechartsComponent("Tooltip");
