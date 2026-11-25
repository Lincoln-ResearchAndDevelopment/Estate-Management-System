"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Home, X } from "lucide-react";

export function Gallery({ photos, title }: { photos: { id: number; url: string }[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setActive((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, photos.length]);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center rounded-xl bg-army-50 text-army-800/40">
        <Home className="h-16 w-16" aria-hidden />
        <span className="sr-only">No photos available</span>
      </div>
    );
  }

  const [first, ...rest] = photos;

  return (
    <>
      <div className="grid gap-2 overflow-hidden rounded-xl sm:grid-cols-4 sm:grid-rows-2">
        <button type="button" onClick={() => setActive(0)} className="relative aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.url} alt={`${title} — photo 1`} className="h-full w-full object-cover" />
        </button>
        {rest.slice(0, 4).map((p, i) => (
          <button key={p.id} type="button" onClick={() => setActive(i + 1)} className="relative hidden aspect-[4/3] sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${title} — photo ${i + 2}`} loading="lazy" className="h-full w-full object-cover" />
            {i === 3 && photos.length > 5 && (
              <span className="absolute inset-0 flex items-center justify-center bg-army-950/60 text-lg font-semibold text-white">+{photos.length - 5}</span>
            )}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setActive(0)} className="mt-2 text-sm font-medium text-army-800 hover:underline sm:hidden">
        View all {photos.length} photos
      </button>

      {active !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-army-950/95" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button type="button" onClick={() => setActive(null)} className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:text-white" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => setActive((active - 1 + photos.length) % photos.length)} className="absolute left-2 rounded-full p-2 text-white/80 hover:text-white sm:left-6" aria-label="Previous photo">
            <ChevronLeft className="h-8 w-8" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[active].url} alt={`${title} — photo ${active + 1}`} className="max-h-[85vh] max-w-[90vw] object-contain" />
          <button type="button" onClick={() => setActive((active + 1) % photos.length)} className="absolute right-2 rounded-full p-2 text-white/80 hover:text-white sm:right-6" aria-label="Next photo">
            <ChevronRight className="h-8 w-8" />
          </button>
          <p className="absolute bottom-4 text-sm text-white/70">{active + 1} / {photos.length}</p>
        </div>
      )}
    </>
  );
}
