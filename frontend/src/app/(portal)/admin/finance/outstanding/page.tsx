"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type Paginated } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { SearchInput } from "@/components/shared/search-input";
import type { Money } from "@/types/api";

interface Row { householdId: number; unit: string | null; head: string | null; phone: string | null; balance: Money; overdueCount: number }

/** Households with open bills, largest balance first (debt follow-up list). */
export default function OutstandingPage() {
  const { params, update } = useListParams(["q"] as const);
  const q = useDebouncedValue(params.q);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["finance", "outstanding", { ...params, q }],
    queryFn: () => api.get<Paginated<Row>>("/finance/outstanding", { page: params.page, q }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Row>[] = [
    { key: "unit", header: "Unit", cell: (r) => <span className="font-medium">{r.unit ?? "—"}</span> },
    { key: "head", header: "Head of household", cell: (r) => <div><p>{r.head ?? "—"}</p>{r.phone && <a href={`tel:${r.phone}`} className="text-xs text-army-800">{r.phone}</a>}</div> },
    { key: "balance", header: "Balance", cell: (r) => <span className="font-semibold">{formatNaira(r.balance.amount, { decimals: true })}</span> },
    { key: "overdue", header: "Overdue bills", cell: (r) => (r.overdueCount ? <StatusPill status="overdue" label={`${r.overdueCount} overdue`} /> : "—") },
    { key: "bills", header: "", cell: (r) => <Link href={`/admin/finance/bills?q=${encodeURIComponent(r.unit ?? "")}&status=open`} className="text-sm font-medium text-army-800 hover:underline">View bills</Link> },
  ];

  return (
    <>
      <PageHeader title="Outstanding balances" breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Outstanding" }]} />
      <Card>
        <div className="border-b border-line p-4"><SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Search unit code" /></div>
        <DataTable columns={columns} rows={data?.data} rowKey={(r) => r.householdId} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No outstanding balances" emptyDescription="Every household is fully paid." />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
