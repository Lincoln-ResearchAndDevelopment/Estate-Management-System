"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { api, ApiError, type Paginated } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import type { StaffMember } from "@/types/modules";

const DEPARTMENTS = ["security", "maintenance", "sanitation", "administration", "other"];
const schema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name.").max(120),
  phone: z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]),
  job_title: z.string().trim().min(2, "Enter the job title.").max(80),
  department: z.string().min(1, "Choose a department."),
  employment_type: z.enum(["full_time", "part_time", "contract"]),
  hired_on: z.string(),
  notes: z.string().trim().max(2000),
  create_login: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** M11 staff records. Security staff can be given a portal login (they receive an invitation email). */
export default function StaffPage() {
  const { can } = useAuth();
  const { busy, run } = useAction();
  const { params, update } = useListParams(["q", "department", "status"] as const);
  const q = useDebouncedValue(params.q);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [suspendId, setSuspendId] = useState<number | null>(null);
  const manage = can("staff.manage");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["staff", { ...params, q }],
    queryFn: () => api.get<Paginated<StaffMember>>("/staff", { ...params, q }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<StaffMember>[] = [
    { key: "name", header: "Staff member", cell: (s) => <div><p className="font-medium">{s.fullName}</p><p className="text-xs text-ink-600">{s.staffCode}{s.hasLogin ? " · portal access" : ""}</p></div> },
    { key: "role", header: "Role", cell: (s) => <div><p>{s.jobTitle}</p><p className="text-xs text-ink-600">{titleCase(s.department)} · {titleCase(s.employmentType)}</p></div> },
    { key: "contact", header: "Contact", cell: (s) => <span className="text-sm">{s.phone ?? s.email ?? "—"}</span>, hideOnMobile: true },
    { key: "hired", header: "Hired", cell: (s) => formatDate(s.hiredOn), hideOnMobile: true },
    { key: "status", header: "Status", cell: (s) => <StatusPill status={s.status} /> },
    {
      key: "act", header: "", cell: (s) => manage && (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.fullName}`}><Pencil className="h-4 w-4" /></Button>
          {s.status === "active"
            ? <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setSuspendId(s.id)} aria-label={`Suspend ${s.fullName}`}><UserX className="h-4 w-4" /></Button>
            : <Button size="sm" variant="ghost" onClick={async () => { await run(`a-${s.id}`, () => api.post(`/staff/${s.id}/status`, { status: "active" }), "Staff member reactivated."); refetch(); }} aria-label={`Reactivate ${s.fullName}`}><UserCheck className="h-4 w-4" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Staff" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Staff" }]} actions={manage && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add staff</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Name, code or job title" />
          <Select className="sm:w-48" value={params.department} onChange={(e) => update({ department: e.target.value })} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}</Select>
          <Select className="sm:w-40" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{["active", "suspended", "deactivated"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(s) => s.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No staff records" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
      {editing && <StaffModal key={editing === "new" ? "new" : editing.id} staff={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
      <ReasonDialog open={!!suspendId} onClose={() => setSuspendId(null)} title="Suspend staff member" description="Their portal access (if any) is blocked until they are reactivated." confirmLabel="Suspend" destructive loading={busy === "suspend"}
        onSubmit={async (reason) => { await run("suspend", () => api.post(`/staff/${suspendId}/status`, { status: "suspended", reason }), "Staff member suspended."); setSuspendId(null); refetch(); }} />
    </>
  );
}

function StaffModal({ staff, onClose, onSaved }: { staff: StaffMember | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: staff?.fullName ?? "", phone: staff?.phone ?? "", email: staff?.email ?? "", job_title: staff?.jobTitle ?? "",
      department: staff?.department ?? "", employment_type: (staff?.employmentType as Values["employment_type"]) ?? "full_time",
      hired_on: staff?.hiredOn ?? "", notes: staff?.notes ?? "", create_login: false,
    },
  });
  const createLogin = form.watch("create_login");
  const save = form.handleSubmit(async (v) => {
    const body = { ...v, phone: v.phone || null, email: v.email || null, hired_on: v.hired_on || null, notes: v.notes || null };
    try {
      if (staff) await api.put(`/staff/${staff.id}`, body);
      else await api.post("/staff", body);
      toast.success(staff ? "Staff record updated." : v.create_login ? "Staff added. A portal invitation was emailed." : "Staff added.");
      onSaved();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error(e instanceof ApiError ? e.message : "The record could not be saved.");
    }
  });
  const err = form.formState.errors;

  return (
    <Modal open onClose={onClose} title={staff ? `Edit ${staff.fullName}` : "Add staff member"} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={form.formState.isSubmitting}>Save</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" htmlFor="st-name" error={err.full_name?.message} required><Input id="st-name" {...form.register("full_name")} /></Field>
        <Field label="Job title" htmlFor="st-title" error={err.job_title?.message} required><Input id="st-title" {...form.register("job_title")} /></Field>
        <Field label="Department" htmlFor="st-dept" error={err.department?.message} required><Select id="st-dept" {...form.register("department")}><option value="">Choose…</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}</Select></Field>
        <Field label="Employment type" htmlFor="st-type"><Select id="st-type" {...form.register("employment_type")}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option></Select></Field>
        <Field label="Phone" htmlFor="st-phone" error={err.phone?.message}><Input id="st-phone" inputMode="tel" {...form.register("phone")} /></Field>
        <Field label="Email" htmlFor="st-email" error={err.email?.message} required={createLogin}><Input id="st-email" type="email" {...form.register("email")} /></Field>
        <Field label="Hired on" htmlFor="st-hired" error={err.hired_on?.message}><Input id="st-hired" type="date" {...form.register("hired_on")} /></Field>
        <Field label="Notes" htmlFor="st-notes" className="sm:col-span-2"><Textarea id="st-notes" rows={2} {...form.register("notes")} /></Field>
        {!staff && <div className="sm:col-span-2"><Checkbox label="Give this person a portal login (security staff get the Security portal; others the staff view). An invitation is emailed." {...form.register("create_login")} /></div>}
      </form>
    </Modal>
  );
}
