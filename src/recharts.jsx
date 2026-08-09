import React, { useEffect, useRef, useState } from "react";
import {
  LineChart as RCLineChart,
  Line as RCLine,
  AreaChart as RCAreaChart,
  Area as RCArea,
  ComposedChart as RCComposedChart,
  XAxis as RCXAxis,
  YAxis as RCYAxis,
  CartesianGrid as RCCartesianGrid,
  Tooltip as RCTooltip,
} from "recharts";

// Recharts identifies its own children by component type (Line, XAxis, ...),
// so the real Recharts components must be used directly as element types.
// Wrapping them in lazy placeholders makes the chart render empty.
// Recharts still lives in its own Rollup chunk (see vite.config.js).

// Android WebView can report a zero/unstable percentage size during the first
// layout pass, which makes Recharts' own ResponsiveContainer render nothing.
// Measure the host box here and hand explicit pixel dimensions to the chart so
// the existing chart implementation and styling stay untouched.
function AndroidSafeResponsiveContainer({ width = "100%", height = "100%", children, ...rest }) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let frame = 0;
    const timers = [];

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const parentRect = host.parentElement?.getBoundingClientRect();
        const nextWidth = Math.floor(rect.width || parentRect?.width || 0);
        const nextHeight = Math.floor(rect.height || parentRect?.height || 0);
        if (nextWidth <= 0 || nextHeight <= 0) return;
        setSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      });
    };

    measure();
    // Android WebView often settles its layout a few frames after mount.
    [50, 150, 400, 1000].forEach((delay) => {
      timers.push(window.setTimeout(measure, delay));
    });

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(host);
      if (host.parentElement) observer.observe(host.parentElement);
    }

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    document.addEventListener("visibilitychange", measure);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.removeEventListener("visibilitychange", measure);
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

export const LineChart = RCLineChart;
export const Line = RCLine;
export const AreaChart = RCAreaChart;
export const Area = RCArea;
export const ComposedChart = RCComposedChart;
export const XAxis = RCXAxis;
export const YAxis = RCYAxis;
export const CartesianGrid = RCCartesianGrid;
export const Tooltip = RCTooltip;
export const ResponsiveContainer = AndroidSafeResponsiveContainer;
