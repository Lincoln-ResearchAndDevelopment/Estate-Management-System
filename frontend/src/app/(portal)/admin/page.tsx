"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Home, ListChecks, ShieldBan, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { NAVIGATION } from "@/components/layout/nav";
import { useAuth } from "@/modules/auth/auth-provider";

interface Kpi { value: number; delta?: number; deltaLabel?: string; percent?: number; total?: number; link: string }
interface Dashboard {
  kpis: Record<"totalResidents" | "occupiedUnits" | "pendingAccessRequests" | "pendingListings" | "liveListings" | "pendingAgents" | "blockedAccounts", Kpi>;
  recentActivity: { id: number; action: string; entityType: string; actor: string; occurredAt: string }[];
  generatedAt: string;
}

/** SCR-DASH-01 Admin Dashboard — KPIs computed live by the API (no static figures). */
export default function AdminDashboardPage() {
  const { session, can } = useAuth();
  const allowed = can("dashboard.admin");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<{ data: Dashboard }>("/admin/dashboard"),
    enabled: allowed,
    refetchInterval: 60_000,
  });

  const firstName = session?.user.name.split(" ")[0] ?? "";
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date());

  // Finance and security officers reach the admin portal but not this dashboard: show their permitted areas.
  if (!allowed) {
    const links = NAVIGATION.admin.flatMap((s) => s.items).filter((i) => i.href !== "/admin" && (!i.permissions?.length || can(i.permissions)));
    return (
      <>
        <PageHeader title={`Welcome back, ${firstName}`} description={today} breadcrumbs={[{ label: "Home" }]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-center gap-3 p-5 hover:shadow-md">
              <l.icon className="h-6 w-6 text-army-800" aria-hidden />
              <span className="font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  const k = data?.data.kpis;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={today}
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={data && <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-600">Updated {formatRelative(data.data.generatedAt)}</span>}
      />

      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total residents" value={k?.totalResidents.value ?? 0} delta={k?.totalResidents.delta} deltaLabel={k?.totalResidents.deltaLabel} icon={<Users className="h-5 w-5" />} href={k?.totalResidents.link} loading={isLoading} />
            <KpiCard label="Occupied units" value={k ? `${k.occupiedUnits.value}` : 0} subtitle={k ? `${k.occupiedUnits.percent}% of ${k.occupiedUnits.total} units` : undefined} icon={<Building2 className="h-5 w-5" />} href={k?.occupiedUnits.link} loading={isLoading} />
            <KpiCard label="Pending access requests" value={k?.pendingAccessRequests.value ?? 0} icon={<ClipboardCheck className="h-5 w-5" />} href={k?.pendingAccessRequests.link} loading={isLoading} highlight={!!k?.pendingAccessRequests.value} />
            <KpiCard label="Listings awaiting approval" value={k?.pendingListings.value ?? 0} icon={<ListChecks className="h-5 w-5" />} href={k?.pendingListings.link} loading={isLoading} highlight={!!k?.pendingListings.value} />
            <KpiCard label="Live listings" value={k?.liveListings.value ?? 0} icon={<Home className="h-5 w-5" />} href={k?.liveListings.link} loading={isLoading} />
            <KpiCard label="Agent applications" value={k?.pendingAgents.value ?? 0} icon={<ShieldCheck className="h-5 w-5" />} href={k?.pendingAgents.link} loading={isLoading} highlight={!!k?.pendingAgents.value} />
            <KpiCard label="Blocked accounts" value={k?.blockedAccounts.value ?? 0} icon={<ShieldBan className="h-5 w-5" />} href={k?.blockedAccounts.link} loading={isLoading} />
          </div>

          <Card className="mt-6">
            <CardHeader title="Recent activity" description="Latest actions recorded in the audit log" action={can("audit.view") && <Link href="/admin/audit-logs" className="text-sm font-medium text-army-800 hover:underline">View audit log</Link>} />
            {isLoading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : data?.data.recentActivity.length ? (
              <ul className="divide-y divide-line">
                {data.data.recentActivity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span><span className="font-medium">{a.actor}</span> <span className="text-ink-600">— {titleCase(a.action.replace(".", " "))}</span></span>
                    <time className="text-xs text-ink-400" dateTime={a.occurredAt}>{formatDateTime(a.occurredAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No activity yet" />
            )}
          </Card>
        </>
      )}
    </>
  );
}
