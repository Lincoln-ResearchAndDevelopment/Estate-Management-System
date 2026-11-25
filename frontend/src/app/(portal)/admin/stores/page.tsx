"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import type { Store } from "@/types/modules";

/** M06 store approvals: stores go live only after estate management approves them. */
export default function AdminStoresPage() {
  const { busy, run } = useAction();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [plans, setPlans] = useState<Record<number, string>>({});
  const [decision, setDecision] = useState<{ store: Store; status: "rejected" | "suspended" } | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "stores", status, page],
    queryFn: () => api.get<Paginated<Store>>("/admin/stores", { status, page }),
  });

  const approve = async (s: Store) => {
    await run(`ok-${s.id}`, () => api.post(`/admin/stores/${s.id}/decision`, { status: "active", plan: plans[s.id] ?? s.plan }), `${s.name} is now live in the marketplace.`);
    refetch();
  };

  const columns: Column<Store>[] = [
    { key: "store", header: "Store", cell: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-600">{titleCase(s.category)} · {s.owner}</p></div> },
    { key: "contact", header: "Contact", cell: (s) => <span className="text-sm">{[s.phone, s.location].filter(Boolean).join(" · ") || "—"}</span>, hideOnMobile: true },
    { key: "products", header: "Products", cell: (s) => s.productsCount ?? 0, hideOnMobile: true },
    { key: "created", header: "Applied", cell: (s) => formatDate(s.createdAt), hideOnMobile: true },
    { key: "plan", header: "Plan", cell: (s) => status === "pending" ? (
      <Select className="h-8 w-32" value={plans[s.id] ?? s.plan} onChange={(e) => setPlans((p) => ({ ...p, [s.id]: e.target.value }))} aria-label="Plan">{["basic", "standard", "premium"].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>
    ) : titleCase(s.plan) },
    { key: "status", header: "Status", cell: (s) => <div><StatusPill status={s.status} />{s.decisionReason && <p className="mt-1 text-xs text-ink-600">{s.decisionReason}</p>}</div> },
    {
      key: "act", header: "", cell: (s) => (
        <div className="flex justify-end gap-1">
          {s.status !== "active" && <Button size="sm" loading={busy === `ok-${s.id}`} onClick={() => approve(s)}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {s.status === "pending" && <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setDecision({ store: s, status: "rejected" })} aria-label="Reject"><XCircle className="h-4 w-4" /></Button>}
          {s.status === "active" && <Button size="sm" variant="outline" onClick={() => setDecision({ store: s, status: "suspended" })}><PauseCircle className="h-4 w-4" /> Suspend</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Marketplace stores" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Stores" }]} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={["pending", "active", "suspended", "rejected"].map((s) => ({ value: s, label: titleCase(s) }))} />
      <Card>
        <DataTable columns={columns} rows={data?.data} rowKey={(s) => s.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle={`No ${status} stores`} />
        {data && <Pagination {...data.meta} onPageChange={setPage} />}
      </Card>
      <ReasonDialog open={!!decision} onClose={() => setDecision(null)} title={decision?.status === "rejected" ? `Reject ${decision?.store.name}` : `Suspend ${decision?.store.name}`}
        description="The store owner sees this reason." confirmLabel={decision?.status === "rejected" ? "Reject" : "Suspend"} destructive loading={busy === "decide"}
        onSubmit={async (reason) => { await run("decide", () => api.post(`/admin/stores/${decision?.store.id}/decision`, { status: decision?.status, reason }), "Decision saved."); setDecision(null); refetch(); }} />
    </>
  );
}
