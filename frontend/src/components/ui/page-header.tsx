import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/** Consistent page header with breadcrumbs (master prompt, Section 3 "Interface expectations"). */
export function PageHeader({ title, description, breadcrumbs = [], actions }: { title: string; description?: string; breadcrumbs?: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-600">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-400" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-army-800 hover:underline">{c.label}</Link>
                ) : (
                  <span aria-current="page" className="font-medium text-ink-900">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
