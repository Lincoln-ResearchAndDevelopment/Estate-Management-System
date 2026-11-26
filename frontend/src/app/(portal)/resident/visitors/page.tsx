"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plane, Plus, QrCode as QrIcon, XCircle } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { applyFieldErrors, localToIso, toLocalInput, useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import { PassQrModal } from "@/modules/resident/pass-qr-modal";
import type { AccessLog, AwayNotice, VisitorPass } from "@/types/modules";

const passSchema = z
  .object({
    visitor_name: z.string().trim().min(2, "Enter the visitor's name.").max(120),
    visitor_phone: z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]),
    purpose: z.string().trim().max(150),
    vehicle_plate: z.string().trim().max(20),
    valid_from: z.string().min(1, "Choose when the pass starts."),
    valid_until: z.string().min(1, "Choose when the pass ends."),
    max_entries: z.coerce.number().int().min(1).max(20),
  })
  .refine((v) => new Date(v.valid_until) > new Date(v.valid_from), { path: ["valid_until"], message: "The end must be after the start." });
type PassValues = z.infer<typeof passSchema>;

const awaySchema = z
  .object({
    from_date: z.string().min(1, "Choose the first day away."),
    to_date: z.string().min(1, "Choose the day you return."),
    note: z.string().trim().max(500),
    emergency_contact: z.string().trim().max(120),
  })
  .refine((v) => v.to_date >= v.from_date, { path: ["to_date"], message: "The return date must be on or after the first day." });
type AwayValues = z.infer<typeof awaySchema>;

