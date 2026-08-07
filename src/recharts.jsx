import React, {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
} from "react";

// Recharts is loaded lazily so the chart library does not block Android startup.
// The Android WebView-safe ResponsiveContainer below intentionally does NOT use
// Recharts' own ResizeObserver container. It measures the real parent element
// and passes explicit pixel dimensions to the chart. This avoids the common
// WebView case where ResponsiveContainer renders an empty SVG because its
// observer never reports a non-zero size.
let rechartsPromise;
function loadRecharts() {
  if (!rechartsPromise) rechartsPromise = import("recharts");
  return rechartsPromise;
}

function FallbackChart({
  data = [],
  dataKey = "kg",
  width = "100%",
  height = "100%",
}) {
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
      const y = 88 - ((value - min) / range) * 70;
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
      {points.map((point, index) => {
        const [cx, cy] = point.split(",");
        return (
          <circle
            key={`${point}-${index}`}
            cx={cx}
            cy={cy}
            r="2.2"
            fill="currentColor"
          />
        );
      })}
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

    if (failed && (name === "LineChart" || name === "AreaChart")) {
      return <FallbackChart {...props} />;
    }

    // Child primitives (Line, Axis, Tooltip, etc.) cannot render usefully
    // without the chart library, so fail silently rather than crashing the app.
    return null;
  };
}

// WebView-safe replacement for Recharts ResponsiveContainer.
// It always gives the child chart explicit pixel dimensions.
function AndroidSafeResponsiveContainer({
  children,
  width = "100%",
  height = "100%",
  minWidth = 0,
  minHeight = 0,
  style,
  ...rest
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [host, setHost] = useState(null);

  useEffect(() => {
    if (!host) return undefined;

    let frame = 0;
    let timer = 0;
    let active = true;

    const measure = () => {
      if (!active || !host) return;
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.round(rect.width));
      const nextHeight = Math.max(0, Math.round(rect.height));
      if (nextWidth && nextHeight) {
        setSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      }
    };

    // Measure immediately and again on the next frames. This covers WebViews
    // that finish layout after React's first effect has already run.
    measure();
    frame = requestAnimationFrame(measure);
    timer = window.setTimeout(measure, 250);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(host);
    }

    window.addEventListener("resize", measure);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [host]);

  const child = isValidElement(children) ? children : null;
  const childWithSize =
    child && size.width > 0 && size.height > 0
      ? cloneElement(child, {
          width: size.width,
          height: size.height,
        })
      : null;

  return (
    <div
      ref={setHost}
      {...rest}
      style={{
        width,
        height,
        minWidth,
        minHeight,
        position: "relative",
        overflow: "visible",
        ...style,
      }}
    >
      {childWithSize}
    </div>
  );
}

export const LineChart = lazyRechartsComponent("LineChart");
export const Line = lazyRechartsComponent("Line");
export const AreaChart = lazyRechartsComponent("AreaChart");
export const Area = lazyRechartsComponent("Area");
export const XAxis = lazyRechartsComponent("XAxis");
export const YAxis = lazyRechartsComponent("YAxis");
export const CartesianGrid = lazyRechartsComponent("CartesianGrid");
export const Tooltip = lazyRechartsComponent("Tooltip");
export const ResponsiveContainer = AndroidSafeResponsiveContainer;
