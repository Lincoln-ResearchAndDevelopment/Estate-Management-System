"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { API_URL, api, type Paginated } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import type { AccessLog } from "@/types/modules";

export default function AccessLogsPage() {
  const { can } = useAuth();
  const { params, update } = useListParams(["q", "direction", "flagged", "date"] as const);
  const q = useDebouncedValue(params.q);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security", "logs", { ...params, q }],
    queryFn: () => api.get<Paginated<AccessLog>>("/security/access-logs", { ...params, q, pageSize: 20 }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const columns: Column<AccessLog>[] = [
    { key: "when", header: "Time", cell: (l) => formatDateTime(l.occurredAt) },
    { key: "who", header: "Person / vehicle", cell: (l) => <div><p className="font-medium">{l.personName ?? "—"}</p><p className="text-xs text-ink-600">{titleCase(l.subjectType)}{l.plateNumber ? ` · ${l.plateNumber}` : ""}{l.passCode ? ` · pass ${l.passCode}` : ""}</p></div> },
    { key: "unit", header: "Unit", cell: (l) => l.unit ?? "—", hideOnMobile: true },
    { key: "dir", header: "Movement", cell: (l) => (l.flagReason?.startsWith("REFUSED") ? <StatusPill status="refused" label="Refused" tone="danger" /> : <StatusPill status={l.direction} label={l.direction === "in" ? "In" : "Out"} tone={l.direction === "in" ? "success" : "neutral"} />) },
    { key: "flag", header: "Flag", cell: (l) => (l.flagReason ? <span className="text-xs text-danger-600">{l.flagReason}</span> : "—"), hideOnMobile: true },
    { key: "officer", header: "Officer", cell: (l) => `${l.officer ?? "—"} · ${l.gate}`, hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader title="Access logs" breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Access logs" }]}
        actions={can("reports.view") && <a href={`${API_URL}/api/v1/reports/export/access-logs`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50"><Download className="h-4 w-4" /> Export CSV</a>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Name, plate or pass code" />
          <Select className="sm:w-36" value={params.direction} onChange={(e) => update({ direction: e.target.value })} aria-label="Direction"><option value="">In and out</option><option value="in">In</option><option value="out">Out</option></Select>
          <Select className="sm:w-40" value={params.flagged} onChange={(e) => update({ flagged: e.target.value })} aria-label="Flagged"><option value="">All entries</option><option value="1">Flagged only</option></Select>
          <Input type="date" className="sm:w-44" value={params.date} onChange={(e) => update({ date: e.target.value })} aria-label="Date" />
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(l) => l.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No gate activity matches" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
