"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatNaira, formatRelative, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { QrCode } from "@/modules/access/qr";
import type { EstatePass } from "@/types/modules";

export function useEstatePass(enabled = true) {
  return useQuery({
    queryKey: ["resident", "pass"],
    queryFn: () => api.get<{ data: EstatePass }>("/resident/pass"),
    enabled,
    // Clearance changes when finance confirms a payment; refresh regularly so the pass is current.
    refetchInterval: 60_000,
  });
}

/** Printable estate ID card: the resident's QR pass with their unit and dues status (Figma "Print ID Card"). */
export function EstateIdCard({ pass }: { pass: EstatePass }) {
  return (
    <div className="printable mx-auto w-full max-w-xs rounded-2xl border-2 border-army-900 bg-white p-5 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-wider text-army-900">{pass.estate}</p>
      <p className="text-[11px] uppercase tracking-widest text-ink-600">Resident estate pass</p>
      <div className="my-3"><QrCode value={pass.qrPayload} size={168} label={`Estate pass QR code for ${pass.name}`} /></div>
      <p className="text-lg font-semibold">{pass.name}</p>
      <p className="text-sm text-ink-600">{pass.unit ? `Unit ${pass.unit}` : "No unit"}{pass.street ? ` · ${pass.street}` : ""}</p>
      {pass.relationship && <p className="text-xs text-ink-600">{titleCase(pass.relationship)}</p>}
    </div>
  );
}

/** Dashboard card: the resident's QR estate pass and whether their dues are cleared. */
export function EstatePassCard() {
  const { data, isLoading, error, refetch } = useEstatePass();
  const pass = data?.data;

  return (
    <Card>
      <CardHeader title="My estate pass" description="Show this QR at the gate." />
      {error ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} /> : isLoading || !pass ? <Skeleton className="m-5 h-64" /> : (
        <div className="flex flex-col items-center gap-3 p-5 text-center">
          <QrCode value={pass.qrPayload} size={176} label={`Estate pass QR code for ${pass.name}`} />
          <div>
            <p className="font-semibold">{pass.name}</p>
            <p className="text-sm text-ink-600">{pass.unit ? `Unit ${pass.unit}` : ""}{pass.street ? ` · ${pass.street}` : ""}</p>
          </div>
          {pass.cleared ? (
            <p className="flex items-center gap-2 rounded-full bg-success-50 px-4 py-1.5 text-sm font-semibold text-success-600"><CheckCircle2 className="h-4 w-4" /> Cleared — dues paid</p>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-2 rounded-full bg-danger-50 px-4 py-1.5 text-sm font-semibold text-danger-600"><XCircle className="h-4 w-4" /> Not cleared · {formatNaira(pass.outstanding.amount)} due</p>
              <Link href="/resident/finance" className="text-sm font-medium text-army-800 hover:underline">Pay now</Link>
            </div>
          )}
          <p className="text-xs text-ink-400">Status checked {formatRelative(pass.checkedAt)}. Updates when finance confirms your payment.</p>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print ID card</Button>
          <div className="hidden print:block"><EstateIdCard pass={pass} /></div>
        </div>
      )}
    </Card>
  );
}
