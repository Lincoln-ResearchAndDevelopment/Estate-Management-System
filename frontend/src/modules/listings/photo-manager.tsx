"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Listing } from "@/types/api";
import { listingsApi } from "./api";

const MIN = 3;
const MAX = 20;
const MAX_MB = 5;

/** Upload (incl. phone camera), delete and reorder listing photos; the first photo is the cover. */
export function PhotoManager({ listing, onChange, admin = false }: { listing: Listing; onChange: (l: Listing) => void; admin?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const photos = listing.photos;

  const run = async (fn: () => Promise<{ data: Listing }>, success: string) => {
    setBusy(true);
    try {
      const res = await fn();
      onChange(res.data);
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.errors[0]?.message ?? e.message) : "The photos could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const tooBig = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return toast.error(`${tooBig.name} is larger than ${MAX_MB} MB.`);
    if (photos.length + list.length > MAX) return toast.error(`A listing can have at most ${MAX} photos.`);
    run(() => listingsApi.uploadPhotos(listing.id, list, admin), `${list.length} photo${list.length > 1 ? "s" : ""} uploaded`);
  };

  const move = (index: number, delta: number) => {
    const order = photos.map((p) => p.id);
    const [item] = order.splice(index, 1);
    order.splice(index + delta, 0, item);
    run(() => listingsApi.reorderPhotos(listing.id, order), "Photo order saved");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          {photos.length} of {MAX} photos · at least {MIN} needed to submit. JPG, PNG or WebP up to {MAX_MB} MB.
        </p>
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={busy} disabled={photos.length >= MAX}>
          <ImagePlus className="h-4 w-4" /> Add photos
        </Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </div>

      {photos.length === 0 ? (
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line py-10 text-sm text-ink-600 hover:border-army-800 hover:bg-army-50">
          <ImagePlus className="h-8 w-8 text-army-800" aria-hidden />
          Add photos from your device or camera
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-lg border border-line bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-gold-500 px-1.5 py-0.5 text-[11px] font-semibold text-army-950">
                  <Star className="h-3 w-3" aria-hidden /> Cover
                </span>
              )}
              <div className="flex items-center justify-between gap-1 border-t border-line bg-white px-2 py-1.5">
                <div className="flex gap-1">
                  {!admin && (
                    <>
                      <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-ink-600 hover:bg-army-50 disabled:opacity-30" aria-label={`Move photo ${i + 1} earlier`}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={busy || i === photos.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-ink-600 hover:bg-army-50 disabled:opacity-30" aria-label={`Move photo ${i + 1} later`}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <button type="button" disabled={busy} onClick={() => run(() => listingsApi.deletePhoto(listing.id, p.id, admin), "Photo removed")} className="rounded p-1 text-danger-600 hover:bg-danger-50" aria-label={`Delete photo ${i + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