/** M09 resident access: visitor passes with gate codes, away notices and the household's gate activity. */
export default function VisitorsPage() {
  const toast = useToast();
  const { busy, run } = useAction();
  const [tab, setTab] = useState("passes");
  const [page, setPage] = useState(1);
  // Opened straight from the dashboard's "New pass" button (?new=1).
  const searchParams = useSearchParams();
  const [passOpen, setPassOpen] = useState(() => searchParams.get("new") === "1");
  const [awayOpen, setAwayOpen] = useState(false);
  const [created, setCreated] = useState<VisitorPass | null>(null);
  const [cancel, setCancel] = useState<{ kind: "pass" | "away"; id: number; label: string } | null>(null);

  const passes = useQuery({ queryKey: ["resident", "passes"], queryFn: () => api.get<{ data: VisitorPass[] }>("/resident/passes") });
  const away = useQuery({ queryKey: ["resident", "away"], queryFn: () => api.get<{ data: AwayNotice[] }>("/resident/away"), enabled: tab === "away" });
  const activity = useQuery({ queryKey: ["resident", "activity", page], queryFn: () => api.get<Paginated<AccessLog>>("/resident/activity", { page }), enabled: tab === "activity" });

  const now = new Date();
  const passForm = useForm<PassValues>({
    resolver: zodResolver(passSchema),
    defaultValues: { visitor_name: "", visitor_phone: "", purpose: "", vehicle_plate: "", valid_from: toLocalInput(now), valid_until: toLocalInput(new Date(now.getTime() + 6 * 3600_000)), max_entries: 1 } as unknown as Partial<PassValues>,
  });
  const awayForm = useForm<AwayValues>({ resolver: zodResolver(awaySchema), defaultValues: { from_date: "", to_date: "", note: "", emergency_contact: "" } });

  const createPass = passForm.handleSubmit(async (v) => {
    try {
      const res = await api.post<{ data: VisitorPass }>("/resident/passes", {
        visitor_name: v.visitor_name,
        visitor_phone: v.visitor_phone || null,
        purpose: v.purpose || null,
        vehicle_plate: v.vehicle_plate || null,
        valid_from: localToIso(v.valid_from),
        valid_until: localToIso(v.valid_until),
        max_entries: v.max_entries,
      });
      setPassOpen(false);
      passForm.reset();
      setCreated(res.data);
      passes.refetch();
    } catch (e) {
      if (!applyFieldErrors(passForm, e)) toast.error("The pass could not be created.");
    }
  });

  const createAway = awayForm.handleSubmit(async (v) => {
    try {
      await api.post("/resident/away", { ...v, note: v.note || null, emergency_contact: v.emergency_contact || null });
      toast.success("Security has been told you are away.");
      setAwayOpen(false);
      awayForm.reset();
      away.refetch();
    } catch (e) {
      if (!applyFieldErrors(awayForm, e)) toast.error("The away notice could not be saved.");
    }
  });

  const confirmCancel = async () => {
    if (!cancel) return;
    const path = cancel.kind === "pass" ? `/resident/passes/${cancel.id}/cancel` : `/resident/away/${cancel.id}/cancel`;
    await run("cancel", () => api.post(path), cancel.kind === "pass" ? "Pass cancelled. The code no longer works at the gate." : "Away notice cancelled.");
    setCancel(null);
    (cancel.kind === "pass" ? passes : away).refetch();
  };

  const passColumns: Column<VisitorPass>[] = [
    { key: "code", header: "Pass", cell: (p) => <Button size="sm" variant="outline" onClick={() => setCreated(p)} aria-label={`Show QR pass for ${p.visitorName}`}><QrIcon className="h-4 w-4" /> <span className="font-mono tracking-widest">{p.code}</span></Button> },
    { key: "visitor", header: "Visitor", cell: (p) => <div><p className="font-medium">{p.visitorName}</p><p className="text-xs text-ink-600">{[p.purpose, p.vehiclePlate].filter(Boolean).join(" · ") || "—"}</p></div> },
    { key: "valid", header: "Valid", cell: (p) => <span className="text-xs">{formatDateTime(p.validFrom)} →<br />{formatDateTime(p.validUntil)}</span>, hideOnMobile: true },
    { key: "entries", header: "Entries", cell: (p) => `${p.entriesUsed} / ${p.maxEntries}` },
    { key: "status", header: "Status", cell: (p) => <StatusPill status={p.status} /> },
    { key: "act", header: "", cell: (p) => p.status === "active" && <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setCancel({ kind: "pass", id: p.id, label: p.visitorName })} aria-label={`Cancel pass for ${p.visitorName}`}><XCircle className="h-4 w-4" /></Button> },
  ];

  const logColumns: Column<AccessLog>[] = [
    { key: "when", header: "When", cell: (l) => formatDateTime(l.occurredAt) },
    { key: "who", header: "Who", cell: (l) => <div><p className="font-medium">{l.personName ?? l.plateNumber ?? "—"}</p><p className="text-xs text-ink-600">{titleCase(l.subjectType)}{l.passCode ? ` · pass ${l.passCode}` : ""}</p></div> },
    { key: "dir", header: "Movement", cell: (l) => (l.flagReason?.startsWith("REFUSED") ? <StatusPill status="refused" label="Refused" tone="danger" /> : <StatusPill status={l.direction} label={l.direction === "in" ? "Entered" : "Left"} tone={l.direction === "in" ? "success" : "neutral"} />) },
    { key: "gate", header: "Gate", cell: (l) => l.gate, hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader
        title="Visitors & gate"
        description="Create a QR pass for each visitor and share it with them. Security scans it at the gate and you are notified when they arrive."
        breadcrumbs={[{ label: "Dashboard", href: "/resident" }, { label: "Visitors & gate" }]}
        actions={<><Button variant="outline" onClick={() => setAwayOpen(true)}><Plane className="h-4 w-4" /> I&apos;m travelling</Button><Button onClick={() => setPassOpen(true)}><Plus className="h-4 w-4" /> New visitor pass</Button></>}
      />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "passes", label: "Visitor passes" }, { value: "away", label: "Away notices" }, { value: "activity", label: "Gate activity" }]} />

      {tab === "passes" && (
        <Card>
          <DataTable columns={passColumns} rows={passes.data?.data} rowKey={(p) => p.id} loading={passes.isLoading} error={passes.error as Error | null} onRetry={() => passes.refetch()} emptyTitle="No visitor passes yet" emptyDescription="Create a pass and share the code with your visitor." />
        </Card>
      )}
      {tab === "away" && (
        <Card>
          <CardHeader title="Away notices" description="Security keeps a closer watch on homes whose residents are away." />
          {away.data?.data.length ? (
            <ul className="divide-y divide-line">
              {away.data.data.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium">{formatDate(n.fromDate)} – {formatDate(n.toDate)}</p>
                    <p className="text-xs text-ink-600">{[n.note, n.emergencyContact && `Contact: ${n.emergencyContact}`].filter(Boolean).join(" · ") || "No note"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={n.status} />
                    {n.status === "active" && <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setCancel({ kind: "away", id: n.id, label: "this away notice" })} aria-label="Cancel away notice"><XCircle className="h-4 w-4" /></Button>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={away.isLoading ? "Loading…" : "No away notices"} icon={<Plane className="h-6 w-6" />} />
          )}
        </Card>
      )}
      {tab === "activity" && (
        <Card>
          <DataTable columns={logColumns} rows={activity.data?.data} rowKey={(l) => l.id} loading={activity.isLoading || activity.isFetching} error={activity.error as Error | null} onRetry={() => activity.refetch()} emptyTitle="No gate activity yet" />
          {activity.data && <Pagination {...activity.data.meta} onPageChange={setPage} />}
        </Card>
      )}

      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="New visitor pass"
        footer={<><Button variant="outline" onClick={() => setPassOpen(false)}>Cancel</Button><Button onClick={createPass} loading={passForm.formState.isSubmitting}>Create pass</Button></>}>
        <form onSubmit={createPass} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Visitor's name" htmlFor="p-name" error={passForm.formState.errors.visitor_name?.message} required className="sm:col-span-2"><Input id="p-name" {...passForm.register("visitor_name")} /></Field>
          <Field label="Visitor's phone" htmlFor="p-phone" error={passForm.formState.errors.visitor_phone?.message}><Input id="p-phone" inputMode="tel" placeholder="+234…" {...passForm.register("visitor_phone")} /></Field>
          <Field label="Vehicle plate" htmlFor="p-plate" error={passForm.formState.errors.vehicle_plate?.message}><Input id="p-plate" className="uppercase" {...passForm.register("vehicle_plate")} /></Field>
          <Field label="Purpose" htmlFor="p-purpose" className="sm:col-span-2"><Input id="p-purpose" placeholder="e.g. Family visit, delivery" {...passForm.register("purpose")} /></Field>
          <Field label="Valid from" htmlFor="p-from" error={passForm.formState.errors.valid_from?.message} required><Input id="p-from" type="datetime-local" {...passForm.register("valid_from")} /></Field>
          <Field label="Valid until" htmlFor="p-until" error={passForm.formState.errors.valid_until?.message} required hint="Up to 30 days ahead"><Input id="p-until" type="datetime-local" {...passForm.register("valid_until")} /></Field>
          <Field label="Number of entries" htmlFor="p-max" error={passForm.formState.errors.max_entries?.message}><Input id="p-max" type="number" min={1} max={20} {...passForm.register("max_entries")} /></Field>
        </form>
      </Modal>

      {created && <PassQrModal pass={created} onClose={() => setCreated(null)} title="Visitor pass ready" />}

      <Modal open={awayOpen} onClose={() => setAwayOpen(false)} title="Tell security you are away"
        footer={<><Button variant="outline" onClick={() => setAwayOpen(false)}>Cancel</Button><Button onClick={createAway} loading={awayForm.formState.isSubmitting}>Save</Button></>}>
        <form onSubmit={createAway} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="First day away" htmlFor="a-from" error={awayForm.formState.errors.from_date?.message} required><Input id="a-from" type="date" {...awayForm.register("from_date")} /></Field>
          <Field label="Returning on" htmlFor="a-to" error={awayForm.formState.errors.to_date?.message} required><Input id="a-to" type="date" {...awayForm.register("to_date")} /></Field>
          <Field label="Emergency contact" htmlFor="a-contact" className="sm:col-span-2"><Input id="a-contact" placeholder="Name and phone of someone to call" {...awayForm.register("emergency_contact")} /></Field>
          <Field label="Note for security" htmlFor="a-note" className="sm:col-span-2"><Textarea id="a-note" rows={2} {...awayForm.register("note")} /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} onConfirm={confirmCancel} destructive loading={busy === "cancel"}
        title={cancel?.kind === "pass" ? "Cancel visitor pass?" : "Cancel away notice?"}
        message={cancel?.kind === "pass" ? `The gate code for ${cancel?.label} will stop working immediately.` : "Security will no longer treat your home as unoccupied."} confirmLabel="Cancel it" />
    </>
  );
}
