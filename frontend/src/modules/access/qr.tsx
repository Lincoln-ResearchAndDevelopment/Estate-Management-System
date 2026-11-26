"use client";

import { useId } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** A QR code drawn in the brand's deep green on white (high contrast, scans reliably on phone screens). */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  return (
    <div className="inline-block rounded-xl border border-line bg-white p-3" role="img" aria-label={label}>
      <QRCodeSVG value={value} size={size} level="M" fgColor="#18392B" bgColor="#FFFFFF" marginSize={1} />
    </div>
  );
}

/**
 * Download and share actions for a pass QR. Sharing sends the link (which opens the QR on the visitor's
 * phone) through the phone's share sheet — WhatsApp, SMS, e-mail — or copies it on desktop.
 */
export function QrActions({ value, filename, shareUrl, shareText }: { value: string; filename: string; shareUrl?: string | null; shareText?: string }) {
  const toast = useToast();
  const canvasId = useId().replace(/:/g, "");

  const download = () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${filename}.png`;
    link.click();
  };

  const share = async () => {
    if (!shareUrl) return;
    const text = shareText ?? "Your estate visitor pass";
    try {
      if (navigator.share) await navigator.share({ title: text, text, url: shareUrl });
      else {
        await navigator.clipboard.writeText(`${text}: ${shareUrl}`);
        toast.success("Link copied. Paste it into WhatsApp, SMS or e-mail.");
      }
    } catch {
      /* the user closed the share sheet */
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {/* Hidden high-resolution canvas used only for the PNG download. */}
      <QRCodeCanvas id={canvasId} value={value} size={720} level="M" fgColor="#18392B" bgColor="#FFFFFF" marginSize={4} className="hidden" />
      {shareUrl && <Button onClick={share}><Share2 className="h-4 w-4" /> Share with visitor</Button>}
      <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download QR</Button>
    </div>
  );
}
