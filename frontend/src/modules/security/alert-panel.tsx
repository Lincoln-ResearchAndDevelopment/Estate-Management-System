"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { useState } from "react";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Alert } from "@/types/modules";

/** Only the security team acts on alerts; management watches (enforced by the API too). */
export function useIsSecurityTeam() {
  const { session } = useAuth();
  return !!session?.user.roles?.some((r) => r.code === "security_officer");
}

const NEXT: Record<string, { to: string; label: string; needsNote?: boolean; variant?: "primary" | "outline" | "danger" }[]> = {
  raised: [{ to: "acknowledged", label: "Acknowledge" }, { to: "false_alarm", label: "False alarm", needsNote: true, variant: "outline" }],
  acknowledged: [{ to: "dispatched", label: "Dispatch responder" }, { to: "resolved", label: "Resolve", needsNote: true, variant: "outline" }, { to: "false_alarm", label: "False alarm", needsNote: true, variant: "outline" }],
  dispatched: [{ to: "resolved", label: "Resolve", needsNote: true }, { to: "false_alarm", label: "False alarm", needsNote: true, variant: "outline" }],
};

/** Alert detail with the allowed next steps (SRS M08 alert lifecycle). */
export function AlertModal({ alertId, onClose, onChanged }: { alertId: number; onClose: () => void; onChanged: () => void }) {
  const { busy, run } = useAction();
  const isSecurityTeam = useIsSecurityTeam();
  const [note, setNote] = useState("");
  const [responder, setResponder] = useState("");
  const { data, refetch } = useQuery({ queryKey: ["security", "alert", alertId], queryFn: () => api.get<{ data: Alert }>(`/security/alerts/${alertId}`), refetchInterval: 10_000 });
  const officers = useQuery({ queryKey: ["security", "officers"], queryFn: () => api.get<{ data: { id: number; name: string; phone: string | null }[] }>("/security/officers"), staleTime: 300_000 });
  const a = data?.data;

  const move = async (to: string, needsNote?: boolean) => {
    if (needsNote && note.trim().length < 5) return;
    const res = await run(to, () => api.post(`/security/alerts/${alertId}/transition`, { status: to, note: note.trim() || null, responder_id: to === "dispatched" && responder ? Number(responder) : null }), `Alert marked ${titleCase(to).toLowerCase()}.`);
    if (res !== undefined) {
      setNote("");
      refetch();
      onChanged();
    }
  };

  return (
    <Modal open onClose={onClose} title={a ? `${titleCase(a.type)} alert ${a.reference}` : "Alert"} size="lg">
      {!a ? <p className="text-sm text-ink-600">Loading…</p> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={a.status} />
            {a.escalated && <StatusPill status="escalated" label="Escalated" tone="danger" />}
            <span className="text-ink-600">Raised {formatRelative(a.createdAt)}</span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-600">Resident</dt><dd className="font-medium">{a.raisedBy?.name ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-600">Unit</dt><dd className="font-medium">{a.unit ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-600">Phone</dt><dd>{a.raisedBy?.phone ? <a href={`tel:${a.raisedBy.phone}`} className="inline-flex items-center gap-1 font-medium text-army-800"><Phone className="h-4 w-4" />{a.raisedBy.phone}</a> : "—"}</dd></div>
            <div><dt className="text-xs text-ink-600">Location</dt><dd>{a.lat && a.lng ? <a target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=18/${a.lat}/${a.lng}`} className="inline-flex items-center gap-1 font-medium text-army-800"><MapPin className="h-4 w-4" />Open map</a> : "Not shared"}</dd></div>
          </dl>
          {a.description && <p className="rounded-lg bg-canvas p-3">{a.description}</p>}
          {a.responder && <p>Responder: <strong>{a.responder}</strong></p>}
          {a.resolutionNote && <p>Outcome: {a.resolutionNote}</p>}
          <ol className="border-l-2 border-army-100 pl-4">
            {a.events.map((e, i) => <li key={i} className="py-1"><span className="text-xs text-ink-600">{formatDateTime(e.occurredAt)}</span> — {titleCase(e.to)}{e.actor ? ` by ${e.actor}` : ""}{e.note ? `: ${e.note}` : ""}</li>)}
          </ol>
          {NEXT[a.status] && !isSecurityTeam && (
            <p className="rounded-lg bg-canvas p-3 text-sm text-ink-600">The security team is handling this alert. Only security officers can acknowledge, dispatch and resolve alerts.</p>
          )}
          {NEXT[a.status] && isSecurityTeam && (
            <div className="space-y-3 border-t border-line pt-4">
              {a.status === "acknowledged" && (
                <Select value={responder} onChange={(e) => setResponder(e.target.value)} aria-label="Responder">
                  <option value="">Choose responder (optional)</option>
                  {officers.data?.data.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to resolve or mark a false alarm)" aria-label="Note" />
              <div className="flex flex-wrap gap-2">
                {NEXT[a.status].map((n) => (
                  <Button key={n.to} variant={n.variant ?? "primary"} loading={busy === n.to} disabled={!!n.needsNote && note.trim().length < 5} onClick={() => move(n.to, n.needsNote)}>{n.label}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
