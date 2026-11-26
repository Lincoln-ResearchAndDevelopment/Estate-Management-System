import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./states";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: number;
  deltaLabel?: string;
  subtitle?: string;
  href?: string;
  loading?: boolean;
  highlight?: boolean;
}

/** KPI card (CMP-04): clicking opens the underlying list pre-filtered (FR-DASH-07). */
export function KpiCard({ label, value, icon, delta, deltaLabel, subtitle, href, loading, highlight }: KpiCardProps) {
  const body = (
    <div className={cn("card h-full p-5 transition-shadow", href && "hover:shadow-md", highlight && "border-l-4 border-l-gold-500")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-army-50 text-army-800">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{value}</p>
      )}
      {(delta !== undefined || subtitle) && !loading && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center font-medium", delta >= 0 ? "text-success-600" : "text-danger-600")}>
              {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          )}
          {deltaLabel ?? subtitle}
        </p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}
