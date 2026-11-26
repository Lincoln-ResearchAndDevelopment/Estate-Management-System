"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import type { Order } from "@/types/modules";

const NEXT: Record<string, { to: string; label: string }[]> = {
  placed: [{ to: "accepted", label: "Accept" }],
  accepted: [{ to: "ready", label: "Mark ready" }],
  ready: [{ to: "delivered", label: "Mark delivered" }],
};

/** Incoming orders, refreshed every 20 seconds. Accepting reserves stock; cancelling after acceptance restores it. */
export default function StoreOrdersPage() {
  const { busy, run } = useAction();
  const { params, update } = useListParams(["status"] as const);
  const status = params.status || "open";
  const [refuse, setRefuse] = useState<{ order: Order; to: "rejected" | "cancelled" } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["store", "orders", status, params.page],
    queryFn: () => api.get<Paginated<Order>>("/store/orders", { status, page: params.page }),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  const move = async (o: Order, to: string, reason?: string) => {
    await run(`${o.id}-${to}`, () => api.post(`/store/orders/${o.id}/status`, { status: to, reason: reason ?? null }), `Order ${titleCase(to).toLowerCase()}. The buyer has been notified.`);
    refetch();
  };

  return (
    <>
      <PageHeader title="Orders" breadcrumbs={[{ label: "Store", href: "/store" }, { label: "Orders" }]} />
      <Tabs className="mb-4" value={status} onChange={(v) => update({ status: v })} items={[{ value: "open", label: "Open" }, { value: "placed", label: "New" }, { value: "delivered", label: "Delivered" }, { value: "cancelled", label: "Cancelled" }, { value: "rejected", label: "Rejected" }]} />
      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card> : isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <Card><EmptyState title="No orders here" icon={<ShoppingBag className="h-6 w-6" />} /></Card>
      ) : (
        <div className="space-y-4">
          {data.data.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{o.buyer?.name} <span className="font-mono text-xs text-ink-600">{o.reference}</span></p><p className="text-xs text-ink-600">{formatDateTime(o.createdAt)}{o.buyer?.phone ? ` · ${o.buyer.phone}` : ""}</p></div>
                <StatusPill status={o.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">{o.items.map((i, idx) => <li key={idx} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{formatNaira(i.lineTotal.amount, { decimals: true })}</span></li>)}</ul>
              {o.deliveryNote && <p className="mt-2 rounded-lg bg-canvas p-2 text-sm">Note: {o.deliveryNote}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="font-semibold">{formatNaira(o.total.amount, { decimals: true })}</p>
                <div className="flex flex-wrap gap-2">
                  {(NEXT[o.status] ?? []).map((n) => <Button key={n.to} size="sm" loading={busy === `${o.id}-${n.to}`} onClick={() => move(o, n.to)}>{n.label}</Button>)}
                  {o.status === "placed" && <Button size="sm" variant="outline" onClick={() => setRefuse({ order: o, to: "rejected" })}>Reject</Button>}
                  {["accepted", "ready"].includes(o.status) && <Button size="sm" variant="outline" onClick={() => setRefuse({ order: o, to: "cancelled" })}>Cancel</Button>}
                </div>
              </div>
            </Card>
          ))}
          <Card><Pagination {...data.meta} onPageChange={(page) => update({ page })} /></Card>
        </div>
      )}
      <ReasonDialog open={!!refuse} onClose={() => setRefuse(null)} title={refuse?.to === "rejected" ? "Reject order" : "Cancel order"} description="The buyer sees this reason." confirmLabel={refuse?.to === "rejected" ? "Reject" : "Cancel order"} destructive
        presets={["Out of stock", "Cannot deliver at this time", "Store closed", "Other"]} onSubmit={async (reason) => { if (refuse) await move(refuse.order, refuse.to, reason); setRefuse(null); }} />
    </>
  );
}
