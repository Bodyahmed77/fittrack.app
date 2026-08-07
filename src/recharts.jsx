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

export const LineChart = lazyRechartsComponent("LineChart");
export const Line = lazyRechartsComponent("Line");
export const AreaChart = lazyRechartsComponent("AreaChart");
export const Area = lazyRechartsComponent("Area");
export const XAxis = lazyRechartsComponent("XAxis");
export const YAxis = lazyRechartsComponent("YAxis");
export const CartesianGrid = lazyRechartsComponent("CartesianGrid");
export const Tooltip = lazyRechartsComponent("Tooltip");
export const ResponsiveContainer = lazyRechartsComponent("ResponsiveContainer");
