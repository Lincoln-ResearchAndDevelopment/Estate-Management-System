"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Home, PlusSquare } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { listingsApi } from "@/modules/listings/api";
import { priceLabel } from "@/modules/listings/listing-card";
import type { Listing } from "@/types/api";

const TABS = [
  { value: "", label: "All" },
  { value: "approved", label: "Live" },
  { value: "pending_approval", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "approval_withdrawn", label: "Withdrawn" },
  { value: "draft", label: "Drafts" },
  { value: "rented_sold", label: "Rented / Sold" },
  { value: "expired", label: "Expired" },
];

/** SCR-LIST-05 My Listings. */
export default function AgentListingsPage() {
  const router = useRouter();
  const { params, update } = useListParams(["status", "q"] as const);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["agent", "listings", params],
    queryFn: () => listingsApi.mine({ ...params, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const counts = data?.meta.statusCounts ?? {};
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
            <p className="text-xs text-ink-600">{l.code} · For {l.listingType}</p>
          </div>
        </div>
      ),
    },
    { key: "price", header: "Price", cell: (l) => <span className="whitespace-nowrap">{priceLabel(l)}</span> },
    { key: "status", header: "Status", cell: (l) => <StatusPill status={l.status ?? "draft"} /> },
    { key: "views", header: "Views", cell: (l) => l.viewCount ?? 0, hideOnMobile: true },
    { key: "enquiries", header: "Enquiries", cell: (l) => l.enquiriesCount ?? 0, hideOnMobile: true },
    { key: "updated", header: "Updated", cell: (l) => formatDate(l.updatedAt), hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader
        title="My listings"
        breadcrumbs={[{ label: "Dashboard", href: "/agent" }, { label: "My listings" }]}
        actions={
          <Link href="/agent/listings/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">
            <PlusSquare className="h-4 w-4" /> Add listing
          </Link>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs items={TABS.map((t) => ({ ...t, count: t.value ? counts[t.value] ?? 0 : undefined }))} value={params.status} onChange={(v) => update({ status: v })} />
          <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search by title or code" />
        </div>
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(l) => l.id}
          loading={isLoading || isFetching}
          error={error as Error | null}
          onRetry={() => refetch()}
          onRowClick={(l) => router.push(`/agent/listings/${l.id}`)}
          emptyTitle="No listings here"
          emptyDescription="Create a listing and submit it for approval to see it on the website."
        />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
