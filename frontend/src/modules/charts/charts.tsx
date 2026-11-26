"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNaira } from "@/lib/format";

/**
 * Validated two-series palette (dataviz validator: lightness, chroma, CVD and normal-vision checks pass).
 * Identity is never colour-alone: every chart has a legend and a tooltip, and pages offer a table/CSV view.
 */
export const SERIES = { collected: "#1F7A4D", billed: "#B8892A" } as const;

const axis = { stroke: "#6B7280", fontSize: 12, tickLine: false, axisLine: false } as const;

/** Billed vs collected per period (grouped bars on one naira axis). */
export function BilledCollectedChart({ data, xKey = "month", height = 280 }: { data: { billed: number; collected: number; [k: string]: string | number }[]; xKey?: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Amount billed and collected per period">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={64} tickFormatter={(v: number) => formatNaira(v, { compact: true })} />
          <Tooltip cursor={{ fill: "rgba(24,57,43,0.06)" }} formatter={(v: number, name: string) => [formatNaira(v, { decimals: true }), name === "billed" ? "Billed" : "Collected"]} />
          <Legend formatter={(v: string) => <span className="text-sm text-ink-600">{v === "billed" ? "Billed" : "Collected"}</span>} />
          <Bar dataKey="billed" fill={SERIES.billed} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="collected" fill={SERIES.collected} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series counts (e.g. gate entries per day); one hue, no legend — the card title names it. */
export function CountBarChart({ data, xKey, yKey, label, height = 240 }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} allowDecimals={false} width={40} />
          <Tooltip cursor={{ fill: "rgba(24,57,43,0.06)" }} formatter={(v: number) => [v, label]} />
          <Bar dataKey={yKey} fill={SERIES.collected} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
