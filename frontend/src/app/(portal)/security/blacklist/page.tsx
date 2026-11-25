"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ShieldCheck } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import type { BlacklistEntry } from "@/types/modules";

const schema = z
  .object({
    list: z.enum(["black", "watch"]),
    subject_type: z.enum(["person", "vehicle"]),
    full_name: z.string().trim().max(120),
    phone: z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]),
    plate_number: z.string().trim().max(20),
    reason: z.string().trim().min(10, "Explain the reason in at least 10 characters.").max(1000),
  })
  .refine((v) => v.subject_type !== "person" || v.full_name.length >= 2, { path: ["full_name"], message: "Enter the person's name." })
  .refine((v) => v.subject_type !== "vehicle" || v.plate_number.length >= 3, { path: ["plate_number"], message: "Enter the plate number." });
type Values = z.infer<typeof schema>;

/** M10 blacklist (refused at the gate) and watchlist (allowed, supervisor notified). */
export default function BlacklistPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();
  const { params, update } = useListParams(["q", "list", "status"] as const);
  const q = useDebouncedValue(params.q);
  const [open, setOpen] = useState(false);
  const [clearId, setClearId] = useState<number | null>(null);
  const manage = can("blacklist.manage");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security", "blacklist", { ...params, q }],
    queryFn: () => api.get<Paginated<BlacklistEntry>>("/security/blacklist", { ...params, q, status: params.status || "active" }),
    placeholderData: keepPreviousData,
  });

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { list: "black", subject_type: "person", full_name: "", phone: "", plate_number: "", reason: "" } });
  const subject = form.watch("subject_type");

  const add = form.handleSubmit(async (v) => {
    try {
      await api.post("/security/blacklist", { ...v, full_name: v.full_name || null, phone: v.phone || null, plate_number: v.plate_number || null });
      toast.success(v.list === "black" ? "Added to the blacklist. Entry will be refused at the gate." : "Added to the watchlist.");
      setOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error("The entry could not be added.");
    }
  });

  const columns: Column<BlacklistEntry>[] = [
    { key: "subject", header: "Subject", cell: (b) => <div><p className="font-medium">{b.fullName ?? b.plateNumber}</p><p className="text-xs text-ink-600">{titleCase(b.subjectType)}{b.phone ? ` · ${b.phone}` : ""}{b.fullName && b.plateNumber ? ` · ${b.plateNumber}` : ""}</p></div> },
    { key: "list", header: "List", cell: (b) => <StatusPill status={b.list} /> },
    { key: "reason", header: "Reason", cell: (b) => <span className="line-clamp-2 text-sm">{b.reason}</span>, hideOnMobile: true },
    { key: "added", header: "Added", cell: (b) => <span className="text-xs">{formatDate(b.createdAt)}<br />{b.addedBy}</span>, hideOnMobile: true },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    { key: "act", header: "", cell: (b) => manage && b.status === "active" && <Button size="sm" variant="outline" onClick={() => setClearId(b.id)}><ShieldCheck className="h-4 w-4" /> Clear</Button> },
  ];

  return (
    <>
      <PageHeader title="Blacklist & watchlist" breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Blacklist" }]} actions={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add entry</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Name, phone or plate" />
          <Select className="sm:w-40" value={params.list} onChange={(e) => update({ list: e.target.value })} aria-label="List"><option value="">Both lists</option><option value="black">Blacklist</option><option value="watch">Watchlist</option></Select>
          <Select className="sm:w-36" value={params.status || "active"} onChange={(e) => update({ status: e.target.value })} aria-label="Status"><option value="active">Active</option><option value="cleared">Cleared</option></Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(b) => b.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No entries" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add to blacklist or watchlist"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={add} loading={form.formState.isSubmitting}>Add entry</Button></>}>
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="List" htmlFor="b-list"><Select id="b-list" {...form.register("list")}><option value="black">Blacklist — refuse entry</option><option value="watch">Watchlist — allow, alert supervisor</option></Select></Field>
          <Field label="Subject" htmlFor="b-type"><Select id="b-type" {...form.register("subject_type")}><option value="person">Person</option><option value="vehicle">Vehicle</option></Select></Field>
          <Field label="Full name" htmlFor="b-name" error={form.formState.errors.full_name?.message} required={subject === "person"}><Input id="b-name" {...form.register("full_name")} /></Field>
          <Field label="Phone" htmlFor="b-phone" error={form.formState.errors.phone?.message}><Input id="b-phone" inputMode="tel" {...form.register("phone")} /></Field>
          <Field label="Plate number" htmlFor="b-plate" error={form.formState.errors.plate_number?.message} required={subject === "vehicle"}><Input id="b-plate" className="uppercase" {...form.register("plate_number")} /></Field>
          <Field label="Reason" htmlFor="b-reason" error={form.formState.errors.reason?.message} required className="sm:col-span-2"><Textarea id="b-reason" rows={3} {...form.register("reason")} /></Field>
        </form>
      </Modal>
      <ReasonDialog open={!!clearId} onClose={() => setClearId(null)} title="Clear this entry" description="The person or vehicle will be allowed through the gate again." confirmLabel="Clear entry" loading={busy === "clear"}
        onSubmit={async (reason) => { await run("clear", () => api.post(`/security/blacklist/${clearId}/clear`, { reason }), "Entry cleared."); setClearId(null); refetch(); }} />
    </>
  );
}
