"use client";

import { useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

/**
 * Runs one API action at a time with a busy key, a success toast and a readable error toast.
 * Returns undefined when the action failed, so callers can stop without try/catch.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(key);
    try {
      const result = await fn();
      if (success) toast.success(success);
      return result;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The action failed. Please try again.");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  return { busy, run };
}

/** Copies API field errors onto a react-hook-form form. Returns false when the error had no field errors. */
export function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.errors.length === 0) return false;
  Object.entries(error.fieldErrors()).forEach(([field, message]) => form.setError(field.split(".")[0] as Path<T>, { message }));
  return true;
}

/** Converts a value from <input type="datetime-local"> to an ISO string with the browser's timezone. */
export function localToIso(local: string): string {
  return new Date(local).toISOString();
}

/** Formats a Date as the value an <input type="datetime-local"> expects, in local time. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
