import React, { useEffect, useRef, useState } from "react";
import * as Recharts from "recharts";

// Keep the real Recharts components and their existing visual configuration.
// The Android fix is only concerned with reliable WebView layout measurement.
function AndroidSafeResponsiveContainer({ width = "100%", height = "100%", children, ...rest }) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.floor(rect.width || host.clientWidth || 0));
        const nextHeight = Math.max(1, Math.floor(rect.height || host.clientHeight || 0));
        if (nextWidth > 1 && nextHeight > 1) {
          setSize((prev) =>
            prev.width === nextWidth && prev.height === nextHeight
              ? prev
              : { width: nextWidth, height: nextHeight },
          );
        }
      });
    };

    measure();
    const timers = [50, 150, 300, 600].map((delay) => window.setTimeout(measure, delay));
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(host);
    }
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
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

export const LineChart = Recharts.LineChart;
export const Line = Recharts.Line;
export const AreaChart = Recharts.AreaChart;
export const Area = Recharts.Area;
export const XAxis = Recharts.XAxis;
export const YAxis = Recharts.YAxis;
export const CartesianGrid = Recharts.CartesianGrid;
export const Tooltip = Recharts.Tooltip;
export const ResponsiveContainer = AndroidSafeResponsiveContainer;
