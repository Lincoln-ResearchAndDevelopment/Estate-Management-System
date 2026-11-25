import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatDateTime, formatNaira } from "@/lib/format";
import { serverGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Verify a receipt", robots: { index: false } };
export const dynamic = "force-dynamic";

interface ReceiptCheck { receiptNumber: string; valid: boolean; amount: { amount: string }; paidAt: string | null; unit: string | null; estate: string }

/** Public receipt verification: anyone holding a receipt can confirm it was issued by the estate. */
export default async function VerifyReceiptPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  let receipt: ReceiptCheck | null = null;
  let failed = false;
  try {
    receipt = (await serverGet<{ data: ReceiptCheck }>(`/public/receipts/${encodeURIComponent(number)}`, 0))?.data ?? null;
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card p-8 text-center">
        {receipt ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" />
            <h1 className="mt-3 text-2xl font-semibold">Genuine receipt</h1>
            <p className="mt-1 font-mono text-sm text-ink-600">{receipt.receiptNumber}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-left text-sm">
              <div><dt className="text-xs text-ink-600">Amount</dt><dd className="font-semibold">{formatNaira(receipt.amount.amount, { decimals: true })}</dd></div>
              <div><dt className="text-xs text-ink-600">Paid</dt><dd className="font-medium">{formatDateTime(receipt.paidAt)}</dd></div>
              <div><dt className="text-xs text-ink-600">Unit</dt><dd className="font-medium">{receipt.unit ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-600">Issued by</dt><dd className="font-medium">{receipt.estate}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-12 w-12 text-danger-600" />
            <h1 className="mt-3 text-2xl font-semibold">{failed ? "Verification unavailable" : "Receipt not found"}</h1>
            <p className="mt-2 text-sm text-ink-600">{failed ? "The verification service could not be reached. Try again shortly." : `No successful payment has receipt number ${number}. Contact the estate office if you believe this is wrong.`}</p>
          </>
        )}
      </div>
    </div>
  );
}
