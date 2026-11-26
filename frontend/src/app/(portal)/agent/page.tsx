"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, FileEdit, Hourglass, MessageSquareText, PlusSquare, XCircle } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { listingsApi } from "@/modules/listings/api";
import { useAuth } from "@/modules/auth/auth-provider";

/** SCR-LIST-04 Agent Dashboard — every figure is computed by the API. */
export default function AgentDashboardPage() {
  const { session } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["agent", "dashboard"], queryFn: listingsApi.dashboard });
  const k = data?.data.kpis;

  return (
    <>
      <PageHeader
        title={`Welcome, ${session?.user.name.split(" ")[0] ?? "Agent"}`}
        description="Your listings, admin decisions and enquiries at a glance."
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <Link href="/agent/listings/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">
            <PlusSquare className="h-4 w-4" /> Add listing
          </Link>
        }
      />

      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Live" value={k?.live ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} href="/agent/listings?status=approved" loading={isLoading} />
            <KpiCard label="Pending approval" value={k?.pending ?? 0} icon={<Hourglass className="h-5 w-5" />} href="/agent/listings?status=pending_approval" loading={isLoading} />
            <KpiCard label="Rejected / withdrawn" value={k?.rejectedOrWithdrawn ?? 0} icon={<XCircle className="h-5 w-5" />} href="/agent/listings?status=rejected" loading={isLoading} />
            <KpiCard label="Drafts" value={k?.drafts ?? 0} icon={<FileEdit className="h-5 w-5" />} href="/agent/listings?status=draft" loading={isLoading} />
            <KpiCard label="New enquiries" value={k?.newEnquiries ?? 0} icon={<MessageSquareText className="h-5 w-5" />} href="/agent/enquiries?status=new" loading={isLoading} highlight={!!k?.newEnquiries} />
            <KpiCard label="Total views" value={k?.totalViews ?? 0} icon={<Eye className="h-5 w-5" />} loading={isLoading} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent admin decisions" />
              {isLoading ? (
                <div className="space-y-2 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : data?.data.recentDecisions.length ? (
                <ul className="divide-y divide-line">
                  {data.data.recentDecisions.map((d, i) => (
                    <li key={i}>
                      <Link href={`/agent/listings/${d.listingId}`} className="block px-5 py-3 hover:bg-canvas">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{d.listingTitle}</p>
                          <StatusPill status={d.decision} />
                        </div>
                        {d.reason && <p className="mt-1 line-clamp-2 text-xs text-ink-600">{d.reason}</p>}
                        <p className="mt-1 text-[11px] text-ink-400">{formatRelative(d.occurredAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No decisions yet" description="Admin decisions on your listings will appear here." />
              )}
            </Card>

            <Card>
              <CardHeader title="Latest enquiries" action={<Link href="/agent/enquiries" className="text-sm font-medium text-army-800 hover:underline">View all</Link>} />
              {isLoading ? (
                <div className="space-y-2 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : data?.data.latestEnquiries.length ? (
                <ul className="divide-y divide-line">
                  {data.data.latestEnquiries.map((e) => (
                    <li key={e.id}>
                      <Link href={`/agent/enquiries?selected=${e.id}`} className="block px-5 py-3 hover:bg-canvas">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{e.name}</p>
                          <StatusPill status={e.status} />
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-600">{e.listing?.title}</p>
                        <p className="mt-1 text-[11px] text-ink-400">{formatRelative(e.createdAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No enquiries yet" description="Enquiries from the public appear here once your listings are live." />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
