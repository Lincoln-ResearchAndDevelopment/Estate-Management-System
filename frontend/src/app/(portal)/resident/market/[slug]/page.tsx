"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import type { Product, Store } from "@/types/modules";

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { busy, run } = useAction();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["market", "store", slug],
    queryFn: () => api.get<{ data: Store & { products: Product[] } }>(`/market/stores/${encodeURIComponent(slug)}`),
  });
  const store = data?.data;
  const products = store?.products ?? [];
  const lines = products.filter((p) => cart[p.id]);
  const total = lines.reduce((sum, p) => sum + Number(p.price.amount) * cart[p.id], 0);

  const setQty = (p: Product, qty: number) => setCart((c) => {
    const next = { ...c };
    const clamped = Math.max(0, Math.min(qty, p.stock, 99));
    if (clamped === 0) delete next[p.id];
    else next[p.id] = clamped;
    return next;
  });

  const placeOrder = async () => {
    if (!store) return;
    const res = await run("order", () => api.post("/market/orders", {
      store_id: store.id,
      items: lines.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
      delivery_note: note || null,
    }), "Order placed. The store will confirm it shortly.");
    if (res) router.push("/resident/orders");
  };

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;
  if (isLoading || !store) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader title={store.name} description={[titleCase(store.category), store.location, store.phone].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: "Marketplace", href: "/resident/market" }, { label: store.name }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {products.length === 0 ? (
            <Card><EmptyState title="This store has no products listed yet" icon={<Package className="h-6 w-6" />} /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((p) => (
                <Card key={p.id} className="flex flex-col p-4">
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{p.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div>
                      <p className="font-semibold">{formatNaira(p.price.amount, { decimals: true })}</p>
                      <p className="text-xs text-ink-600">{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</p>
                    </div>
                    {cart[p.id] ? (
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p, cart[p.id] - 1)} aria-label={`Remove one ${p.name}`}><Minus className="h-4 w-4" /></Button>
                        <span className="w-6 text-center font-medium">{cart[p.id]}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p, cart[p.id] + 1)} disabled={cart[p.id] >= p.stock} aria-label={`Add one ${p.name}`}><Plus className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" disabled={p.stock < 1} onClick={() => setQty(p, 1)}><Plus className="h-4 w-4" /> Add</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader title="Your order" />
          {lines.length === 0 ? (
            <EmptyState title="Your basket is empty" icon={<ShoppingCart className="h-6 w-6" />} />
          ) : (
            <div className="space-y-3 p-5 text-sm">
              {lines.map((p) => (
                <div key={p.id} className="flex justify-between gap-3"><span>{cart[p.id]} × {p.name}</span><span>{formatNaira(Number(p.price.amount) * cart[p.id], { decimals: true })}</span></div>
              ))}
              <div className="flex justify-between border-t border-line pt-3 font-semibold"><span>Total</span><span>{formatNaira(total, { decimals: true })}</span></div>
              <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery note (optional)" aria-label="Delivery note" />
              <p className="text-xs text-ink-600">Pay the store when your order is delivered.</p>
              <Button className="w-full" loading={busy === "order"} onClick={placeOrder}>Place order</Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
