"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/types/modules";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the product name.").max(120),
  description: z.string().trim().max(1000),
  price: z.coerce.number().positive("Enter a price."),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative.").max(100000),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function ProductsPage() {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["store", "products"], queryFn: () => api.get<{ data: Product[] }>("/store/products") });

  const columns: Column<Product>[] = [
    { key: "name", header: "Product", cell: (p) => <div><p className="font-medium">{p.name}</p>{p.description && <p className="line-clamp-1 text-xs text-ink-600">{p.description}</p>}</div> },
    { key: "price", header: "Price", cell: (p) => formatNaira(p.price.amount, { decimals: true }) },
    { key: "stock", header: "Stock", cell: (p) => <span className={p.stock <= 3 ? "font-medium text-danger-600" : ""}>{p.stock}</span> },
    { key: "status", header: "Status", cell: (p) => <StatusPill status={p.isActive ? "active" : "hidden"} label={p.isActive ? "On sale" : "Hidden"} /> },
    { key: "act", header: "", cell: (p) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setDeleteId(p.id)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></Button></div> },
  ];

  return (
    <>
      <PageHeader title="Products" breadcrumbs={[{ label: "Store", href: "/store" }, { label: "Products" }]} actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add product</Button>} />
      <Card><DataTable columns={columns} rows={data?.data} rowKey={(p) => p.id} loading={isLoading} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No products yet" emptyDescription="Add the items residents can order." /></Card>
      {editing && <ProductModal key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} destructive loading={busy === "del"} title="Delete this product?" message="It will no longer be available to order. Past orders keep their details." confirmLabel="Delete"
        onConfirm={async () => { await run("del", () => api.delete(`/store/products/${deleteId}`), "Product deleted."); setDeleteId(null); refetch(); }} />
    </>
  );
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: (product
      ? { name: product.name, description: product.description ?? "", price: Number(product.price.amount), stock: product.stock, is_active: product.isActive }
      : { name: "", description: "", price: "", stock: 0, is_active: true }) as unknown as Partial<Values>,
  });
  const save = form.handleSubmit(async (v) => {
    try {
      await api.post(product ? `/store/products/${product.id}` : "/store/products", { ...v, description: v.description || null });
      toast.success(product ? "Product updated." : "Product added.");
      onSaved();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error(e instanceof ApiError ? e.message : "The product could not be saved.");
    }
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={product ? `Edit ${product.name}` : "Add product"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={form.formState.isSubmitting}>Save</Button></>}>
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="p-name" error={err.name?.message} required className="sm:col-span-2"><Input id="p-name" {...form.register("name")} /></Field>
        <Field label="Price (₦)" htmlFor="p-price" error={err.price?.message} required><Input id="p-price" type="number" min="1" step="0.01" {...form.register("price")} /></Field>
        <Field label="Stock" htmlFor="p-stock" error={err.stock?.message} required><Input id="p-stock" type="number" min={0} {...form.register("stock")} /></Field>
        <Field label="Description" htmlFor="p-desc" className="sm:col-span-2"><Textarea id="p-desc" rows={2} {...form.register("description")} /></Field>
        <div className="sm:col-span-2"><Checkbox label="On sale (visible to residents)" {...form.register("is_active")} /></div>
      </form>
    </Modal>
  );
}
