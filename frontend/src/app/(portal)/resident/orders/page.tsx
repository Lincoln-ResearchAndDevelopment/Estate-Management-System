"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import type { Order } from "@/types/modules";
import { MarketplaceTabs } from "@/components/shared/link-tabs";

/** Orders the resident placed with estate stores, refreshed while any order is in progress. */
export default function MyOrdersPage() {
  const { busy, run } = useAction();
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["market", "orders", page],
    queryFn: () => api.get<Paginated<Order>>("/market/orders", { page }),
    refetchInterval: (q) => (q.state.data?.data.some((o) => ["placed", "accepted", "ready"].includes(o.status)) ? 20_000 : false),
  });

  const cancel = async () => {
    if (!cancelId) return;
    await run("cancel", () => api.post(`/market/orders/${cancelId}/cancel`), "Order cancelled.");
    setCancelId(null);
    refetch();
  };

  return (
    <>
      <PageHeader title="My orders" breadcrumbs={[{ label: "Marketplace", href: "/resident/market" }, { label: "My orders" }]} />
      <MarketplaceTabs />
      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card> : isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <Card><EmptyState title="No orders yet" icon={<Package className="h-6 w-6" />} /></Card>
      ) : (
        <div className="space-y-4">
          {data.data.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.store?.name} <span className="font-mono text-xs text-ink-600">{o.reference}</span></p>
                  <p className="text-xs text-ink-600">{formatDateTime(o.createdAt)}{o.store?.phone ? ` · ${o.store.phone}` : ""}</p>
                </div>
                <StatusPill status={o.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.items.map((i, idx) => <li key={idx} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{formatNaira(i.lineTotal.amount, { decimals: true })}</span></li>)}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <p className="font-semibold">{formatNaira(o.total.amount, { decimals: true })} <span className="text-xs font-normal text-ink-600">· pay on delivery</span></p>
                {o.status === "placed" && <Button size="sm" variant="outline" onClick={() => setCancelId(o.id)}>Cancel order</Button>}
              </div>
              {o.statusReason && <p className="mt-2 text-sm text-danger-600">{o.statusReason}</p>}
            </Card>
          ))}
          <Card><Pagination {...data.meta} onPageChange={setPage} /></Card>
        </div>
      )}
      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={cancel} loading={busy === "cancel"} title="Cancel this order?" message="The store will be told you cancelled." confirmLabel="Cancel order" destructive />
    </>
  );
}
