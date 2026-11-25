"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, DoorOpen, FileWarning, Plane, Siren, Timer, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/modules/auth/auth-provider";
import { AlertModal } from "@/modules/security/alert-panel";
import type { AccessLog, Alert } from "@/types/modules";

interface Overview {
  activeAlerts: Alert[];
  kpis: { activeAlerts: number; alertsToday: number; visitorsInside: number; entriesToday: number; refusedToday: number; openIncidents: number; awayHouseholds: number };
  recentAccess: AccessLog[];
  avgResponseMinutes: number | null;
}

/** Security HQ (SRS M08): live alerts and gate activity, refreshed every 10 seconds. */
export default function SecurityDashboard() {
  const { can } = useAuth();
  const [openId, setOpenId] = useState<number | null>(null);
  const responder = can("security.respond");
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["security", "overview"],
    queryFn: () => api.get<{ data: Overview }>("/security/overview"),
    refetchInterval: 10_000,
    enabled: responder,
  });
  const d = data?.data;

  if (!responder) {
    return (
      <>
        <PageHeader title="Security operations" breadcrumbs={[{ label: "Security" }]} />
        <Card className="p-6 text-sm">Use <Link className="font-medium text-army-800 underline" href="/security/logs">Access logs</Link> to review gate activity.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Security HQ" description={dataUpdatedAt ? `Live · updated ${formatRelative(new Date(dataUpdatedAt).toISOString())}` : undefined} breadcrumbs={[{ label: "Security" }]}
        actions={can("access.gate") && <Link href="/security/gate" className="inline-flex h-10 items-center gap-2 rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800"><DoorOpen className="h-4 w-4" /> Gate control</Link>} />
      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Active alerts" value={d?.kpis.activeAlerts ?? 0} icon={<Siren className="h-5 w-5" />} loading={isLoading} highlight={!!d?.kpis.activeAlerts} href="/security/alerts?status=active" />
            <KpiCard label="Visitors inside" value={d?.kpis.visitorsInside ?? 0} icon={<Users className="h-5 w-5" />} loading={isLoading} href="/security/gate" />
            <KpiCard label="Entries today" value={d?.kpis.entriesToday ?? 0} icon={<DoorOpen className="h-5 w-5" />} loading={isLoading} subtitle={`${d?.kpis.refusedToday ?? 0} refused`} href="/security/logs" />
            <KpiCard label="Avg. response" value={d?.avgResponseMinutes != null ? `${d.avgResponseMinutes} min` : "—"} icon={<Timer className="h-5 w-5" />} loading={isLoading} subtitle="Raised → acknowledged, last 30 days" />
            <KpiCard label="Alerts today" value={d?.kpis.alertsToday ?? 0} icon={<AlertTriangle className="h-5 w-5" />} loading={isLoading} href="/security/alerts" />
            <KpiCard label="Open incidents" value={d?.kpis.openIncidents ?? 0} icon={<FileWarning className="h-5 w-5" />} loading={isLoading} href="/security/incidents" />
            <KpiCard label="Homes away" value={d?.kpis.awayHouseholds ?? 0} icon={<Plane className="h-5 w-5" />} loading={isLoading} href="/security/gate#away" />
            <KpiCard label="Refused today" value={d?.kpis.refusedToday ?? 0} icon={<Ban className="h-5 w-5" />} loading={isLoading} href="/security/logs?flagged=1" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Active emergency alerts" />
              {d?.activeAlerts.length ? (
                <ul className="divide-y divide-line">
                  {d.activeAlerts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={a.status === "raised" ? "h-3 w-3 animate-ping rounded-full bg-danger-600" : "h-3 w-3 rounded-full bg-warning-600"} aria-hidden />
                        <div>
                          <p className="font-medium">{titleCase(a.type)} · Unit {a.unit ?? "—"}</p>
                          <p className="text-xs text-ink-600">{a.raisedBy?.name} · {formatRelative(a.createdAt)}{a.escalated ? " · ESCALATED" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2"><StatusPill status={a.status} /><Button size="sm" onClick={() => setOpenId(a.id)}>Respond</Button></div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title={isLoading ? "Loading…" : "No active alerts"} description="New alerts appear here within seconds." icon={<Siren className="h-6 w-6" />} />}
            </Card>
            <Card>
              <CardHeader title="Recent gate activity" action={<Link href="/security/logs" className="text-sm font-medium text-army-800 hover:underline">All logs</Link>} />
              {d?.recentAccess.length ? (
                <ul className="divide-y divide-line text-sm">
                  {d.recentAccess.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div><p className="font-medium">{l.personName ?? l.plateNumber ?? "—"}</p><p className="text-xs text-ink-600">{formatDateTime(l.occurredAt)}{l.unit ? ` · ${l.unit}` : ""}</p></div>
                      {l.flagReason?.startsWith("REFUSED") ? <StatusPill status="refused" label="Refused" tone="danger" /> : <StatusPill status={l.direction} label={l.direction === "in" ? "In" : "Out"} tone={l.flagged ? "warning" : l.direction === "in" ? "success" : "neutral"} />}
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title={isLoading ? "Loading…" : "No gate activity yet"} />}
            </Card>
          </div>
        </>
      )}
      {openId && <AlertModal alertId={openId} onClose={() => setOpenId(null)} onChanged={() => refetch()} />}
    </>
  );
}
