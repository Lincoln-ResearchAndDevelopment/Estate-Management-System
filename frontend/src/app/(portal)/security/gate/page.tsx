"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, DoorOpen, LogIn, LogOut, Plane, ScanLine, Search, UserCheck, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatNaira, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { QrScanner } from "@/modules/access/qr-scanner";
import type { Money } from "@/types/api";
import type { AwayNotice, BlacklistEntry, VisitorPass } from "@/types/modules";

interface VisitorCheck { kind: "visitor"; valid: boolean; reason: string | null; pass: VisitorPass; watchlist: BlacklistEntry | null }
interface ResidentCheck {
  kind: "resident";
  valid: true;
  resident: { name: string; relationship: string | null; phone: string | null; householdId: number; unit: string | null; street: string | null };
  cleared: boolean;
  outstanding: Money;
}

const blankManual = { direction: "in", subject_type: "visitor", person_name: "", phone: "", plate_number: "", note: "" };

/** M09/M10 gate control: verify visitor codes, record entries and exits, screen against the blacklist. */
export default function GatePage() {
  const toast = useToast();
  const { busy, run } = useAction();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VisitorCheck | null>(null);
  const [resident, setResident] = useState<ResidentCheck | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manual, setManual] = useState(blankManual);
  const [manualError, setManualError] = useState<string | null>(null);

  const inside = useQuery({ queryKey: ["security", "inside"], queryFn: () => api.get<{ data: VisitorPass[] }>("/security/inside"), refetchInterval: 30_000 });
  const away = useQuery({ queryKey: ["security", "away"], queryFn: () => api.get<{ data: AwayNotice[] }>("/security/away"), refetchInterval: 120_000 });

  /** Checks a typed code or a scanned QR (visitor pass or resident estate pass). */
  const check = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setLookupError(null);
    setResult(null);
    setResident(null);
    try {
      const res = (await api.post<{ data: VisitorCheck | ResidentCheck }>("/security/passes/verify", { code: value.trim() })).data;
      if (res.kind === "resident") setResident(res);
      else setResult(res);
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : "The code could not be checked.");
    }
  }, []);

  const verify = (e: FormEvent) => {
    e.preventDefault();
    check(code);
  };

  const onScan = useCallback((text: string) => {
    setScanOpen(false);
    check(text);
  }, [check]);

  const recordResident = async (r: ResidentCheck, direction: "in" | "out") => {
    const res = await run(`r-${direction}`, () => api.post("/security/access-logs", { direction, subject_type: "resident", person_name: r.resident.name, household_id: r.resident.householdId }), direction === "in" ? "Resident entry recorded." : "Resident exit recorded.");
    if (res !== undefined) setResident(null);
  };

  const recordPass = async (passCode: string, direction: "in" | "out") => {
    const res = await run(`${direction}-${passCode}`, () => api.post("/security/access-logs", { direction, pass_code: passCode }), direction === "in" ? "Entry recorded. The resident has been notified." : "Exit recorded.");
    if (res !== undefined) {
      setResult(null);
      setCode("");
      inside.refetch();
    }
  };

  const recordManual = async (e: FormEvent) => {
    e.preventDefault();
    setManualError(null);
    if (manual.person_name.trim().length < 2 && !manual.plate_number.trim()) return setManualError("Enter a name or a plate number.");
    try {
      await api.post("/security/access-logs", {
        direction: manual.direction,
        subject_type: manual.subject_type,
        person_name: manual.person_name.trim() || manual.plate_number.trim(),
        phone: manual.phone.trim() || null,
        plate_number: manual.plate_number.trim() || null,
        note: manual.note.trim() || null,
      });
      toast.success(manual.direction === "in" ? "Entry recorded." : "Exit recorded.");
      setManual(blankManual);
    } catch (err) {
      // A blacklist match is refused by the API and the attempt is logged (FR-BLK-03).
      setManualError(err instanceof ApiError ? err.message : "The movement could not be recorded.");
    }
  };

  const set = (k: keyof typeof blankManual) => (e: { target: { value: string } }) => setManual((m) => ({ ...m, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Gate control" description="Every entry is screened against the estate blacklist and watchlist." breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Gate control" }]} />
      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan QR code">
        {scanOpen && <QrScanner onResult={onScan} />}
      </Modal>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scan a pass" description="Visitor QR passes and resident estate passes." />
          <div className="p-5">
            <Button size="lg" className="mb-4 w-full" onClick={() => setScanOpen(true)}><ScanLine className="h-5 w-5" /> Scan QR code</Button>
            <p className="mb-2 text-xs text-ink-600">Or type the visitor&apos;s 6-character backup code:</p>
            <form onSubmit={verify} className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="e.g. 7KXQ2M" className="font-mono text-lg tracking-widest" aria-label="Visitor code" autoFocus />
              <Button type="submit"><Search className="h-4 w-4" /> Check</Button>
            </form>
            {resident && (
              <div className={`mt-4 rounded-xl border p-4 ${resident.cleared ? "border-success-600/40 bg-success-50" : "border-warning-600/40 bg-warning-50"}`}>
                <p className="flex items-center gap-2 font-semibold text-ink-900"><UserCheck className="h-5 w-5 text-army-800" /> Resident · {resident.resident.name}</p>
                <p className="mt-1 text-sm text-ink-600">Unit {resident.resident.unit ?? "—"}{resident.resident.street ? `, ${resident.resident.street}` : ""}{resident.resident.relationship ? ` · ${titleCase(resident.resident.relationship)}` : ""}</p>
                {resident.cleared ? (
                  <p className="mt-3 flex items-center gap-2 font-semibold text-success-600"><CheckCircle2 className="h-5 w-5" /> Cleared — estate dues paid</p>
                ) : (
                  <p className="mt-3 flex items-center gap-2 font-semibold text-warning-600"><AlertOctagon className="h-5 w-5" /> Not cleared — {formatNaira(resident.outstanding.amount)} outstanding</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button loading={busy === "r-in"} onClick={() => recordResident(resident, "in")}><LogIn className="h-4 w-4" /> Record entry</Button>
                  <Button variant="outline" loading={busy === "r-out"} onClick={() => recordResident(resident, "out")}><LogOut className="h-4 w-4" /> Record exit</Button>
                </div>
              </div>
            )}
            {lookupError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger-600"><XCircle className="h-4 w-4" />{lookupError}</p>}
            {result && (
              <div className={`mt-4 rounded-xl border p-4 ${result.valid ? "border-success-600/40 bg-success-50" : "border-danger-600/40 bg-danger-50"}`}>
                <p className={`flex items-center gap-2 font-semibold ${result.valid ? "text-success-600" : "text-danger-600"}`}>
                  {result.valid ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{result.valid ? "Valid pass" : result.reason}
                </p>
                {result.watchlist && result.watchlist.list === "watch" && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-warning-50 p-2 text-sm text-warning-600"><AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />Watchlist match: {result.watchlist.reason}. A supervisor is notified on entry.</p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-ink-600">Visitor</dt><dd className="font-medium">{result.pass.visitorName}</dd></div>
                  <div><dt className="text-xs text-ink-600">Visiting</dt><dd className="font-medium">Unit {result.pass.unit ?? "—"} · {result.pass.host ?? "—"}</dd></div>
                  <div><dt className="text-xs text-ink-600">Vehicle</dt><dd>{result.pass.vehiclePlate ?? "—"}</dd></div>
                  <div><dt className="text-xs text-ink-600">Entries</dt><dd>{result.pass.entriesUsed} / {result.pass.maxEntries}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-ink-600">Valid</dt><dd>{formatDateTime(result.pass.validFrom)} – {formatDateTime(result.pass.validUntil)}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2">
                  {result.valid && <Button loading={busy === `in-${result.pass.code}`} onClick={() => recordPass(result.pass.code, "in")}><LogIn className="h-4 w-4" /> Check in</Button>}
                  <Button variant="outline" loading={busy === `out-${result.pass.code}`} onClick={() => recordPass(result.pass.code, "out")}><LogOut className="h-4 w-4" /> Check out</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Record a movement without a code" description="Residents, staff, contractors and walk-in visitors." />
          <form onSubmit={recordManual} className="grid gap-3 p-5 sm:grid-cols-2" noValidate>
            {manualError && <p role="alert" className="text-sm text-danger-600 sm:col-span-2">{manualError}</p>}
            <Field label="Direction" htmlFor="g-dir"><Select id="g-dir" value={manual.direction} onChange={set("direction")}><option value="in">Entering</option><option value="out">Leaving</option></Select></Field>
            <Field label="Type" htmlFor="g-type"><Select id="g-type" value={manual.subject_type} onChange={set("subject_type")}>{["visitor", "resident", "staff", "contractor", "vehicle"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></Field>
            <Field label="Name" htmlFor="g-name"><Input id="g-name" value={manual.person_name} onChange={set("person_name")} /></Field>
            <Field label="Phone" htmlFor="g-phone"><Input id="g-phone" value={manual.phone} onChange={set("phone")} inputMode="tel" /></Field>
            <Field label="Plate number" htmlFor="g-plate"><Input id="g-plate" className="uppercase" value={manual.plate_number} onChange={set("plate_number")} /></Field>
            <Field label="Note" htmlFor="g-note"><Input id="g-note" value={manual.note} onChange={set("note")} /></Field>
            <div className="sm:col-span-2"><Button type="submit"><DoorOpen className="h-4 w-4" /> Record</Button></div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Visitors inside now" description={`${inside.data?.data.length ?? 0} checked in and not yet out`} />
          {inside.data?.data.length ? (
            <ul className="divide-y divide-line">
              {inside.data.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div><p className="font-medium">{p.visitorName} <span className="font-mono text-xs text-ink-600">{p.code}</span></p><p className="text-xs text-ink-600">Unit {p.unit ?? "—"}{p.vehiclePlate ? ` · ${p.vehiclePlate}` : ""}</p></div>
                  <Button size="sm" variant="outline" loading={busy === `out-${p.code}`} onClick={() => recordPass(p.code, "out")}><LogOut className="h-4 w-4" /> Check out</Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={inside.isLoading ? "Loading…" : "No visitors inside"} />}
        </Card>

        <Card>
          <div id="away" />
          <CardHeader title="Homes with residents away" />
          {away.data?.data.length ? (
            <ul className="divide-y divide-line">
              {away.data.data.map((n) => (
                <li key={n.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between"><p className="font-medium">Unit {n.unit ?? "—"} · {n.resident}</p><StatusPill status={n.status} /></div>
                  <p className="text-xs text-ink-600">{formatDate(n.fromDate)} – {formatDate(n.toDate)}{n.emergencyContact ? ` · Contact: ${n.emergencyContact}` : ""}</p>
                  {n.note && <p className="text-xs">{n.note}</p>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title={away.isLoading ? "Loading…" : "No away notices"} icon={<Plane className="h-6 w-6" />} />}
        </Card>
      </div>
    </>
  );
}
