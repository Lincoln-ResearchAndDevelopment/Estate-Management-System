"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import type { Payment } from "@/types/modules";

/**
 * Stand-in for the Paystack checkout when no Paystack key is configured (test environments only;
 * the API refuses this flow in production). Lets testers complete or fail a payment end to end.
 */
function Checkout() {
  const reference = useSearchParams().get("reference") ?? "";
  const router = useRouter();
  const { busy, run } = useAction();
  const [done, setDone] = useState<Payment | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["resident", "payment", reference],
    queryFn: () => api.get<{ data: Payment }>("/resident/payments/verify", { reference }),
    enabled: !!reference,
  });
  const payment = done ?? data?.data;

  const complete = async (outcome: "success" | "failed") => {
    const res = await run(outcome, () => api.post<{ data: Payment }>("/resident/payments/test-complete", { reference, outcome }));
    if (res) setDone(res.data);
  };

  if (!reference) return <ErrorState message="No payment reference was supplied." />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading || !payment) return <Skeleton className="h-64" />;

  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <FlaskConical className="mx-auto h-10 w-10 text-warning-600" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-warning-600">Test checkout — no real money moves</p>
      <p className="mt-4 font-display text-4xl font-semibold">{formatNaira(payment.amount.amount, { decimals: true })}</p>
      <p className="mt-1 font-mono text-sm text-ink-600">{payment.reference}</p>
      {payment.status === "pending" ? (
        <div className="mt-6 grid gap-3">
          <Button size="lg" loading={busy === "success"} onClick={() => complete("success")}><CheckCircle2 className="h-5 w-5" /> Simulate successful payment</Button>
          <Button size="lg" variant="outline" loading={busy === "failed"} onClick={() => complete("failed")}><XCircle className="h-5 w-5" /> Simulate failed payment</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {payment.status === "success" ? (
            <p className="flex items-center justify-center gap-2 font-medium text-success-600"><CheckCircle2 className="h-5 w-5" /> Payment successful · receipt {payment.receiptNumber}</p>
          ) : (
            <p className="flex items-center justify-center gap-2 font-medium text-danger-600"><XCircle className="h-5 w-5" /> Payment {payment.status}</p>
          )}
          <Button onClick={() => router.push("/resident/finance")}>Back to bills</Button>
        </div>
      )}
    </Card>
  );
}

export default function TestCheckoutPage() {
  return (
    <>
      <PageHeader title="Complete payment" breadcrumbs={[{ label: "Finance", href: "/resident/finance" }, { label: "Checkout" }]} />
      <Suspense><Checkout /></Suspense>
    </>
  );
}
