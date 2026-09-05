"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatChartValue, type ChartFormat } from "./format";

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function LineTrendChart({
  data,
  series,
  format = "number",
  height = 260,
  zeroLine = false,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  format?: ChartFormat;
  height?: number;
  zeroLine?: boolean;
}) {
  const yFormat = (v: number) => formatChartValue(format, v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="x"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-strong)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormat}
          width={48}
        />
        {zeroLine && <ReferenceLine y={0} stroke="var(--border-strong)" />}
        <Tooltip
          contentStyle={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--ink-primary)", fontWeight: 600 }}
          formatter={(value, name) => [yFormat(Number(value)), String(name)]}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-secondary)" }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
