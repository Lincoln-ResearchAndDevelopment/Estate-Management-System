"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarCheck, CreditCard, FlaskConical, Printer, Receipt as ReceiptIcon, Wallet } from "lucide-react";
import { api, ApiError, toFormData, type Paginated } from "@/lib/api";
import { formatDate, formatDateTime, formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, KpiCard } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { FileInput } from "@/components/shared/file-input";
import type { Money } from "@/types/api";
import type { Bill, Payment, Receipt } from "@/types/modules";

interface Summary {
  balance: Money;
  overdue: Money;
  paidThisYear: Money;
  bills: Bill[];
  testMode: boolean;
  bankDetails: { bankName?: string; accountName?: string; accountNumber?: string } | null;
}

const OPEN = ["unpaid", "part_paid", "overdue"];

interface MonthsData {
  monthlyCharges: { name: string; amount: Money }[];
  monthlyTotal: Money;
  months: { period: string; label: string; status: "paid" | "unpaid" | "part_paid" | "overdue" | "not_billed"; amount: Money; balance: Money; billIds: number[] }[];
}

/** M05 resident finance: bills, online payment, bank-transfer proof and receipts. */
export default function ResidentFinancePage() {
  const toast = useToast();
  const { busy, run } = useAction();
  const [tab, setTab] = useState("months");
  const [months, setMonths] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [transfer, setTransfer] = useState<{ billIds: number[]; amount: number } | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);

  const summary = useQuery({ queryKey: ["resident", "finance"], queryFn: () => api.get<{ data: Summary }>("/resident/finance") });
  const monthly = useQuery({
    queryKey: ["resident", "months"],
    queryFn: () => api.get<{ data: MonthsData }>("/resident/months"),
    enabled: tab === "months",
  });
  const payableMonths = (monthly.data?.data.months ?? []).filter((m) => m.status !== "paid");
  const monthsTotal = payableMonths.filter((m) => months.includes(m.period)).reduce((sum, m) => sum + Number(m.balance.amount), 0);
  const toggleMonth = (period: string) => setMonths((cur) => (cur.includes(period) ? cur.filter((x) => x !== period) : [...cur, period]));

  /** Turns the chosen months into bills (raising upcoming months on demand), then pays them. */
  const payMonths = async (how: "online" | "transfer") => {
    const prepared = await run(`m-${how}`, () => api.post<{ data: { billIds: number[]; total: { amount: string } } }>("/resident/bills/months", { periods: [...months].sort() }));
    if (!prepared) return;
    if (how === "transfer") return setTransfer({ billIds: prepared.data.billIds, amount: Number(prepared.data.total.amount) });
    const res = await run("pay", () => api.post<{ data: { authorizationUrl: string } }>("/resident/payments/initialize", { bill_ids: prepared.data.billIds }));
    if (res) window.location.assign(res.data.authorizationUrl);
  };

  const payments = useQuery({
    queryKey: ["resident", "payments", page],
    queryFn: () => api.get<Paginated<Payment>>("/resident/payments", { page, pageSize: 10 }),
    enabled: tab === "payments",
  });
  const s = summary.data?.data;
  const openBills = useMemo(() => (s?.bills ?? []).filter((b) => OPEN.includes(b.status)), [s]);
  const selectedTotal = openBills.filter((b) => selected.includes(b.id)).reduce((sum, b) => sum + Number(b.balance.amount), 0);

  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const payOnline = async () => {
    const res = await run("pay", () => api.post<{ data: { authorizationUrl: string } }>("/resident/payments/initialize", { bill_ids: selected }));
    if (res) window.location.assign(res.data.authorizationUrl);
  };

  const billColumns: Column<Bill>[] = [
    {
      key: "pick",
      header: "",
      cell: (b) =>
        OPEN.includes(b.status) ? (
          <input type="checkbox" className="h-4 w-4 accent-army-800" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} aria-label={`Select ${b.description}`} />
        ) : null,
    },
    { key: "desc", header: "Bill", cell: (b) => <div><p className="font-medium">{b.description}</p><p className="text-xs text-ink-600">{b.reference}{b.periodLabel ? ` · ${b.periodLabel}` : ""}</p></div> },
    { key: "due", header: "Due", cell: (b) => formatDate(b.dueDate) },
    { key: "amount", header: "Amount", cell: (b) => formatNaira(b.amount.amount, { decimals: true }), hideOnMobile: true },
    { key: "balance", header: "Balance", cell: (b) => <span className="font-medium">{formatNaira(b.balance.amount, { decimals: true })}</span> },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
  ];

  const paymentColumns: Column<Payment>[] = [
    { key: "ref", header: "Payment", cell: (p) => <div><p className="font-medium">{p.receiptNumber ?? p.reference}</p><p className="text-xs text-ink-600">{titleCase(p.method)}</p></div> },
    { key: "date", header: "Date", cell: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
    { key: "amount", header: "Amount", cell: (p) => formatNaira(p.amount.amount, { decimals: true }) },
    { key: "status", header: "Status", cell: (p) => <div><StatusPill status={p.status} />{p.rejectionReason && <p className="mt-1 text-xs text-danger-600">{p.rejectionReason}</p>}</div> },
    { key: "receipt", header: "", cell: (p) => p.status === "success" && <Button size="sm" variant="outline" onClick={() => setReceiptId(p.id)}><ReceiptIcon className="h-4 w-4" /> Receipt</Button> },
  ];

  if (summary.error) return <Card><ErrorState message={(summary.error as Error).message} onRetry={() => summary.refetch()} /></Card>;

  return (
    <>
      <PageHeader title="Finance" description="Your bills, monthly charges and payments." breadcrumbs={[{ label: "Dashboard", href: "/resident" }, { label: "Finance" }]} />
      {s?.testMode && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-600">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Test payment mode.</strong> No Paystack key is configured, so online payments open a test checkout and no real money moves.</p>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Outstanding balance" value={formatNaira(s?.balance.amount)} icon={<Wallet className="h-5 w-5" />} loading={summary.isLoading} />
        <KpiCard label="Overdue" value={formatNaira(s?.overdue.amount)} icon={<Banknote className="h-5 w-5" />} loading={summary.isLoading} highlight={Number(s?.overdue.amount ?? 0) > 0} />
        <KpiCard label={`Paid in ${new Date().getFullYear()}`} value={formatNaira(s?.paidThisYear.amount)} icon={<ReceiptIcon className="h-5 w-5" />} loading={summary.isLoading} />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "months", label: "Pay by month" }, { value: "bills", label: "Bills", count: openBills.length }, { value: "payments", label: "Payment history" }]} />

      {tab === "months" ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-ink-600">
              <p>Monthly charge: <strong className="text-ink-900">{formatNaira(monthly.data?.data.monthlyTotal.amount, { decimals: true })}</strong>{monthly.data?.data.monthlyCharges.length ? ` (${monthly.data.data.monthlyCharges.map((c) => `${c.name} ${formatNaira(c.amount.amount)}`).join(" + ")})` : ""}</p>
              <p>{months.length ? <>Selected <strong className="text-ink-900">{months.length}</strong> month(s) · <strong className="text-ink-900">{formatNaira(monthsTotal, { decimals: true })}</strong></> : "Tick the months you want to pay. You can pay ahead for up to 12 months."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!months.length} loading={busy === "m-transfer"} onClick={() => payMonths("transfer")}><Banknote className="h-4 w-4" /> I paid by transfer</Button>
              <Button disabled={!months.length} loading={busy === "m-online" || busy === "pay"} onClick={() => payMonths("online")}><CreditCard className="h-4 w-4" /> Pay online</Button>
            </div>
          </div>
          {monthly.isLoading ? <div className="p-5 text-sm text-ink-600">Loading months…</div> : monthly.error ? <div className="p-5 text-sm text-danger-600">{(monthly.error as Error).message}</div> : !monthly.data?.data.monthlyCharges.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-ink-600"><CalendarCheck className="h-6 w-6" />The estate has not set a monthly charge yet.</div>
          ) : (
            <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {monthly.data.data.months.map((m) => {
                const paid = m.status === "paid";
                const checked = months.includes(m.period);
                return (
                  <li key={m.period}>
                    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 ${paid ? "cursor-default border-success-600/30 bg-success-50" : checked ? "border-army-800 bg-army-50" : "border-line hover:bg-canvas"}`}>
                      <span className="flex items-center gap-3">
                        <input type="checkbox" className="h-4 w-4 accent-army-800" disabled={paid} checked={paid || checked} onChange={() => toggleMonth(m.period)} aria-label={`Pay for ${m.label}`} />
                        <span>
                          <span className="block font-medium">{m.label}</span>
                          <span className="block text-xs text-ink-600">{paid ? "Paid" : formatNaira(m.balance.amount, { decimals: true })}</span>
                        </span>
                      </span>
                      <StatusPill status={m.status} label={m.status === "not_billed" ? "Not yet billed" : undefined} tone={m.status === "not_billed" ? "neutral" : undefined} />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : tab === "bills" ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-600">
              {selected.length ? <>Selected <strong className="text-ink-900">{selected.length}</strong> bill(s) · <strong className="text-ink-900">{formatNaira(selectedTotal, { decimals: true })}</strong></> : "Select the bills you want to pay."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!selected.length} onClick={() => setTransfer({ billIds: selected, amount: selectedTotal })}><Banknote className="h-4 w-4" /> I paid by transfer</Button>
              <Button disabled={!selected.length} loading={busy === "pay"} onClick={payOnline}><CreditCard className="h-4 w-4" /> Pay online</Button>
            </div>
          </div>
          <DataTable columns={billColumns} rows={s?.bills} rowKey={(b) => b.id} loading={summary.isLoading} emptyTitle="You have no bills" emptyDescription="Service charges appear here when finance raises them." />
        </Card>
      ) : (
        <Card>
          <DataTable columns={paymentColumns} rows={payments.data?.data} rowKey={(p) => p.id} loading={payments.isLoading || payments.isFetching} error={payments.error as Error | null} onRetry={() => payments.refetch()} emptyTitle="No payments yet" />
          {payments.data && <Pagination {...payments.data.meta} onPageChange={setPage} />}
        </Card>
      )}

      {transfer && (
        <TransferModal
          bankDetails={s?.bankDetails ?? null}
          billIds={transfer.billIds}
          amount={transfer.amount}
          onClose={() => setTransfer(null)}
          onDone={() => {
            toast.success("Transfer submitted. Finance will verify it, then your bills are marked paid and your estate pass shows Cleared.");
            setTransfer(null);
            setSelected([]);
            setMonths([]);
            monthly.refetch();
            summary.refetch();
            setTab("payments");
          }}
        />
      )}
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  );
}

function TransferModal({ bankDetails, billIds, amount, onClose, onDone }: { bankDetails: Summary["bankDetails"]; billIds: number[]; amount: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(amount.toFixed(2));
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!(Number(value) > 0)) next.amount = "Enter the amount you transferred.";
    if (!proof) next.proof = "Upload the transfer receipt or screenshot.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.post("/resident/payments/transfer", toFormData({ amount: value, bill_ids: billIds, proof, note: note || undefined }));
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) setErrors(e.fieldErrors());
      else toast.error(e instanceof ApiError ? e.message : "The transfer could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Report a bank transfer" description="Finance checks the transfer against the estate account before the bills are marked paid."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Submit for verification</Button></>}>
      <div className="space-y-4">
        {bankDetails ? (
          <dl className="grid gap-2 rounded-lg bg-army-50 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Bank</dt><dd className="font-medium">{bankDetails.bankName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Account name</dt><dd className="font-medium">{bankDetails.accountName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Account number</dt><dd className="font-mono font-semibold">{bankDetails.accountNumber ?? "—"}</dd></div>
          </dl>
        ) : (
          <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-600">The estate bank account has not been published yet. Contact the estate office before transferring.</p>
        )}
        <Field label="Amount transferred (₦)" htmlFor="t-amount" error={errors.amount} required>
          <Input id="t-amount" type="number" min="1" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <FileInput label="Proof of payment" accept=".pdf,.jpg,.jpeg,.png" maxMb={5} value={proof} onChange={setProof} error={errors.proof} hint="PDF, JPG or PNG up to 5 MB" required />
        <Field label="Note (optional)" htmlFor="t-note" error={errors.note}>
          <Textarea id="t-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Transfer from Access Bank, sender name" />
        </Field>
      </div>
    </Modal>
  );
}

function ReceiptModal({ paymentId, onClose }: { paymentId: number; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["resident", "receipt", paymentId], queryFn: () => api.get<{ data: Receipt }>(`/resident/receipts/${paymentId}`) });
  const r = data?.data;

  return (
    <Modal open onClose={onClose} title="Payment receipt" size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()} disabled={!r}><Printer className="h-4 w-4" /> Print</Button></>}>
      {isLoading ? <p className="text-sm text-ink-600">Loading receipt…</p> : error || !r ? <ErrorState message="The receipt could not be loaded." /> : (
        <div className="printable space-y-4 text-sm">
          <div className="flex items-start justify-between border-b border-line pb-3">
            <div>
              <p className="font-display text-lg font-semibold">{r.estate}</p>
              <p className="text-ink-600">Official payment receipt</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold">{r.receiptNumber}</p>
              <p className="text-ink-600">{formatDateTime(r.paidAt)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-xs text-ink-600">Paid by</dt><dd className="font-medium">{r.payer ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-600">Unit</dt><dd className="font-medium">{r.unit ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-600">Method</dt><dd className="font-medium">{titleCase(r.method)}</dd></div>
            <div><dt className="text-xs text-ink-600">Reference</dt><dd className="font-mono">{r.reference}</dd></div>
          </dl>
          <table className="w-full text-left">
            <thead className="border-b border-line text-xs uppercase text-ink-600"><tr><th className="py-2">Item</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {r.allocations.map((a) => <tr key={a.billId} className="border-b border-line"><td className="py-2">{a.description ?? `Bill #${a.billId}`}</td><td className="py-2 text-right">{formatNaira(a.amount.amount, { decimals: true })}</td></tr>)}
            </tbody>
            <tfoot><tr><td className="py-2 font-semibold">Total paid</td><td className="py-2 text-right font-semibold">{formatNaira(r.amount.amount, { decimals: true })}</td></tr></tfoot>
          </table>
          <p className="text-xs text-ink-600">Verify this receipt at <span className="font-mono">{r.verifyUrl}</span></p>
        </div>
      )}
    </Modal>
  );
}
