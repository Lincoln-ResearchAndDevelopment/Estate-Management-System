"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, DoorOpen, Megaphone, ShieldAlert, ShoppingBag, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatNaira, formatRelative } from "@/lib/format";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Money } from "@/types/api";
import type { Alert, Bill } from "@/types/modules";

interface Dashboard {
  unit: string | null;
  balance: Money;
  overdueCount: number;
  nextBill: Bill | null;
  activePasses: number;
  activeAlert: Alert | null;
  announcements: { id: number; title: string; body: string; pinned: boolean; publishedAt: string }[];
  nextMeeting: { id: number; title: string; location: string; startsAt: string } | null;
}

/** Resident home (SRS M03): balance, passes, active alert, notices and the next meeting, all from live data. */
export default function ResidentHomePage() {
  const { session, can } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident", "dashboard"],
    queryFn: () => api.get<{ data: Dashboard }>("/resident/dashboard"),
    refetchInterval: 30_000,
  });
  if (!session) return null;
  const d = data?.data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.user.name.split(" ")[0]}`}
        description={d?.unit ? `Unit ${d.unit}` : undefined}
        breadcrumbs={[{ label: "Home" }]}
      />
      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : (
        <>
          {d?.activeAlert && (
            <Link href="/resident/emergency" className="mb-6 flex items-center gap-3 rounded-xl border border-danger-600/30 bg-danger-50 p-4 text-danger-600">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Your {d.activeAlert.type} alert is {d.activeAlert.status.replace("_", " ")}</p>
                <p className="text-sm">Raised {formatRelative(d.activeAlert.createdAt)}. Tap to view progress.</p>
              </div>
            </Link>
          )}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {can("finance.pay_own") && (
              <KpiCard label="Amount due" value={formatNaira(d?.balance.amount)} icon={<Wallet className="h-5 w-5" />} loading={isLoading}
                subtitle={d?.overdueCount ? `${d.overdueCount} overdue bill(s)` : "No overdue bills"} href="/resident/finance" highlight={!!d?.overdueCount} />
            )}
            {can("access.manage_own") && (
              <KpiCard label="Active visitor passes" value={d?.activePasses ?? 0} icon={<DoorOpen className="h-5 w-5" />} loading={isLoading} href="/resident/visitors" />
            )}
            {can("finance.pay_own") && (
              <KpiCard label="Next bill due" value={d?.nextBill ? formatDate(d.nextBill.dueDate) : "None"} icon={<CalendarDays className="h-5 w-5" />} loading={isLoading}
                subtitle={d?.nextBill ? `${d.nextBill.description} · ${formatNaira(d.nextBill.balance.amount)}` : undefined} />
            )}
            {can("market.shop") && (
              <KpiCard label="Estate marketplace" value="Shop" icon={<ShoppingBag className="h-5 w-5" />} href="/resident/market" subtitle="Order from approved estate stores" />
            )}
          </div>

          {can("alerts.raise") && (
            <Link href="/resident/emergency" className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-danger-600 p-5 text-white shadow-sm hover:bg-danger-600/90">
              <div>
                <p className="text-lg font-semibold">Emergency? Raise a panic alert</p>
                <p className="text-sm text-white/80">Estate security is notified immediately with your unit details.</p>
              </div>
              <ShieldAlert className="h-10 w-10 shrink-0" />
            </Link>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Latest notices" action={<Link href="/notices" className="text-sm font-medium text-army-800 hover:underline">All notices</Link>} />
              {isLoading ? (
                <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : d?.announcements.length ? (
                <ul className="divide-y divide-line">
                  {d.announcements.map((n) => (
                    <li key={n.id} className="p-5">
                      <div className="flex items-center gap-2">
                        {n.pinned && <StatusPill status="pinned" label="Pinned" tone="gold" />}
                        <p className="font-medium">{n.title}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">{n.body}</p>
                      <p className="mt-1 text-xs text-ink-400">{formatRelative(n.publishedAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No notices right now" icon={<Megaphone className="h-6 w-6" />} />
              )}
            </Card>
            <Card>
              <CardHeader title="Next estate meeting" />
              {isLoading ? (
                <Skeleton className="m-5 h-20" />
              ) : d?.nextMeeting ? (
                <div className="space-y-1 p-5 text-sm">
                  <p className="font-medium">{d.nextMeeting.title}</p>
                  <p className="text-ink-600">{formatDateTime(d.nextMeeting.startsAt)}</p>
                  <p className="text-ink-600">{d.nextMeeting.location}</p>
                  <Link href="/notices?tab=meetings" className="mt-3 inline-block font-medium text-army-800 hover:underline">RSVP</Link>
                </div>
              ) : (
                <EmptyState title="No meeting scheduled" icon={<CalendarDays className="h-6 w-6" />} />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
