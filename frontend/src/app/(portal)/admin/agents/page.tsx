"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api, API_URL, ApiError, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Agent } from "@/types/api";

type Action = { kind: "approve" | "reject" | "suspend" | "reinstate"; agent: Agent } | null;

/** Agent applications and accounts (FR-LIST-05, FR-LIST-20). */
export default function AdminAgentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { params, update } = useListParams(["status", "q"] as const);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "agents", params],
    queryFn: () => api.get<Paginated<Agent, { pendingCount: number }>>("/admin/agents", { ...params, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const run = async (path: string, body: object | undefined, success: string) => {
    setBusy(true);
    try {
      await api.post(path, body);
      toast.success(success);
      setAction(null);
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const decide = can("agents.decide");
  const columns: Column<Agent>[] = [
    { key: "name", header: "Agent", cell: (a) => <div><p className="font-medium">{a.name}</p><p className="text-xs text-ink-600">{a.email}</p></div> },
    { key: "agency", header: "Agency", cell: (a) => a.agencyName ?? "—", hideOnMobile: true },
    { key: "phone", header: "Phone", cell: (a) => a.phone ?? "—", hideOnMobile: true },
    { key: "id", header: "ID document", cell: (a) => <a href={a.idDocumentUrl.startsWith("http") ? a.idDocumentUrl : `${API_URL}${a.idDocumentUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-army-800 hover:underline"><FileText className="h-4 w-4" />Open</a>, hideOnMobile: true },
    { key: "live", header: "Live listings", cell: (a) => a.liveListings, hideOnMobile: true },
    { key: "applied", header: "Applied", cell: (a) => formatDate(a.appliedAt), hideOnMobile: true },
    { key: "status", header: "Status", cell: (a) => <StatusPill status={a.status} /> },
    {
      key: "actions",
      header: "",
      cell: (a) =>
        decide && (
          <div className="flex justify-end gap-1">
            {(a.status === "pending" || a.status === "rejected") && <Button size="sm" onClick={() => setAction({ kind: "approve", agent: a })}>Approve</Button>}
            {a.status === "pending" && <Button size="sm" variant="outline" onClick={() => setAction({ kind: "reject", agent: a })}>Reject</Button>}
            {a.status === "approved" && <Button size="sm" variant="outline" onClick={() => setAction({ kind: "suspend", agent: a })}>Suspend</Button>}
            {a.status === "suspended" && <Button size="sm" variant="secondary" onClick={() => setAction({ kind: "reinstate", agent: a })}>Reinstate</Button>}
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Agents" description="Approve agent applications and manage agent accounts." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Agents" }]} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={[
              { value: "", label: "All" },
              { value: "pending", label: "Pending", count: data?.meta.pendingCount },
              { value: "approved", label: "Approved" },
              { value: "suspended", label: "Suspended" },
              { value: "rejected", label: "Rejected" },
            ]}
            value={params.status}
            onChange={(v) => update({ status: v })}
          />
          <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search name, email or agency" />
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(a) => a.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No agents found" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <ConfirmDialog
        open={action?.kind === "approve"}
        onClose={() => setAction(null)}
        onConfirm={() => action && run(`/admin/agents/${action.agent.id}/approve`, undefined, `${action.agent.name} approved. They can now sign in.`)}
        title="Approve agent?"
        message={`${action?.agent.name} will be able to sign in and submit listings for approval.`}
        confirmLabel="Approve"
        loading={busy}
      />
      <ConfirmDialog
        open={action?.kind === "reinstate"}
        onClose={() => setAction(null)}
        onConfirm={() => action && run(`/admin/agents/${action.agent.id}/reinstate`, undefined, "Agent reinstated.")}
        title="Reinstate agent?"
        message="Their account is reactivated. Withdrawn listings stay withdrawn until resubmitted and approved."
        confirmLabel="Reinstate"
        loading={busy}
      />
      <ReasonDialog open={action?.kind === "reject"} onClose={() => setAction(null)} onSubmit={(reason) => action && run(`/admin/agents/${action.agent.id}/reject`, { reason }, "Application rejected.")} title="Reject application" confirmLabel="Reject" destructive loading={busy} />
      <ReasonDialog
        open={action?.kind === "suspend"}
        onClose={() => setAction(null)}
        onSubmit={(reason) => action && run(`/admin/agents/${action.agent.id}/suspend`, { reason }, "Agent suspended and all live listings withdrawn.")}
        title={`Suspend ${action?.agent.name ?? "agent"}?`}
        description={`Their account is blocked and all ${action?.agent.liveListings ?? 0} live listing(s) are removed from the website.`}
        confirmLabel="Suspend agent"
        destructive
        loading={busy}
      />
    </>
  );
}
