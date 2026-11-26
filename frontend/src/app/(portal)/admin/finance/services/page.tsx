"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatNaira, titleCase } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/modules/auth/auth-provider";
import { HouseholdPicker, type HouseholdOption } from "@/modules/finance/household-picker";
import type { Service } from "@/types/modules";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100),
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{2,30}$/, "Use 2–30 letters, numbers, dashes or underscores."),
  description: z.string().trim().max(1000),
  amount: z.coerce.number().positive("Enter the charge amount."),
  frequency: z.enum(["monthly", "quarterly", "yearly", "one_off"]),
  applies_to: z.enum(["all", "selected"]),
  auto_bill: z.boolean(),
  due_days: z.coerce.number().int().min(0).max(120),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** M05 service charges: recurring charges billed automatically each period (scheduler) or on demand. */
export default function ServicesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [billNow, setBillNow] = useState<Service | null>(null);
  const manage = can("finance.manage");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["finance", "services"], queryFn: () => api.get<{ data: Service[] }>("/finance/services") });

  const columns: Column<Service>[] = [
    { key: "name", header: "Service", cell: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-600">{s.code}</p></div> },
    { key: "amount", header: "Amount", cell: (s) => formatNaira(s.amount.amount, { decimals: true }) },
    { key: "freq", header: "Frequency", cell: (s) => titleCase(s.frequency) },
    { key: "applies", header: "Applies to", cell: (s) => (s.appliesTo === "all" ? "All households" : `${s.householdsCount ?? 0} household(s)`), hideOnMobile: true },
    { key: "auto", header: "Auto-bill", cell: (s) => (s.autoBill ? `Yes · due in ${s.dueDays} days` : "No"), hideOnMobile: true },
    { key: "status", header: "Status", cell: (s) => <StatusPill status={s.isActive ? "active" : "inactive"} /> },
    {
      key: "act", header: "", cell: (s) => manage && (
        <div className="flex justify-end gap-1">
          {s.isActive && <Button size="sm" variant="outline" onClick={() => setBillNow(s)}><Send className="h-4 w-4" /> Bill now</Button>}
          <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Services & charges" description="Recurring charges are billed automatically at the start of each period. Billing twice in one period never creates duplicates."
        breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Services" }]} actions={manage && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New service</Button>} />
      <Card>
        <DataTable columns={columns} rows={data?.data} rowKey={(s) => s.id} loading={isLoading} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No services yet" emptyDescription="Create the estate service charge to start billing." />
      </Card>
      {editing && <ServiceModal key={editing === "new" ? "new" : editing.id} service={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
      <ConfirmDialog open={!!billNow} onClose={() => setBillNow(null)} loading={busy === "bill"} title={`Bill ${billNow?.name} now?`}
        message="Bills for the current period are raised for every household this service applies to. Households already billed this period are skipped."
        confirmLabel="Raise bills" onConfirm={async () => {
          const res = await run("bill", () => api.post<{ message: string }>(`/finance/services/${billNow?.id}/bill-now`));
          if (res) toast.success(res.message);
          setBillNow(null);
        }} />
    </>
  );
}

function ServiceModal({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [households, setHouseholds] = useState<HouseholdOption[]>(() => (service?.householdIds ?? []).map((id) => ({ id, unit: `Household #${id}`, head: null })));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: (service
      ? { name: service.name, code: service.code, description: service.description ?? "", amount: Number(service.amount.amount), frequency: service.frequency, applies_to: service.appliesTo, auto_bill: service.autoBill, due_days: service.dueDays, is_active: service.isActive }
      : { name: "", code: "", description: "", amount: "", frequency: "monthly", applies_to: "all", auto_bill: true, due_days: 14, is_active: true }) as unknown as Partial<Values>,
  });
  const appliesTo = form.watch("applies_to");

  const save = form.handleSubmit(async (v) => {
    const body = { ...v, description: v.description || null, household_ids: v.applies_to === "selected" ? households.map((h) => h.id) : [] };
    try {
      if (service) await api.put(`/finance/services/${service.id}`, body);
      else await api.post("/finance/services", body);
      toast.success(service ? "Service updated." : "Service created.");
      onSaved();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error(e instanceof ApiError ? e.message : "The service could not be saved.");
    }
  });

  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={service ? `Edit ${service.name}` : "New service"} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={form.formState.isSubmitting}>Save</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" htmlFor="s-name" error={err.name?.message} required><Input id="s-name" {...form.register("name")} /></Field>
        <Field label="Code" htmlFor="s-code" error={err.code?.message} required><Input id="s-code" className="uppercase" {...form.register("code")} /></Field>
        <Field label="Amount (₦)" htmlFor="s-amount" error={err.amount?.message} required><Input id="s-amount" type="number" min="1" step="0.01" {...form.register("amount")} /></Field>
        <Field label="Frequency" htmlFor="s-freq"><Select id="s-freq" {...form.register("frequency")}>{["monthly", "quarterly", "yearly", "one_off"].map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}</Select></Field>
        <Field label="Days until due" htmlFor="s-due" error={err.due_days?.message}><Input id="s-due" type="number" min={0} max={120} {...form.register("due_days")} /></Field>
        <Field label="Applies to" htmlFor="s-applies"><Select id="s-applies" {...form.register("applies_to")}><option value="all">All households</option><option value="selected">Selected households</option></Select></Field>
        {appliesTo === "selected" && <Field label="Households" htmlFor="s-house" className="sm:col-span-2"><HouseholdPicker id="s-house" multiple value={households} onChange={setHouseholds} /></Field>}
        <Field label="Description" htmlFor="s-desc" className="sm:col-span-2"><Textarea id="s-desc" rows={2} {...form.register("description")} /></Field>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <Checkbox label="Bill automatically each period" {...form.register("auto_bill")} />
          <Checkbox label="Active" {...form.register("is_active")} />
        </div>
      </form>
    </Modal>
  );
}
