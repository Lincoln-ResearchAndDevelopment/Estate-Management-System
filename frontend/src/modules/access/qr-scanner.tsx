"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";

interface Detector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Reads a QR code from the device camera (rear camera on phones). Uses the browser's built-in
 * BarcodeDetector where available and falls back to jsQR, so it works on Chrome, Safari and Firefox.
 * Camera access needs HTTPS (or localhost).
 */
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;

    const found = (text: string) => {
      if (done.current || !text) return;
      done.current = true;
      onResult(text);
    };

    const tick = async () => {
      const v = video.current;
      const c = canvas.current;
      if (!v || !c || v.readyState < 2 || done.current) return;
      if (detector) {
        const codes = await detector.detect(v).catch(() => []);
        if (codes[0]) return found(codes[0].rawValue);
        return;
      }
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) found(code.data);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera. Type the 6-character code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        timer = setInterval(tick, 250);
      } catch {
        setError("Camera access was blocked. Allow the camera in the browser settings, or type the code instead.");
      }
    })();

    return () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  if (error) {
    return <p role="alert" className="flex items-center gap-2 rounded-lg bg-warning-50 p-4 text-sm text-warning-600"><CameraOff className="h-5 w-5 shrink-0" />{error}</p>;
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-army-950">
      <video ref={video} className="aspect-square w-full object-cover" muted playsInline aria-label="Camera preview for scanning a QR code" />
      <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-gold-500/80" aria-hidden />
      <canvas ref={canvas} className="hidden" />
      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">Point the camera at the QR code</p>
    </div>
  );
}
