import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "gold";

const tones: Record<Tone, string> = {
  success: "bg-success-50 text-success-600 ring-success-600/20",
  warning: "bg-warning-50 text-warning-600 ring-warning-600/20",
  danger: "bg-danger-50 text-danger-600 ring-danger-600/20",
  neutral: "bg-canvas text-ink-600 ring-ink-400/30",
  info: "bg-info-50 text-info-600 ring-info-600/20",
  gold: "bg-gold-100 text-olive-700 ring-gold-500/30",
};

/** Semantic status colours (FR-GEN-06): green = done/active, amber = pending, red = critical/denied. */
const STATUS_TONES: Record<string, Tone> = {
  active: "success", approved: "success", live: "success", occupied: "success", verified: "success", contacted: "info",
  pending: "warning", pending_approval: "warning", info_requested: "warning", draft: "neutral", new: "gold",
  rejected: "danger", blocked: "danger", suspended: "danger", deleted: "danger", approval_withdrawn: "danger",
  inactive: "neutral", expired: "neutral", rented_sold: "info", closed: "neutral", vacant: "neutral", under_watch: "warning",
  // Finance
  paid: "success", success: "success", unpaid: "warning", part_paid: "info", overdue: "danger", void: "neutral",
  failed: "danger", pending_verification: "warning",
  // Security and access
  raised: "danger", acknowledged: "warning", dispatched: "info", resolved: "success", false_alarm: "neutral", cancelled: "neutral",
  used: "neutral", open: "warning", investigating: "info", black: "danger", watch: "warning", cleared: "neutral", ended: "neutral",
  low: "neutral", medium: "warning", high: "danger", critical: "danger", deactivated: "neutral",
  // Community and marketplace
  placed: "gold", accepted: "info", ready: "info", delivered: "success", scheduled: "info", held: "success", visible: "success", hidden: "neutral",
};

const LABELS: Record<string, string> = {
  approved: "Live", pending_approval: "Pending approval", approval_withdrawn: "Withdrawn", rented_sold: "Rented / Sold",
  info_requested: "Info requested", under_watch: "Under watch",
  part_paid: "Part paid", pending_verification: "Awaiting verification", success: "Successful", false_alarm: "False alarm",
  black: "Blacklist", watch: "Watchlist",
};

export function StatusPill({ status, label, tone, className }: { status: string; label?: string; tone?: Tone; className?: string }) {
  const t = tone ?? STATUS_TONES[status] ?? "neutral";
  const text = label ?? LABELS[status] ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[t], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {text}
    </span>
  );
}
