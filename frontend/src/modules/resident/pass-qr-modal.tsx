"use client";

import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QrActions, QrCode } from "@/modules/access/qr";
import type { VisitorPass } from "@/types/modules";

/** Shows a visitor pass QR so the resident can share it; the visitor shows it at the gate to be scanned. */
export function PassQrModal({ pass, onClose, title = "Visitor pass" }: { pass: VisitorPass; onClose: () => void; title?: string }) {
  return (
    <Modal open onClose={onClose} title={title} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-600">
          Send this to <strong className="text-ink-900">{pass.visitorName}</strong>. At the gate, security scans the QR code. It works from {formatDateTime(pass.validFrom)} to {formatDateTime(pass.validUntil)}.
        </p>
        {pass.qrPayload ? <QrCode value={pass.qrPayload} size={220} label={`QR code for ${pass.visitorName}'s visitor pass`} /> : null}
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">Backup code (if the QR cannot be scanned)</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-army-900">{pass.code}</p>
        </div>
        {pass.qrPayload && <QrActions value={pass.qrPayload} filename={`visitor-pass-${pass.code}`} shareUrl={pass.shareUrl} shareText={`Your visitor pass for ${pass.unit ? `Unit ${pass.unit}, ` : ""}Post Army Housing Estates`} />}
      </div>
    </Modal>
  );
}
