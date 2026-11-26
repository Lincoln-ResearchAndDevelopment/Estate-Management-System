import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-army-100/70", className)} aria-hidden />;
}

/** FR-GEN-07: an icon and one sentence. */
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-army-50 text-army-800">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <div>
        <p className="font-medium text-ink-900">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-ink-900">Something went wrong</p>
        <p className="mt-1 text-sm text-ink-600">{message ?? "The data could not be loaded."}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
