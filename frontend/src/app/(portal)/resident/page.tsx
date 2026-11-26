"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, DoorOpen, Megaphone, Plus, QrCode as QrIcon, ShieldAlert, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatNaira, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/modules/auth/auth-provider";
import { EstatePassCard } from "@/modules/resident/estate-pass-card";
import { PassQrModal } from "@/modules/resident/pass-qr-modal";
import type { Money } from "@/types/api";
import type { Alert, Bill, VisitorPass } from "@/types/modules";

interface Dashboard {
  unit: string | null;
  monthlyCharges: { name: string; amount: Money }[];
  monthlyTotal: Money;
  cleared: boolean | null;
  balance: Money;
  overdueCount: number;
  nextBill: Bill | null;
  activePasses: number;
  activeAlert: Alert | null;
  announcements: { id: number; title: string; body: string; pinned: boolean; publishedAt: string }[];
  nextMeeting: { id: number; title: string; location: string; startsAt: string } | null;
}

/** Resident dashboard (SCR-RES-01): estate pass QR, visitor pass QRs, dues, notices and the next meeting. */
export default function ResidentHomePage() {
  const { session, can } = useAuth();
  const [showPass, setShowPass] = useState<VisitorPass | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident", "dashboard"],
    queryFn: () => api.get<{ data: Dashboard }>("/resident/dashboard"),
    refetchInterval: 30_000,
  });
  const passes = useQuery({
    queryKey: ["resident", "passes", "active"],
    queryFn: () => api.get<{ data: VisitorPass[] }>("/resident/passes", { status: "active", pageSize: 5 }),
    enabled: can("access.manage_own"),
  });
  if (!session) return null;
  const d = data?.data;
  const activePasses = (passes.data?.data ?? []).filter((p) => p.status === "active");

  return (
    <>
      <PageHeader title={`Welcome, ${session.user.name.split(" ")[0]}`} description={d?.unit ? `Unit ${d.unit}` : undefined} breadcrumbs={[{ label: "Dashboard" }]} />
      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : (
        <>
          {d?.activeAlert && (
            <Link href="/resident/emergency" className="mb-6 flex items-center gap-3 rounded-xl border border-danger-600/30 bg-danger-50 p-4 text-danger-600">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Your {d.activeAlert.type} alert is {d.activeAlert.status.replace("_", " ")}</p>
                <p className="text-sm">Raised {formatRelative(d.activeAlert.createdAt)}. Security is handling it — tap to follow progress.</p>
              </div>
            </Link>
          )}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {can("finance.pay_own") && (
              <KpiCard label="Monthly charge" value={formatNaira(d?.monthlyTotal.amount)} icon={<CalendarDays className="h-5 w-5" />} loading={isLoading} href="/resident/finance"
                subtitle={d?.monthlyCharges.length ? d.monthlyCharges.map((c) => c.name).join(", ") : "No monthly charges set"} />
            )}
            {can("finance.pay_own") && (
              <KpiCard label="Amount due" value={formatNaira(d?.balance.amount)} icon={<Wallet className="h-5 w-5" />} loading={isLoading} href="/resident/finance"
                subtitle={d?.overdueCount ? `${d.overdueCount} overdue bill(s)` : d?.nextBill ? `Next due ${formatDate(d.nextBill.dueDate)}` : "Nothing due"} highlight={!!d?.overdueCount} />
            )}
            {can("access.manage_own") && (
              <KpiCard label="Active visitor passes" value={d?.activePasses ?? 0} icon={<DoorOpen className="h-5 w-5" />} loading={isLoading} href="/resident/visitors" />
            )}
            {can("finance.pay_own") && d && d.cleared !== null && (
              <KpiCard label="Estate dues" value={d.cleared ? "Cleared" : "Not cleared"} icon={<QrIcon className="h-5 w-5" />} highlight={!d.cleared} href="/resident/finance" />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {can("access.manage_own") && (
                <Card>
                  <CardHeader title="Visitor passes" description="Create a QR pass and send it to your visitor. Security scans it at the gate."
                    action={<Link href="/resident/visitors?new=1" className="inline-flex h-9 items-center gap-2 rounded-lg bg-army-900 px-3 text-sm font-medium text-white hover:bg-army-800"><Plus className="h-4 w-4" /> New pass</Link>} />
                  {passes.isLoading ? <Skeleton className="m-5 h-24" /> : activePasses.length ? (
                    <ul className="divide-y divide-line">
                      {activePasses.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div>
                            <p className="font-medium">{p.visitorName}</p>
                            <p className="text-xs text-ink-600">Until {formatDateTime(p.validUntil)} · {p.entriesUsed}/{p.maxEntries} entries</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setShowPass(p)}><QrIcon className="h-4 w-4" /> Show QR</Button>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState title="No active visitor passes" description="Expecting someone? Create a pass in a few seconds." icon={<DoorOpen className="h-6 w-6" />} />}
                  <div className="border-t border-line px-5 py-3 text-right"><Link href="/resident/visitors" className="text-sm font-medium text-army-800 hover:underline">All passes, away notices and gate activity</Link></div>
                </Card>
              )}
              <Card>
                <CardHeader title="Estate updates" action={<Link href="/notices" className="text-sm font-medium text-army-800 hover:underline">All notices</Link>} />
                {isLoading ? (
                  <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
                ) : d?.announcements.length ? (
                  <ul className="divide-y divide-line">
                    {d.announcements.map((n) => (
                      <li key={n.id} className="p-5">
                        <div className="flex items-center gap-2">{n.pinned && <StatusPill status="pinned" label="Pinned" tone="gold" />}<p className="font-medium">{n.title}</p></div>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-600">{n.body}</p>
                        <p className="mt-1 text-xs text-ink-400">{formatRelative(n.publishedAt)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No notices right now" icon={<Megaphone className="h-6 w-6" />} />}
                {d?.nextMeeting && (
                  <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
                    <p><span className="font-medium">Next meeting:</span> {d.nextMeeting.title} · {formatDateTime(d.nextMeeting.startsAt)} · {d.nextMeeting.location}</p>
                    <Link href="/notices?tab=meetings" className="shrink-0 font-medium text-army-800 hover:underline">RSVP</Link>
                  </div>
                )}
              </Card>
            </div>
            {can(["finance.pay_own", "access.manage_own"]) && <EstatePassCard />}
          </div>
        </>
      )}
      {showPass && <PassQrModal pass={showPass} onClose={() => setShowPass(null)} />}
    </>
  );
}
