"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileInputProps {
  label: string;
  accept: string;
  maxMb: number;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  /** "user" opens the front camera on phones (face capture); "environment" the rear camera. */
  capture?: "user" | "environment";
}

/** File drop-zone with type/size check and image preview. The server validates again. */
export function FileInput({ label, accept, maxMb, value, onChange, error, hint, required, capture }: FileInputProps) {
  const id = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const preview = useMemo(() => (value && value.type.startsWith("image/") ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      setLocalError(`The file must be ${maxMb} MB or smaller.`);
      return;
    }
    onChange(file);
  };

  const message = localError ?? error;

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-ink-900">
        {label}
        {required && <span className="ml-0.5 text-danger-600" aria-hidden>*</span>}
      </span>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-12 w-12 rounded object-cover" />
          ) : (
            <FileText className="h-8 w-8 text-army-800" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="text-xs text-ink-600">{(value.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-ink-400 hover:text-danger-600" aria-label={`Remove ${value.name}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-army-800 hover:bg-army-50",
            message ? "border-danger-600" : "border-line",
          )}
        >
          <Upload className="h-6 w-6 text-army-800" aria-hidden />
          <span className="text-sm font-medium">Choose a file{capture ? " or take a photo" : ""}</span>
          <span className="text-xs text-ink-400">{hint ?? `Max ${maxMb} MB`}</span>
        </label>
      )}
      <input id={id} type="file" accept={accept} capture={capture} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {message && <p role="alert" className="text-xs text-danger-600">{message}</p>}
    </div>
  );
}
