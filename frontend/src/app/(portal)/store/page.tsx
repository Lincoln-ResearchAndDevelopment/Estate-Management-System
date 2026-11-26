"use client";

import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Package, ShoppingBag, Truck, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira, titleCase } from "@/lib/format";
import { applyFieldErrors } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import type { Money } from "@/types/api";
import type { Store } from "@/types/modules";

type MyStore = Store & { kpis: { newOrders: number; inProgress: number; deliveredThisMonth: number; salesThisMonth: Money; products: number; lowStock: number } };

const CATEGORIES = ["groceries", "pharmacy", "food", "laundry", "services", "other"];
const schema = z.object({
  name: z.string().trim().min(2, "Enter the store name.").max(100),
  category: z.string().min(1, "Choose a category."),
  description: z.string().trim().max(1000),
  phone: z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]),
  location: z.string().trim().max(150),
});
type Values = z.infer<typeof schema>;

/** M06 store-owner dashboard and store profile. New stores wait for estate approval before going live. */
export default function StoreDashboard() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["store", "mine"], queryFn: () => api.get<{ data: MyStore | null }>("/store") });
  const store = data?.data ?? null;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: store?.name ?? "", category: store?.category ?? "", description: store?.description ?? "", phone: store?.phone ?? "", location: store?.location ?? "" },
  });

  const save = form.handleSubmit(async (v) => {
    try {
      await api.post("/store", { ...v, description: v.description || null, phone: v.phone || null, location: v.location || null });
      toast.success(store ? "Store details saved." : "Store submitted for approval.");
      refetch();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error("The store could not be saved.");
    }
  });
  const err = form.formState.errors;

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;
  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader title={store?.name ?? "Set up your store"} breadcrumbs={[{ label: "Store" }]} />
      {store && (
        <>
          {store.status !== "active" && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-600">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Your store is <strong>{titleCase(store.status)}</strong>. {store.status === "pending" ? "Residents can see it once estate management approves it." : store.decisionReason}</p>
            </div>
          )}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="New orders" value={store.kpis.newOrders} icon={<ShoppingBag className="h-5 w-5" />} href="/store/orders?status=placed" highlight={store.kpis.newOrders > 0} />
            <KpiCard label="In progress" value={store.kpis.inProgress} icon={<Truck className="h-5 w-5" />} href="/store/orders?status=open" />
            <KpiCard label="Sales this month" value={formatNaira(store.kpis.salesThisMonth.amount)} icon={<Wallet className="h-5 w-5" />} subtitle={`${store.kpis.deliveredThisMonth} delivered`} />
            <KpiCard label="Products" value={store.kpis.products} icon={<Package className="h-5 w-5" />} href="/store/products" subtitle={store.kpis.lowStock ? `${store.kpis.lowStock} low on stock` : undefined} />
          </div>
        </>
      )}
      <Card className="max-w-2xl">
        <CardHeader title="Store details" action={store && <StatusPill status={store.status} />} />
        <form onSubmit={save} noValidate className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Store name" htmlFor="st-name" error={err.name?.message} required><Input id="st-name" {...form.register("name")} /></Field>
          <Field label="Category" htmlFor="st-cat" error={err.category?.message} required><Select id="st-cat" {...form.register("category")}><option value="">Choose…</option>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
          <Field label="Phone" htmlFor="st-phone" error={err.phone?.message}><Input id="st-phone" inputMode="tel" {...form.register("phone")} /></Field>
          <Field label="Location in the estate" htmlFor="st-loc" error={err.location?.message}><Input id="st-loc" {...form.register("location")} /></Field>
          <Field label="Description" htmlFor="st-desc" error={err.description?.message} className="sm:col-span-2"><Textarea id="st-desc" rows={3} {...form.register("description")} /></Field>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={form.formState.isSubmitting}>{store ? "Save details" : "Submit for approval"}</Button></div>
        </form>
      </Card>
    </>
  );
}
