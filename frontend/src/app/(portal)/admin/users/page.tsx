"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { api, ApiError, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card, KpiCard } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import type { User } from "@/types/api";

interface Role { code: string; name: string }

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]),
  role: z.string().min(1, "Choose a role."),
});
type CreateValues = z.infer<typeof createSchema>;

type Pending = { kind: "block" | "unblock" | "delete" | "invite"; user: User } | null;

/** M12 User management (FR-USR-01, FR-USR-05). New accounts receive a set-password invitation. */
export default function UsersPage() {
  const { can, session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { params, update } = useListParams(["q", "role", "status"] as const);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: () => api.get<{ data: Role[] }>("/admin/roles"), staleTime: 60 * 60_000 });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => api.get<Paginated<User, { kpis: { totalUsers: number; pendingApproval: number; blocked: number } }>>("/admin/users", { ...params, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { name: "", email: "", phone: "", role: "" } });

  const createUser = form.handleSubmit(async (values) => {
    try {
      await api.post("/admin/users", { ...values, phone: values.phone || null });
      toast.success(`Account created. An invitation was emailed to ${values.email}.`);
      setCreateOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) Object.entries(e.fieldErrors()).forEach(([f, m]) => form.setError(f as keyof CreateValues, { message: m }));
      else toast.error(e instanceof ApiError ? e.message : "The account could not be created.");
    }
  });

  const runPending = async () => {
    if (!pending) return;
    const { kind, user } = pending;
    setBusy(true);
    try {
      if (kind === "delete") await api.delete(`/admin/users/${user.id}`);
      else await api.post(`/admin/users/${user.id}/${kind === "invite" ? "invite" : kind}`);
      toast.success({ block: "User blocked and signed out.", unblock: "User unblocked.", delete: "User deleted.", invite: "Invitation sent." }[kind]);
      setPending(null);
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const manage = can("users.manage");
  const block = can("users.block");
  const assignable = (roles.data?.data ?? []).filter((r) => r.code !== "super_admin" || session?.user.primaryRole === "super_admin");

  const columns: Column<User>[] = [
    { key: "user", header: "User", cell: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-ink-600">{u.email}</p></div> },
    { key: "role", header: "Role", cell: (u) => u.roles?.[0]?.name ?? u.primaryRole },
    { key: "phone", header: "Phone", cell: (u) => u.phone ?? "—", hideOnMobile: true },
    { key: "last", header: "Last sign-in", cell: (u) => formatDate(u.lastLoginAt), hideOnMobile: true },
    { key: "status", header: "Status", cell: (u) => <StatusPill status={u.status} /> },
    {
      key: "actions",
      header: "",
      cell: (u) =>
        u.id !== session?.user.id && (
          <div className="flex justify-end gap-1">
            {manage && u.status === "pending" && (
              <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "invite", user: u })} aria-label={`Resend invitation to ${u.name}`}><Mail className="h-4 w-4" /></Button>
            )}
            {block && u.status !== "blocked" && (
              <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "block", user: u })} aria-label={`Block ${u.name}`}><Ban className="h-4 w-4" /></Button>
            )}
            {block && u.status === "blocked" && (
              <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "unblock", user: u })} aria-label={`Unblock ${u.name}`}><ShieldCheck className="h-4 w-4" /></Button>
            )}
            {manage && (
              <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setPending({ kind: "delete", user: u })} aria-label={`Delete ${u.name}`}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ),
    },
  ];

  const k = data?.meta.kpis;

  return (
    <>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Users" }]}
        actions={manage && <Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> Add user</Button>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total users" value={k?.totalUsers ?? 0} icon={<Users className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Pending" value={k?.pendingApproval ?? 0} icon={<Mail className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Blocked" value={k?.blocked ?? 0} icon={<Ban className="h-5 w-5" />} loading={isLoading} />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap">
          <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search name, email or phone" />
          <Select className="sm:w-56" value={params.role} onChange={(e) => update({ role: e.target.value })} aria-label="Filter by role">
            <option value="">All roles</option>
            {roles.data?.data.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </Select>
          <Select className="sm:w-40" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(u) => u.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No users match your filters" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add user"
        description="The user receives an email with a link to set their own password."
        footer={<><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={createUser} loading={form.formState.isSubmitting}>Create and send invitation</Button></>}
      >
        <form onSubmit={createUser} noValidate className="space-y-4">
          <Field label="Full name" htmlFor="u-name" error={form.formState.errors.name?.message} required><Input id="u-name" {...form.register("name")} /></Field>
          <Field label="Email" htmlFor="u-email" error={form.formState.errors.email?.message} required><Input id="u-email" type="email" {...form.register("email")} /></Field>
          <Field label="Phone" htmlFor="u-phone" error={form.formState.errors.phone?.message} hint="Optional · +234XXXXXXXXXX"><Input id="u-phone" type="tel" {...form.register("phone")} /></Field>
          <Field label="Role" htmlFor="u-role" error={form.formState.errors.role?.message} required>
            <Select id="u-role" {...form.register("role")}>
              <option value="">Choose…</option>
              {assignable.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        loading={busy}
        destructive={pending?.kind === "delete" || pending?.kind === "block"}
        title={pending ? { block: `Block ${pending.user.name}?`, unblock: `Unblock ${pending.user.name}?`, delete: `Delete ${pending.user.name}?`, invite: `Resend invitation?` }[pending.kind] : ""}
        message={pending ? {
          block: "They are signed out immediately and cannot sign in until unblocked.",
          unblock: "They will be able to sign in again.",
          delete: "The account is deactivated and removed from lists. Its history is kept in the audit log.",
          invite: `A new set-password link will be emailed to ${pending.user.email}.`,
        }[pending.kind] : ""}
        confirmLabel={pending ? { block: "Block", unblock: "Unblock", delete: "Delete", invite: "Send" }[pending.kind] : "Confirm"}
      />
    </>
  );
}
