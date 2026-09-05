"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Series } from "./LineTrendChart";
import { formatChartValue, type ChartFormat } from "./format";

export function GroupedBarChart({
  data,
  series,
  height = 260,
  format = "number",
}: {
  data: Record<string, string | number>[];
  series: Series[];
  height?: number;
  format?: ChartFormat;
}) {
  const yFormat = (v: number) => formatChartValue(format, v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="x" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border-strong)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yFormat} width={40} />
        <Tooltip
          cursor={{ fill: "var(--page)" }}
          contentStyle={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => [yFormat(Number(value)), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-secondary)" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
