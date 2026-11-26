"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { API_URL, api, type Paginated } from "@/lib/api";
import { formatNaira, titleCase } from "@/lib/format";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Money } from "@/types/api";
import type { Vehicle } from "@/types/modules";

interface HouseholdRow {
  id: number;
  unit: string | null;
  street: string | null;
  head: { id: number; name: string; phone: string | null; email: string } | null;
  members: { id: number; fullName: string; relationship: string; phone: string | null; status: string }[];
  vehicles: Vehicle[];
  balance: Money;
}

/** M03/M04 household directory: who lives where, their vehicles and balance. */
export default function ResidentsPage() {
  const { can } = useAuth();
  const { params, update } = useListParams(["q"] as const);
  const q = useDebouncedValue(params.q);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "residents", { ...params, q }],
    queryFn: () => api.get<Paginated<HouseholdRow, { total_residents: number }>>("/admin/residents", { page: params.page, q }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<HouseholdRow>[] = [
    { key: "unit", header: "Unit", cell: (h) => <div><p className="font-medium">{h.unit ?? "—"}</p><p className="text-xs text-ink-600">{h.street}</p></div> },
    { key: "head", header: "Head of household", cell: (h) => h.head ? <div><p>{h.head.name}</p><p className="text-xs text-ink-600">{h.head.phone ?? h.head.email}</p></div> : "—" },
    { key: "members", header: "Members", cell: (h) => <span className="text-sm">{h.members.map((m) => `${m.fullName} (${titleCase(m.relationship)})`).join(", ") || "—"}</span>, hideOnMobile: true },
    { key: "vehicles", header: "Vehicles", cell: (h) => <span className="font-mono text-xs">{h.vehicles.map((v) => v.plateNumber).join(", ") || "—"}</span>, hideOnMobile: true },
    { key: "balance", header: "Balance", cell: (h) => can("finance.view") ? formatNaira(h.balance.amount, { decimals: true }) : "—" },
  ];

  return (
    <>
      <PageHeader title="Households" description={data ? `${data.meta.total_residents} active residents` : undefined} breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Households" }]}
        actions={can("reports.view") && <a href={`${API_URL}/api/v1/reports/export/residents`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50"><Download className="h-4 w-4" /> CSV</a>} />
      <Card>
        <div className="border-b border-line p-4"><SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Search unit or resident name" /></div>
        <DataTable columns={columns} rows={data?.data} rowKey={(h) => h.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No households found" emptyDescription="Households are created when access requests are approved." />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
