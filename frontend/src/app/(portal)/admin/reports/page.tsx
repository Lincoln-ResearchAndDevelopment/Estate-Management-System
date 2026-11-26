"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { API_URL, api, buildQuery } from "@/lib/api";
import { formatNaira, titleCase } from "@/lib/format";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { BilledCollectedChart, CountBarChart } from "@/modules/charts/charts";

interface Summary {
  range: { from: string; to: string };
  finance: { billed: number; collected: number; collectionRate: number | null; outstanding: number; revenueByMonth: { month: string; billed: number; collected: number }[]; byService: { name: string; billed: number; collected: number }[] };
  security: { alerts: number; alertsByType: Record<string, number>; alertsByStatus: Record<string, number>; falseAlarmRate: number | null; incidents: number };
  access: { entries: number; refused: number; entriesByDay: { day: string; entries: number }[] };
  community: { activeResidents: number; liveListings: number; ordersDelivered: number };
}

const EXPORTS = [
  ["payments", "Payments"], ["bills", "Bills"], ["residents", "Households"], ["access-logs", "Gate access logs"],
  ["alerts", "Emergency alerts"], ["incidents", "Incidents"], ["orders", "Marketplace orders"],
] as const;

/** M14 reports and analytics with CSV exports for the chosen period. */
export default function ReportsPage() {
  const [preset, setPreset] = useState("12m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = preset === "custom" ? { from, to } : { preset };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reports", query],
    queryFn: () => api.get<{ data: Summary }>("/reports/summary", query),
    enabled: preset !== "custom" || (!!from && !!to),
  });
  const d = data?.data;

  return (
    <>
      <PageHeader title="Reports & analytics" description={d ? `${d.range.from} to ${d.range.to}` : undefined} breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Reports" }]} />
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <Field label="Period" htmlFor="r-preset" className="sm:w-56">
          <Select id="r-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="ytd">Year to date</option><option value="12m">Last 12 months</option><option value="custom">Custom range</option>
          </Select>
        </Field>
        {preset === "custom" && <>
          <Field label="From" htmlFor="r-from"><Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="r-to"><Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </>}
      </Card>

      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Collected" value={formatNaira(d?.finance.collected, { compact: true })} loading={isLoading} subtitle={`of ${formatNaira(d?.finance.billed, { compact: true })} billed`} />
            <KpiCard label="Collection rate" value={d?.finance.collectionRate != null ? `${d.finance.collectionRate}%` : "—"} loading={isLoading} />
            <KpiCard label="Emergency alerts" value={d?.security.alerts ?? 0} loading={isLoading} subtitle={d?.security.falseAlarmRate != null ? `${d.security.falseAlarmRate}% false alarms` : undefined} />
            <KpiCard label="Gate entries" value={d?.access.entries ?? 0} loading={isLoading} subtitle={`${d?.access.refused ?? 0} refused`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Billed vs collected" description="Per month in the period" />
              <div className="p-4">{isLoading ? <Skeleton className="h-72" /> : d?.finance.revenueByMonth.length ? <BilledCollectedChart data={d.finance.revenueByMonth} /> : <EmptyState title="No finance data" />}</div>
            </Card>
            <Card>
              <CardHeader title="Gate entries per day" />
              <div className="p-4">{isLoading ? <Skeleton className="h-60" /> : d?.access.entriesByDay.length ? <CountBarChart data={d.access.entriesByDay} xKey="day" yKey="entries" label="Entries" /> : <EmptyState title="No gate entries in this period" />}</div>
            </Card>
            <Card>
              <CardHeader title="Collections by service" />
              {d?.finance.byService.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-left text-xs uppercase text-ink-600"><tr><th className="px-4 py-2">Service</th><th className="px-4 py-2 text-right">Billed</th><th className="px-4 py-2 text-right">Collected</th><th className="px-4 py-2 text-right">Rate</th></tr></thead>
                  <tbody>{d.finance.byService.map((s) => <tr key={s.name} className="border-t border-line"><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2 text-right">{formatNaira(s.billed)}</td><td className="px-4 py-2 text-right">{formatNaira(s.collected)}</td><td className="px-4 py-2 text-right">{s.billed ? Math.round((s.collected / s.billed) * 100) : 0}%</td></tr>)}</tbody>
                </table>
              ) : <EmptyState title={isLoading ? "Loading…" : "No service bills in this period"} />}
            </Card>
            <Card>
              <CardHeader title="Security summary" />
              {d ? (
                <div className="grid grid-cols-2 gap-6 p-5 text-sm">
                  <div><p className="mb-2 text-xs font-semibold uppercase text-ink-600">Alerts by type</p>{Object.entries(d.security.alertsByType).map(([k, v]) => <p key={k} className="flex justify-between"><span>{titleCase(k)}</span><span className="font-medium">{v}</span></p>)}{!Object.keys(d.security.alertsByType).length && <p className="text-ink-600">None</p>}</div>
                  <div><p className="mb-2 text-xs font-semibold uppercase text-ink-600">Alerts by outcome</p>{Object.entries(d.security.alertsByStatus).map(([k, v]) => <p key={k} className="flex justify-between"><span>{titleCase(k)}</span><span className="font-medium">{v}</span></p>)}{!Object.keys(d.security.alertsByStatus).length && <p className="text-ink-600">None</p>}</div>
                  <p className="col-span-2 border-t border-line pt-3">Incidents reported: <strong>{d.security.incidents}</strong> · Active residents: <strong>{d.community.activeResidents}</strong> · Live listings: <strong>{d.community.liveListings}</strong> · Orders delivered: <strong>{d.community.ordersDelivered}</strong></p>
                </div>
              ) : <Skeleton className="m-5 h-40" />}
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader title="Export data (CSV)" description="Opens in Excel or Google Sheets. Uses the period selected above." />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {EXPORTS.map(([type, label]) => (
                <a key={type} href={`${API_URL}/api/v1/reports/export/${type}${buildQuery(d ? { from: d.range.from, to: d.range.to } : undefined)}`} className="flex items-center gap-2 rounded-lg border border-line p-3 text-sm font-medium hover:bg-army-50"><Download className="h-4 w-4 text-army-800" /> {label}</a>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
