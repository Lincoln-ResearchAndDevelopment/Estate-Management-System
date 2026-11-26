"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Download, Plus } from "lucide-react";
import { API_URL, api, ApiError, type Paginated } from "@/lib/api";
import { formatDate, formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import { HouseholdPicker, type HouseholdOption } from "@/modules/finance/household-picker";
import type { Bill, Service } from "@/types/modules";

export default function BillsPage() {
  const { can } = useAuth();
  const { busy, run } = useAction();
  const { params, update } = useListParams(["q", "status", "service_id"] as const);
  const q = useDebouncedValue(params.q);
  const [issueOpen, setIssueOpen] = useState(false);
  const [voidId, setVoidId] = useState<number | null>(null);
  const [markPaid, setMarkPaid] = useState<Bill | null>(null);
  const [method, setMethod] = useState("bank_transfer");
  const manage = can("finance.manage");

  const services = useQuery({ queryKey: ["finance", "services"], queryFn: () => api.get<{ data: Service[] }>("/finance/services") });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["finance", "bills", { ...params, q }],
    queryFn: () => api.get<Paginated<Bill>>("/finance/bills", { ...params, q, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Bill>[] = [
    { key: "bill", header: "Bill", cell: (b) => <div><p className="font-medium">{b.description}</p><p className="text-xs text-ink-600">{b.reference}{b.periodLabel ? ` · ${b.periodLabel}` : ""}</p></div> },
    { key: "unit", header: "Unit", cell: (b) => b.unit ?? "—" },
    { key: "due", header: "Due", cell: (b) => formatDate(b.dueDate), hideOnMobile: true },
    { key: "amount", header: "Amount", cell: (b) => formatNaira(b.amount.amount, { decimals: true }), hideOnMobile: true },
    { key: "balance", header: "Balance", cell: (b) => formatNaira(b.balance.amount, { decimals: true }) },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    {
      key: "act", header: "", cell: (b) => manage && ["unpaid", "part_paid", "overdue"].includes(b.status) && (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => setMarkPaid(b)}><CheckCircle2 className="h-4 w-4" /> Mark paid</Button>
          {b.status === "unpaid" && <Button size="sm" variant="ghost" className="text-danger-600" aria-label={`Void ${b.reference}`} onClick={() => setVoidId(b.id)}><Ban className="h-4 w-4" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bills" breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Bills" }]}
        actions={<>
          {can("reports.view") && <a href={`${API_URL}/api/v1/reports/export/bills`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50"><Download className="h-4 w-4" /> CSV</a>}
          {manage && <Button onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4" /> Issue bill</Button>}
        </>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Reference, unit or description" />
          <Select className="sm:w-44" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option><option value="open">All open</option>
            {["unpaid", "part_paid", "overdue", "paid", "void"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select className="sm:w-56" value={params.service_id} onChange={(e) => update({ service_id: e.target.value })} aria-label="Service">
            <option value="">All services</option>{services.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(b) => b.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No bills match" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
      {issueOpen && <IssueModal onClose={() => setIssueOpen(false)} onDone={() => { setIssueOpen(false); refetch(); }} />}
      <Modal open={!!markPaid} onClose={() => setMarkPaid(null)} title="Approve as paid"
        description={markPaid ? `Records ${formatNaira(markPaid.balance.amount, { decimals: true })} for ${markPaid.description}, Unit ${markPaid.unit ?? "—"}, issues a receipt and clears the resident's estate pass if nothing else is due.` : undefined}
        footer={<><Button variant="outline" onClick={() => setMarkPaid(null)}>Cancel</Button><Button loading={busy === "paid"} onClick={async () => {
          if (!markPaid) return;
          await run("paid", () => api.post("/finance/payments/record", { household_id: markPaid.householdId, amount: Number(markPaid.balance.amount), method, bill_ids: [markPaid.id], note: `Marked paid from bill ${markPaid.reference}` }), "Bill marked paid and receipt issued.");
          setMarkPaid(null);
          refetch();
        }}>Approve as paid</Button></>}>
        <Field label="How was it paid?" htmlFor="mp-method">
          <Select id="mp-method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="pos">POS</option></Select>
        </Field>
      </Modal>
      <ReasonDialog open={!!voidId} onClose={() => setVoidId(null)} title="Void this bill" description="The resident will no longer owe it. This is recorded in the audit log." confirmLabel="Void bill" destructive loading={busy === "void"}
        presets={["Raised in error", "Raised against the wrong unit", "Waived by estate management", "Other"]}
        onSubmit={async (reason) => { await run("void", () => api.post(`/finance/bills/${voidId}/void`, { reason }), "Bill voided."); setVoidId(null); refetch(); }} />
    </>
  );
}

function IssueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(() => new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!all && households.length === 0) e.household_ids = "Choose at least one household, or bill all households.";
    if (description.trim().length < 3) e.description = "Describe the charge.";
    if (!(Number(amount) > 0)) e.amount = "Enter an amount.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>("/finance/bills", { all_households: all, household_ids: all ? undefined : households.map((h) => h.id), description: description.trim(), amount: Number(amount), due_date: due });
      toast.success(`${res.message} Residents have been notified.`);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      else toast.error(err instanceof ApiError ? err.message : "The bills could not be issued.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Issue a one-off bill" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Issue</Button></>}>
      <div className="space-y-4">
        <Checkbox label="Bill every occupied household" checked={all} onChange={(e) => setAll(e.target.checked)} />
        {!all && <Field label="Households" htmlFor="h-pick" error={errors.household_ids} required><HouseholdPicker id="h-pick" multiple value={households} onChange={setHouseholds} /></Field>}
        <Field label="Description" htmlFor="b-desc" error={errors.description} required><Input id="b-desc" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Gate remote replacement" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₦)" htmlFor="b-amt" error={errors.amount} required><Input id="b-amt" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Due date" htmlFor="b-due" error={errors.due_date} required><Input id="b-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}
