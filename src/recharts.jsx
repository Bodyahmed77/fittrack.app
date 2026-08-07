import React, { useEffect, useRef, useState } from "react";

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

// Android WebView can occasionally report a zero/unstable percentage size to
// Recharts' ResponsiveContainer during the first layout pass. Keep the real
// Recharts renderer and all of its styling/interaction intact, but measure the
// actual DOM box ourselves and pass explicit pixel dimensions to the chart.
// This avoids changing the chart implementation or visual quality.
function AndroidSafeResponsiveContainer({ width = "100%", height = "100%", children, ...rest }) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let frame = 0;
    let retryTimer = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.floor(rect.width));
        const nextHeight = Math.max(1, Math.floor(rect.height));
        setSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      });
    };

    measure();
    retryTimer = window.setTimeout(measure, 80);
    const lateRetryTimer = window.setTimeout(measure, 300);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(host);
    }

    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      window.clearTimeout(lateRetryTimer);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const child = React.Children.toArray(children).find(Boolean);
  const explicitWidth = typeof width === "number" ? width : size.width;
  const explicitHeight = typeof height === "number" ? height : size.height;

  return (
    <div
      ref={hostRef}
      style={{
        width: width === "100%" ? "100%" : width,
        height: height === "100%" ? "100%" : height,
        minWidth: 0,
        minHeight: 1,
        position: "relative",
        overflow: "visible",
      }}
    >
      {child && explicitWidth > 0 && explicitHeight > 0
        ? React.cloneElement(child, {
            width: explicitWidth,
            height: explicitHeight,
            ...rest,
          })
        : null}
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
