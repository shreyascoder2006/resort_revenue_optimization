"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartValue, type ChartFormat } from "./format";

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

export function HorizontalBarChart({
  data,
  height,
  format = "number",
  zeroLine = false,
}: {
  data: BarDatum[];
  height?: number;
  format?: ChartFormat;
  zeroLine?: boolean;
}) {
  const yFormat = (v: number) => formatChartValue(format, v);
  const chartHeight = height ?? Math.max(160, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormat}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--ink-secondary)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={150}
        />
        {zeroLine && <ReferenceLine x={0} stroke="var(--border-strong)" />}
        <Tooltip
          cursor={{ fill: "var(--page)" }}
          contentStyle={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => yFormat(Number(value))}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
