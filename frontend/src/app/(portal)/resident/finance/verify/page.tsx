"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import type { Payment } from "@/types/modules";

/** Paystack redirects here after checkout; the API confirms the transaction with Paystack before applying it. */
function Result() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["resident", "verify", reference],
    queryFn: () => api.get<{ data: Payment }>("/resident/payments/verify", { reference }),
    enabled: !!reference,
    refetchInterval: (q) => (q.state.data?.data.status === "pending" ? 4000 : false),
  });
  if (!reference) return <ErrorState message="No payment reference was supplied." />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading || !data) return <Skeleton className="h-48" />;
  const p = data.data;

  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      {p.status === "success" ? <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" /> : p.status === "pending" ? <Clock className="mx-auto h-12 w-12 text-warning-600" /> : <XCircle className="mx-auto h-12 w-12 text-danger-600" />}
      <p className="mt-3 text-xl font-semibold">{p.status === "success" ? "Payment received" : p.status === "pending" ? "Confirming your payment…" : "Payment not completed"}</p>
      <p className="mt-1 text-ink-600">{formatNaira(p.amount.amount, { decimals: true })} · {p.receiptNumber ?? p.reference}</p>
      <Link href="/resident/finance" className="mt-6 inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">Back to bills</Link>
    </Card>
  );
}

export default function VerifyPaymentPage() {
  return (
    <>
      <PageHeader title="Payment status" breadcrumbs={[{ label: "Bills & payments", href: "/resident/finance" }, { label: "Status" }]} />
      <Suspense><Result /></Suspense>
    </>
  );
}
