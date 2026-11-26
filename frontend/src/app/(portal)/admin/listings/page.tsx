"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Hourglass, Home, Trash2, Undo2, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Card, KpiCard } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { listingsApi } from "@/modules/listings/api";
import { priceLabel } from "@/modules/listings/listing-card";
import type { Listing } from "@/types/api";

const TABS = [
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Live" },
  { value: "approval_withdrawn", label: "Withdrawn" },
  { value: "rejected", label: "Rejected" },
  { value: "rented_sold", label: "Rented / Sold" },
  { value: "expired", label: "Expired" },
  { value: "deleted", label: "Deleted" },
  { value: "all", label: "All" },
];

/** SCR-LIST-08 Listing Approvals. Pending first; actions open the review page. */
export default function AdminListingsPage() {
  const router = useRouter();
  const { params, update } = useListParams(["status", "type", "q"] as const);
  // The queue opens on Pending (SCR-LIST-08); "all" removes the status filter.
  const status = params.status || "pending_approval";
  const query = { ...params, status: status === "all" ? "" : status, pageSize: 10 };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "listings", query],
    queryFn: () => listingsApi.queue(query),
    placeholderData: keepPreviousData,
  });
  const k = data?.meta.kpis;

  const columns: Column<Listing>[] = [
    {
      key: "title",
      header: "Listing",
      cell: (l) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-army-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.coverUrl ? <img src={l.coverUrl} alt="" className="h-full w-full object-cover" /> : <Home className="m-auto mt-3 h-6 w-6 text-army-800/40" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{l.title}</p>
            <p className="text-xs text-ink-600">{l.code}{l.history?.[0]?.changedFields ? " · changed since last approval" : ""}</p>
          </div>
        </div>
      ),
    },
    { key: "agent", header: "Agent", cell: (l) => <span>{l.agent?.name}</span>, hideOnMobile: true },
    { key: "type", header: "Type", cell: (l) => <span className="capitalize">{l.listingType} · {l.propertyTypeLabel}</span>, hideOnMobile: true },
    { key: "price", header: "Price", cell: (l) => <span className="whitespace-nowrap">{priceLabel(l)}</span> },
    { key: "submitted", header: "Submitted", cell: (l) => formatDate(l.submittedAt ?? l.updatedAt), hideOnMobile: true },
    { key: "status", header: "Status", cell: (l) => <StatusPill status={l.status ?? "draft"} /> },
    { key: "action", header: "", cell: (l) => <Link href={`/admin/listings/${l.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-army-800 hover:underline">Review</Link> },
  ];

  return (
    <>
      <PageHeader title="Listing approvals" description="Nothing appears on the public website until it is approved here." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Listing approvals" }]} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Pending approval" value={k?.pending ?? 0} icon={<Hourglass className="h-5 w-5" />} loading={isLoading} highlight={!!k?.pending} />
        <KpiCard label="Live" value={k?.live ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Withdrawn" value={k?.withdrawn ?? 0} icon={<Undo2 className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Rejected" value={k?.rejected ?? 0} icon={<XCircle className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Deleted (30 days)" value={k?.deletedLast30Days ?? 0} icon={<Trash2 className="h-5 w-5" />} loading={isLoading} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <Tabs items={TABS} value={status} onChange={(v) => update({ status: v })} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search title or listing code" />
            <Select className="sm:w-40" value={params.type} onChange={(e) => update({ type: e.target.value })} aria-label="Listing type">
              <option value="">Rent and sale</option>
              <option value="rent">For rent</option>
              <option value="sale">For sale</option>
            </Select>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(l) => l.id}
          loading={isLoading || isFetching}
          error={error as Error | null}
          onRetry={() => refetch()}
          onRowClick={(l) => router.push(`/admin/listings/${l.id}`)}
          emptyTitle={status === "pending_approval" ? "No listings are waiting for approval" : "No listings found"}
        />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
