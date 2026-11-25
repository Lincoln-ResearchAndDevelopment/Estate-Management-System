"use client";

import { ErrorState } from "@/components/ui/states";

/** Error boundary for every portal page: the shell stays usable and the page can be retried. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <ErrorState message={error.message || "This page failed to load."} onRetry={reset} />
    </div>
  );
}
