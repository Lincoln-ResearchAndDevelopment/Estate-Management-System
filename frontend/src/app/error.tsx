"use client";

import { ErrorState } from "@/components/ui/states";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-20 max-w-lg px-4">
      <div className="card">
        <ErrorState message={error.message || "This page failed to load."} onRetry={reset} />
      </div>
    </div>
  );
}
