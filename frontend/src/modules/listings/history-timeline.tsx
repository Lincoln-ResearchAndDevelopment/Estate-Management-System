import { formatDateTime, titleCase } from "@/lib/format";
import { StatusPill } from "@/components/ui/status-pill";
import type { ListingHistoryEntry } from "@/types/api";

/** FR-LIST-16: every status change and edit with actor, time, reason and changed fields. */
export function HistoryTimeline({ entries }: { entries: ListingHistoryEntry[] }) {
  if (!entries.length) return <p className="px-5 py-6 text-sm text-ink-600">No history yet.</p>;

  return (
    <ol className="space-y-4 p-5">
      {entries.map((h) => (
        <li key={h.id} className="relative border-l-2 border-army-100 pl-4">
          <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-army-800" aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {h.from && h.from !== h.to ? (
              <>
                <StatusPill status={h.from} />
                <span className="text-ink-400">→</span>
              </>
            ) : null}
            <StatusPill status={h.to} />
          </div>
          <p className="mt-1 text-xs text-ink-600">
            {h.actor ?? "System"} · {formatDateTime(h.occurredAt)}
          </p>
          {h.reason && <p className="mt-1 text-sm text-ink-900">{h.reason}</p>}
          {h.changedFields && Object.keys(h.changedFields).length > 0 && (
            <ul className="mt-2 space-y-0.5 rounded-md bg-canvas px-3 py-2 text-xs text-ink-600">
              {Object.entries(h.changedFields).map(([field, change]) => (
                <li key={field}>
                  <span className="font-medium text-ink-900">{titleCase(field.replace(/_ngn$/, ""))}</span>: {String(change.from ?? "—")} → {Array.isArray(change.to) ? change.to.join(", ") : String(change.to ?? "—")}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
