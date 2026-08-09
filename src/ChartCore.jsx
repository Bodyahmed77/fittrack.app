// ============================================================
// Recharts chart renderer — the ONLY module that statically
// imports recharts.
//
// This file is intentionally loaded lazily via `./charts.jsx`
// (React.lazy + dynamic import). Recharts (~528 KB) is therefore
// NOT part of the app's initial startup bundle. It is fetched and
// parsed only when a chart is actually about to be displayed.
//
// All charts are rendered declaratively via a single `ChartCore`
// component driven by props, so the calling screens never need to
// import recharts directly.
// ============================================================
import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function ChartCore({
  type = "area",
  data = [],
  height = 150,
  xKey = "date",
  yKey = "kg",
  stroke = "#ffffff",
  strokeWidth = 2.5,
  dot = true,
  activeDot,
  strokeDasharray,
  fillGradient,
  // When true and type === "area", renders BOTH a crisp stroke Line
  // (with dots) on top AND the gradient Area fill underneath — matching
  // the original Home weight card exactly.
  lineOverlay = false,
  lineOverlayProps,
  areaFillId,
  hideAxes = false,
  grid = false,
  gridDasharray = "3 3",
  xInterval,
  yDomain,
  yWidth = 26,
  margin,
  tooltip = false,
  tooltipCard,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipLabelFormatter,
  tooltipFormatter,
}) {
  const ChartComponent = type === "line" ? LineChart : AreaChart;
  const axisStroke = tooltipCard?.sub || "#888";
  const fillId = fillGradient?.id || areaFillId || "chartFill";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data} margin={margin}>
        {fillGradient && (
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={fillGradient.color}
                stopOpacity={fillGradient.opacityTop ?? 0.6}
              />
              <stop
                offset="100%"
                stopColor={fillGradient.color}
                stopOpacity={fillGradient.opacityBottom ?? 0.15}
              />
            </linearGradient>
          </defs>
        )}
        {grid && (
          <CartesianGrid
            stroke={tooltipCard?.border || "#333"}
            vertical={false}
            strokeDasharray={gridDasharray}
          />
        )}
        <XAxis
          dataKey={xKey}
          hide={hideAxes}
          stroke={axisStroke}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval={xInterval}
        />
        <YAxis
          hide={hideAxes}
          stroke={axisStroke}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={yWidth}
          domain={yDomain}
        />
        {tooltip && (
          <Tooltip
            contentStyle={{
              background: tooltipCard?.card || "#22272e",
              border: `1px solid ${tooltipCard?.border || "#333"}`,
              borderRadius: tooltipCard?.radius || 8,
              fontSize: 12,
              color: tooltipCard?.text || "#fff",
            }}
            labelStyle={
              tooltipLabelStyle || {
                color: tooltipCard?.text || "#fff",
                fontWeight: 700,
              }
            }
            itemStyle={
              tooltipItemStyle || { color: tooltipCard?.text || "#fff" }
            }
            labelFormatter={tooltipLabelFormatter}
            formatter={tooltipFormatter}
          />
        )}
        {type === "line" ? (
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dot={dot}
            activeDot={activeDot}
            strokeDasharray={strokeDasharray}
            isAnimationActive
          />
        ) : lineOverlay ? (
          <>
            <Area
              type="monotone"
              dataKey={yKey}
              stroke="none"
              fill={fillGradient ? `url(#${fillId})` : undefined}
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={stroke}
              strokeWidth={lineOverlayProps?.strokeWidth ?? strokeWidth}
              dot={lineOverlayProps?.dot ?? dot}
              strokeDasharray={lineOverlayProps?.strokeDasharray}
              isAnimationActive
            />
          </>
        ) : (
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dot={dot}
            fill={fillGradient ? `url(#${fillId})` : undefined}
            isAnimationActive
          />
        )}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
