"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import type { AuditEntry } from "@/types/api";

const ENTITIES = ["User", "AccessRequest", "PropertyListing", "AgentProfile", "Unit", "Sector", "Street"];

/** Audit trail viewer (FR-ADMIN-04, NFR-AUD-01). Read-only: audit records cannot be edited. */
export default function AuditLogPage() {
  const { params, update } = useListParams(["entity", "action", "from", "to"] as const);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => api.get<Paginated<AuditEntry>>("/admin/audit-logs", { ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditEntry>[] = [
    { key: "when", header: "When", cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</span> },
    { key: "actor", header: "Actor", cell: (e) => <div><p className="font-medium">{e.actor}</p>{e.actorRole && <p className="text-xs text-ink-600">{e.actorRole}</p>}</div> },
    { key: "action", header: "Action", cell: (e) => <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">{e.action}</code> },
    { key: "entity", header: "Record", cell: (e) => `${e.entityType}${e.entityId ? ` #${e.entityId}` : ""}`, hideOnMobile: true },
    { key: "ip", header: "IP", cell: (e) => e.ipAddress ?? "—", hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader title="Audit log" description="Every approval, account change, sign-in and listing decision, with who did it and when." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Audit log" }]} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Record type" htmlFor="a-entity">
            <Select id="a-entity" value={params.entity} onChange={(e) => update({ entity: e.target.value })}>
              <option value="">All</option>
              {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Action starts with" htmlFor="a-action">
            <Input id="a-action" defaultValue={params.action} placeholder="e.g. listing." onBlur={(e) => update({ action: e.target.value })} />
          </Field>
          <Field label="From" htmlFor="a-from"><Input id="a-from" type="date" value={params.from} onChange={(e) => update({ from: e.target.value })} /></Field>
          <Field label="To" htmlFor="a-to"><Input id="a-to" type="date" value={params.to} onChange={(e) => update({ to: e.target.value })} /></Field>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(e) => e.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} onRowClick={setSelected} emptyTitle="No audit entries match" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.action ?? ""} description={selected ? `${selected.actor} · ${formatDateTime(selected.occurredAt)}` : undefined} size="lg">
        {selected && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["before", "after"] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">{k}</p>
                <pre className="max-h-80 overflow-auto rounded-lg bg-canvas p-3 text-xs">{selected[k] ? JSON.stringify(selected[k], null, 2) : "—"}</pre>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
