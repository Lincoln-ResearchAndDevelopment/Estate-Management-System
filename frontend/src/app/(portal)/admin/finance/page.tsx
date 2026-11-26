"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Clock, Home, Percent, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatNaira, titleCase } from "@/lib/format";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { BilledCollectedChart } from "@/modules/charts/charts";
import type { Money } from "@/types/api";
import type { Payment } from "@/types/modules";

interface Overview {
  revenueThisMonth: Money;
  billedThisMonth: Money;
  collectionRate: number | null;
  outstanding: Money;
  overdue: Money;
  householdsOwing: number;
  pendingVerification: number;
  series: { month: string; billed: number; collected: number }[];
  byMethod: Record<string, number>;
  recentPayments: Payment[];
}

/** M05 finance dashboard. Every figure is computed by the API from bills and payments. */
export default function FinanceOverviewPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["finance", "overview"], queryFn: () => api.get<{ data: Overview }>("/finance/overview"), refetchInterval: 60_000 });
  const d = data?.data;

  return (
    <>
      <PageHeader title="Finance overview" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Finance" }]} />
      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Collected this month" value={formatNaira(d?.revenueThisMonth.amount, { compact: true })} icon={<Wallet className="h-5 w-5" />} loading={isLoading} href="/admin/finance/payments?status=success" />
            <KpiCard label="Billed this month" value={formatNaira(d?.billedThisMonth.amount, { compact: true })} icon={<Banknote className="h-5 w-5" />} loading={isLoading} href="/admin/finance/bills" />
            <KpiCard label="Collection rate" value={d?.collectionRate != null ? `${d.collectionRate}%` : "—"} icon={<Percent className="h-5 w-5" />} loading={isLoading} />
            <KpiCard label="Outstanding" value={formatNaira(d?.outstanding.amount, { compact: true })} icon={<Home className="h-5 w-5" />} loading={isLoading} subtitle={`${d?.householdsOwing ?? 0} households`} href="/admin/finance/outstanding" />
            <KpiCard label="Overdue" value={formatNaira(d?.overdue.amount, { compact: true })} icon={<AlertTriangle className="h-5 w-5" />} loading={isLoading} href="/admin/finance/bills?status=overdue" highlight={Number(d?.overdue.amount ?? 0) > 0} />
            <KpiCard label="Transfers to verify" value={d?.pendingVerification ?? 0} icon={<Clock className="h-5 w-5" />} loading={isLoading} href="/admin/finance/payments?status=pending_verification" highlight={!!d?.pendingVerification} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Billed vs collected" description="Last 6 months" />
              <div className="p-4">{isLoading ? <Skeleton className="h-72" /> : <BilledCollectedChart data={d?.series ?? []} />}</div>
            </Card>
            <Card>
              <CardHeader title="Collections by method" description="Last 6 months" />
              {d && Object.keys(d.byMethod).length ? (
                <ul className="space-y-3 p-5">
                  {Object.entries(d.byMethod).map(([method, total]) => {
                    const max = Math.max(...Object.values(d.byMethod));
                    return (
                      <li key={method}>
                        <div className="flex justify-between text-sm"><span>{titleCase(method)}</span><span className="font-medium">{formatNaira(total)}</span></div>
                        <div className="mt-1 h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-[#1F7A4D]" style={{ width: `${(total / max) * 100}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState title={isLoading ? "Loading…" : "No collections yet"} />}
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader title="Recent payments" action={<Link href="/admin/finance/payments" className="text-sm font-medium text-army-800 hover:underline">All payments</Link>} />
              {d?.recentPayments.length ? (
                <ul className="divide-y divide-line text-sm">
                  {d.recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div><p className="font-medium">{p.payer ?? "—"} · Unit {p.unit ?? "—"}</p><p className="text-xs text-ink-600">{p.receiptNumber} · {titleCase(p.method)} · {formatDateTime(p.paidAt)}</p></div>
                      <span className="font-semibold">{formatNaira(p.amount.amount, { decimals: true })}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title={isLoading ? "Loading…" : "No payments yet"} />}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
