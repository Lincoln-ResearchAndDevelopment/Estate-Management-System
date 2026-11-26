import type { Metadata } from "next";
import { CalendarClock, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import { QrCode } from "@/modules/access/qr";

export const metadata: Metadata = { title: "Visitor pass", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface PublicPass {
  visitorName: string;
  code: string;
  qrPayload: string;
  validFrom: string;
  validUntil: string;
  status: "active" | "used" | "expired" | "cancelled";
  entriesLeft: number;
  host: string | null;
  unit: string | null;
  estate: string;
}

const STATUS_TEXT: Record<Exclude<PublicPass["status"], "active">, string> = {
  used: "This pass has been used.",
  expired: "This pass has expired.",
  cancelled: "This pass was cancelled by the resident.",
};

/** What the visitor sees when they open the pass link: a QR to show at the gate. No sign-in needed. */
export default async function VisitorPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let pass: PublicPass | null = null;
  try {
    pass = (await serverGet<{ data: PublicPass }>(`/public/passes/${encodeURIComponent(token)}`, 0))?.data ?? null;
  } catch {
    pass = null;
  }

  if (!pass) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <XCircle className="mx-auto h-12 w-12 text-danger-600" />
        <h1 className="mt-3 text-2xl font-semibold">Pass not found</h1>
        <p className="mt-2 text-sm text-ink-600">Check the link with the resident who invited you.</p>
      </div>
    );
  }

  const usable = pass.status === "active" && pass.entriesLeft > 0;
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-army-800">{pass.estate}</p>
        <h1 className="mt-1 text-2xl font-semibold">Visitor pass</h1>
        <p className="mt-1 text-ink-600">for <strong className="text-ink-900">{pass.visitorName}</strong>{pass.host ? ` · invited by ${pass.host}` : ""}{pass.unit ? `, Unit ${pass.unit}` : ""}</p>
        {usable ? (
          <>
            <div className="my-6"><QrCode value={pass.qrPayload} size={240} label={`QR code for ${pass.visitorName}'s visitor pass`} /></div>
            <p className="text-sm text-ink-600">Show this QR code to security at the gate.</p>
            <p className="mt-3 text-xs uppercase tracking-wider text-ink-600">Backup code</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-army-900">{pass.code}</p>
          </>
        ) : (
          <p className="my-8 flex items-center justify-center gap-2 font-medium text-danger-600"><XCircle className="h-5 w-5" />{pass.status === "active" ? "This pass has no entries left." : STATUS_TEXT[pass.status]}</p>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-600">
          <CalendarClock className="h-4 w-4" /> Valid {formatDateTime(pass.validFrom)} – {formatDateTime(pass.validUntil)}
        </p>
      </div>
    </div>
  );
}
