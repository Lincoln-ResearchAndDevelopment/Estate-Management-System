"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileText, Plus, XCircle } from "lucide-react";
import { API_URL, api, ApiError, type Paginated } from "@/lib/api";
import { formatDateTime, formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import { HouseholdPicker, type HouseholdOption } from "@/modules/finance/household-picker";
import type { Payment } from "@/types/modules";

export default function PaymentsPage() {
  const { can } = useAuth();
  const { busy, run } = useAction();
  const { params, update } = useListParams(["q", "status", "method", "from", "to"] as const);
  const q = useDebouncedValue(params.q);
  const [verify, setVerify] = useState<Payment | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["finance", "payments", { ...params, q }],
    queryFn: () => api.get<Paginated<Payment>>("/finance/payments", { ...params, q, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Payment>[] = [
    { key: "ref", header: "Payment", cell: (p) => <div><p className="font-medium">{p.receiptNumber ?? p.reference}</p><p className="text-xs text-ink-600">{titleCase(p.method)} · {formatDateTime(p.paidAt ?? p.createdAt)}</p></div> },
    { key: "payer", header: "Payer", cell: (p) => <div><p>{p.payer ?? "—"}</p><p className="text-xs text-ink-600">Unit {p.unit ?? "—"}</p></div> },
    { key: "amount", header: "Amount", cell: (p) => <span className="font-medium">{formatNaira(p.amount.amount, { decimals: true })}</span> },
    { key: "status", header: "Status", cell: (p) => <div><StatusPill status={p.status} />{p.verifiedBy && <p className="mt-1 text-xs text-ink-600">by {p.verifiedBy}</p>}</div> },
    {
      key: "act", header: "", cell: (p) => (
        <div className="flex justify-end gap-1">
          {p.proofUrl && <a href={p.proofUrl.replace(/^https?:\/\/[^/]+/, API_URL)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-army-800 hover:bg-army-50"><FileText className="h-4 w-4" /> Proof</a>}
          {p.status === "pending_verification" && can("finance.verify") && (
            <>
              <Button size="sm" onClick={() => setVerify(p)}><CheckCircle2 className="h-4 w-4" /> Verify</Button>
              <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setRejectId(p.id)} aria-label="Reject transfer"><XCircle className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Payments" breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Payments" }]}
        actions={<>
          {can("reports.view") && <a href={`${API_URL}/api/v1/reports/export/payments`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50"><Download className="h-4 w-4" /> CSV</a>}
          {can("finance.manage") && <Button onClick={() => setRecordOpen(true)}><Plus className="h-4 w-4" /> Record payment</Button>}
        </>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap">
          <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Reference, receipt or unit" />
          <Select className="sm:w-52" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>{["pending_verification", "success", "pending", "failed", "rejected"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select className="sm:w-40" value={params.method} onChange={(e) => update({ method: e.target.value })} aria-label="Method">
            <option value="">All methods</option>{["paystack", "bank_transfer", "cash", "pos"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Input type="date" className="sm:w-40" value={params.from} onChange={(e) => update({ from: e.target.value })} aria-label="From date" />
          <Input type="date" className="sm:w-40" value={params.to} onChange={(e) => update({ to: e.target.value })} aria-label="To date" />
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(p) => p.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} emptyTitle="No payments match" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <ConfirmDialog open={!!verify} onClose={() => setVerify(null)} loading={busy === "verify"} title="Verify this transfer?"
        message={verify ? `Confirm ${formatNaira(verify.amount.amount, { decimals: true })} from ${verify.payer ?? "the resident"} has arrived in the estate account. The bills will be marked paid and a receipt issued.` : ""}
        confirmLabel="Verify payment" onConfirm={async () => { await run("verify", () => api.post(`/finance/payments/${verify?.id}/verify`), "Payment verified and receipt issued."); setVerify(null); refetch(); }} />
      <ReasonDialog open={!!rejectId} onClose={() => setRejectId(null)} title="Reject this transfer" description="The resident sees the reason and can submit again." confirmLabel="Reject" destructive loading={busy === "reject"}
        presets={["Funds not received in the estate account", "Amount does not match the proof", "Proof is unreadable", "Other"]}
        onSubmit={async (reason) => { await run("reject", () => api.post(`/finance/payments/${rejectId}/reject`, { reason }), "Transfer rejected."); setRejectId(null); refetch(); }} />
      {recordOpen && <RecordModal onClose={() => setRecordOpen(false)} onDone={() => { setRecordOpen(false); refetch(); }} />}
    </>
  );
}

function RecordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [household, setHousehold] = useState<HouseholdOption[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!household[0]) e.household_id = "Choose the household.";
    if (!(Number(amount) > 0)) e.amount = "Enter the amount received.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post("/finance/payments/record", { household_id: household[0].id, amount: Number(amount), method, note: note || null });
      toast.success("Payment recorded against the oldest open bills and a receipt issued.");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      else toast.error(err instanceof ApiError ? err.message : "The payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Record an offline payment" description="Cash, POS or a transfer confirmed outside the portal." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Record</Button></>}>
      <div className="space-y-4">
        <Field label="Household" htmlFor="r-house" error={errors.household_id} required><HouseholdPicker id="r-house" value={household} onChange={setHousehold} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₦)" htmlFor="r-amt" error={errors.amount} required><Input id="r-amt" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Method" htmlFor="r-method"><Select id="r-method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="pos">POS</option><option value="bank_transfer">Bank transfer</option></Select></Field>
        </div>
        <Field label="Note" htmlFor="r-note"><Textarea id="r-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. POS slip number" /></Field>
      </div>
    </Modal>
  );
}
