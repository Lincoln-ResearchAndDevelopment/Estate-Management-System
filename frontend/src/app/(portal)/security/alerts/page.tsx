"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { AlertModal } from "@/modules/security/alert-panel";
import type { Alert } from "@/types/modules";

export default function AlertsPage() {
  const { params, update } = useListParams(["status", "type"] as const);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security", "alerts", params],
    queryFn: () => api.get<Paginated<Alert>>("/security/alerts", params),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const columns: Column<Alert>[] = [
    { key: "ref", header: "Alert", cell: (a) => <div><p className="font-medium">{titleCase(a.type)} · {a.reference}</p><p className="text-xs text-ink-600">{formatDateTime(a.createdAt)}</p></div> },
    { key: "who", header: "Resident", cell: (a) => <div><p>{a.raisedBy?.name ?? "—"}</p><p className="text-xs text-ink-600">Unit {a.unit ?? "—"}</p></div> },
    { key: "responder", header: "Responder", cell: (a) => a.responder ?? "—", hideOnMobile: true },
    { key: "status", header: "Status", cell: (a) => <div className="flex gap-1"><StatusPill status={a.status} />{a.escalated && <StatusPill status="esc" label="Escalated" tone="danger" />}</div> },
    { key: "open", header: "", cell: (a) => <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>Open</Button> },
  ];

  return (
    <>
      <PageHeader title="Emergency alerts" breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Alerts" }]} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <Select className="sm:w-48" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option><option value="active">Active</option>
            {["raised", "acknowledged", "dispatched", "resolved", "false_alarm", "cancelled"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select className="sm:w-48" value={params.type} onChange={(e) => update({ type: e.target.value })} aria-label="Type">
            <option value="">All types</option>{["panic", "security", "medical", "fire"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(a) => a.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No alerts match" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
      {openId && <AlertModal alertId={openId} onClose={() => setOpenId(null)} onChanged={() => refetch()} />}
    </>
  );
}
