"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ambulance, Flame, ShieldAlert, Siren } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/modules";

const TYPES = [
  { value: "panic", label: "Panic", icon: Siren, help: "Immediate danger" },
  { value: "security", label: "Security", icon: ShieldAlert, help: "Intruder or suspicious activity" },
  { value: "medical", label: "Medical", icon: Ambulance, help: "Someone needs urgent care" },
  { value: "fire", label: "Fire", icon: Flame, help: "Fire or smoke" },
] as const;

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 },
    );
  });
}

/** M08 panic button: one tap notifies estate security with the resident's unit (and location if allowed). */
export default function EmergencyPage() {
  const { busy, run } = useAction();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("panic");
  const [description, setDescription] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);

  const alerts = useQuery({
    queryKey: ["resident", "alerts"],
    queryFn: () => api.get<{ data: Alert[] }>("/resident/alerts"),
    refetchInterval: (q) => (q.state.data?.data.some((a) => ["raised", "acknowledged", "dispatched"].includes(a.status)) ? 5000 : 30_000),
  });
  const active = alerts.data?.data.find((a) => ["raised", "acknowledged", "dispatched"].includes(a.status));

  const raise = async () => {
    const pos = await currentPosition();
    await run("raise", () => api.post("/resident/alerts", { type, description: description || null, lat: pos?.lat ?? null, lng: pos?.lng ?? null }), "Alert sent. Security has been notified.");
    setDescription("");
    alerts.refetch();
  };

  const cancel = async () => {
    if (!cancelId) return;
    await run("cancel", () => api.post(`/resident/alerts/${cancelId}/cancel`), "Alert cancelled.");
    setCancelId(null);
    alerts.refetch();
  };

  return (
    <>
      <PageHeader title="Emergency" description="Use this only for real emergencies. Security responds to every alert and false alarms are recorded." breadcrumbs={[{ label: "Dashboard", href: "/resident" }, { label: "Emergency" }]} />

      {active ? (
        <Card className="mb-6 border-danger-600/40">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 animate-pulse items-center justify-center rounded-full bg-danger-600 text-white"><Siren className="h-7 w-7" /></span>
              <div>
                <p className="text-lg font-semibold">{titleCase(active.type)} alert {active.reference}</p>
                <p className="text-sm text-ink-600">Raised {formatRelative(active.createdAt)} · <StatusPill status={active.status} /></p>
                {active.responder && <p className="mt-1 text-sm">Responder: <strong>{active.responder}</strong></p>}
              </div>
            </div>
            {active.status === "raised" && <Button variant="outline" onClick={() => setCancelId(active.id)}>Cancel alert</Button>}
          </div>
          {active.events.length > 0 && (
            <ol className="border-t border-line px-6 py-4 text-sm">
              {active.events.map((e, i) => <li key={i} className="flex gap-3 py-1"><span className="w-40 shrink-0 text-ink-600">{formatDateTime(e.occurredAt)}</span><span>{titleCase(e.to)}{e.actor ? ` by ${e.actor}` : ""}{e.note ? ` — ${e.note}` : ""}</span></li>)}
            </ol>
          )}
        </Card>
      ) : (
        <Card className="mb-6 p-6">
          <p className="mb-3 text-sm font-medium">What is happening?</p>
          <div className="grid gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Alert type">
            {TYPES.map((t) => (
              <button key={t.value} type="button" role="radio" aria-checked={type === t.value} onClick={() => setType(t.value)}
                className={cn("flex flex-col items-center gap-1 rounded-xl border p-4 text-center transition", type === t.value ? "border-danger-600 bg-danger-50 text-danger-600" : "border-line hover:bg-canvas")}>
                <t.icon className="h-6 w-6" />
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-ink-600">{t.help}</span>
              </button>
            ))}
          </div>
          <Textarea className="mt-4" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional: anything security should know (e.g. back gate, two men)" aria-label="Details for security" />
          <button type="button" onClick={raise} disabled={busy === "raise"}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-danger-600 py-6 text-xl font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-danger-600/90 disabled:opacity-60">
            <Siren className="h-8 w-8" /> {busy === "raise" ? "Sending…" : "Send alert to security"}
          </button>
          <p className="mt-2 text-center text-xs text-ink-600">Your unit and phone number are shared with responders. Location is shared if your browser allows it.</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Alert history" />
        {alerts.data?.data.length ? (
          <ul className="divide-y divide-line">
            {alerts.data.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><p className="font-medium">{titleCase(a.type)} · {a.reference}</p><p className="text-xs text-ink-600">{formatDateTime(a.createdAt)}{a.resolutionNote ? ` · ${a.resolutionNote}` : ""}</p></div>
                <StatusPill status={a.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={alerts.isLoading ? "Loading…" : "No alerts raised"} />
        )}
      </Card>

      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={cancel} loading={busy === "cancel"} title="Cancel this alert?" message="Only cancel if the emergency is over or the alert was sent by mistake." confirmLabel="Cancel alert" destructive />
    </>
  );
}
