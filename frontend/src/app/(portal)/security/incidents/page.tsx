"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import type { Incident } from "@/types/modules";

const CATEGORIES = ["theft", "suspicious_activity", "trespass", "vandalism", "noise", "fire_hazard", "other"];
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const schema = z.object({
  title: z.string().trim().min(5, "Enter a short title (at least 5 characters).").max(150),
  category: z.string().min(1, "Choose a category."),
  severity: z.enum(SEVERITIES),
  location: z.string().trim().max(150),
  description: z.string().trim().min(10, "Describe what happened.").max(5000),
});
type Values = z.infer<typeof schema>;

/** M08 incident reports with investigation notes. */
export default function IncidentsPage() {
  const toast = useToast();
  const { params, update } = useListParams(["q", "status", "severity"] as const);
  const q = useDebouncedValue(params.q);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security", "incidents", { ...params, q }],
    queryFn: () => api.get<Paginated<Incident>>("/security/incidents", { ...params, q }),
    placeholderData: keepPreviousData,
  });

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", category: "", severity: "medium", location: "", description: "" } });
  const create = form.handleSubmit(async (v) => {
    try {
      await api.post("/security/incidents", { ...v, location: v.location || null });
      toast.success("Incident reported.");
      setOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error("The report could not be saved.");
    }
  });

  const columns: Column<Incident>[] = [
    { key: "t", header: "Incident", cell: (i) => <div><p className="font-medium">{i.title}</p><p className="text-xs text-ink-600">{i.reference} · {titleCase(i.category)}</p></div> },
    { key: "sev", header: "Severity", cell: (i) => <StatusPill status={i.severity} /> },
    { key: "when", header: "Reported", cell: (i) => <span className="text-xs">{formatDateTime(i.createdAt)}<br />{i.reportedBy}</span>, hideOnMobile: true },
    { key: "assigned", header: "Assigned", cell: (i) => i.assignedTo?.name ?? "—", hideOnMobile: true },
    { key: "status", header: "Status", cell: (i) => <StatusPill status={i.status} /> },
  ];

  return (
    <>
      <PageHeader title="Incident reports" breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Incidents" }]} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Report incident</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Search title or reference" />
          <Select className="sm:w-40" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{["open", "investigating", "closed"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
          <Select className="sm:w-40" value={params.severity} onChange={(e) => update({ severity: e.target.value })} aria-label="Severity"><option value="">All severities</option>{SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(i) => i.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No incidents" onRowClick={(i) => setDetailId(i.id)} />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Report an incident" size="lg"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={form.formState.isSubmitting}>Save report</Button></>}>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Title" htmlFor="i-title" error={form.formState.errors.title?.message} required className="sm:col-span-2"><Input id="i-title" {...form.register("title")} /></Field>
          <Field label="Category" htmlFor="i-cat" error={form.formState.errors.category?.message} required>
            <Select id="i-cat" {...form.register("category")}><option value="">Choose…</option>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>
          </Field>
          <Field label="Severity" htmlFor="i-sev"><Select id="i-sev" {...form.register("severity")}>{SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
          <Field label="Location" htmlFor="i-loc" className="sm:col-span-2"><Input id="i-loc" placeholder="Street, unit or landmark" {...form.register("location")} /></Field>
          <Field label="What happened" htmlFor="i-desc" error={form.formState.errors.description?.message} required className="sm:col-span-2"><Textarea id="i-desc" rows={5} {...form.register("description")} /></Field>
        </form>
      </Modal>
      {detailId && <IncidentModal id={detailId} onClose={() => setDetailId(null)} onChanged={() => refetch()} />}
    </>
  );
}

function IncidentModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { busy, run } = useAction();
  const [note, setNote] = useState("");
  const { data, refetch } = useQuery({ queryKey: ["security", "incident", id], queryFn: () => api.get<{ data: Incident }>(`/security/incidents/${id}`) });
  const officers = useQuery({ queryKey: ["security", "officers"], queryFn: () => api.get<{ data: { id: number; name: string }[] }>("/security/officers"), staleTime: 300_000 });
  const i = data?.data;

  const patch = async (body: Record<string, unknown>, msg: string) => {
    await run("patch", () => api.patch(`/security/incidents/${id}`, body), msg);
    refetch();
    onChanged();
  };
  const addNote = async () => {
    if (note.trim().length < 2) return;
    const res = await run("note", () => api.post(`/security/incidents/${id}/notes`, { body: note.trim() }));
    if (res !== undefined) {
      setNote("");
      refetch();
    }
  };

  return (
    <Modal open onClose={onClose} title={i ? `${i.reference} · ${i.title}` : "Incident"} size="lg">
      {!i ? <p className="text-sm text-ink-600">Loading…</p> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><StatusPill status={i.status} /><StatusPill status={i.severity} /><span className="text-ink-600">{titleCase(i.category)}{i.location ? ` · ${i.location}` : ""}</span></div>
          <p className="whitespace-pre-line">{i.description}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status" htmlFor="d-status"><Select id="d-status" value={i.status} disabled={busy === "patch"} onChange={(e) => patch({ status: e.target.value }, "Status updated.")}>{["open", "investigating", "closed"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
            <Field label="Severity" htmlFor="d-sev"><Select id="d-sev" value={i.severity} disabled={busy === "patch"} onChange={(e) => patch({ severity: e.target.value }, "Severity updated.")}>{SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
            <Field label="Assigned to" htmlFor="d-assign"><Select id="d-assign" value={i.assignedTo?.id ?? ""} disabled={busy === "patch"} onChange={(e) => patch({ assigned_to: e.target.value ? Number(e.target.value) : null }, "Assignment updated.")}><option value="">Unassigned</option>{officers.data?.data.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-2 font-medium">Investigation notes</p>
            <ul className="space-y-2">{i.notes.map((n) => <li key={n.id} className="rounded-lg bg-canvas px-3 py-2"><p className="text-xs text-ink-600">{n.author} · {formatDateTime(n.createdAt)}</p><p>{n.body}</p></li>)}</ul>
            <div className="mt-3 flex gap-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" aria-label="New note" /><Button onClick={addNote} loading={busy === "note"}>Add</Button></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
