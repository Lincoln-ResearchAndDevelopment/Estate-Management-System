import { cn } from "@/lib/utils";

/**
 * Text wordmark only. Official Nigerian Army logos or insignia are not used unless supplied and
 * authorised (master prompt, Section 3); replace the monogram here when the approved logo arrives.
 */
export function Brand({ subtitle, inverted = false, compact = false, className }: { subtitle?: string; inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold tracking-wider",
          inverted ? "bg-gold-500 text-army-950" : "bg-army-900 text-gold-500",
        )}
        aria-hidden
      >
        PAHE
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={cn("block truncate font-display text-base font-semibold", inverted ? "text-white" : "text-ink-900")}>
            {process.env.NEXT_PUBLIC_ESTATE_NAME ?? "Post Army Housing Estates"}
          </span>
          {subtitle && <span className={cn("block truncate text-[11px] font-medium uppercase tracking-[0.14em]", inverted ? "text-khaki-400" : "text-olive-600")}>{subtitle}</span>}
        </span>
      )}
    </div>
  );
}
