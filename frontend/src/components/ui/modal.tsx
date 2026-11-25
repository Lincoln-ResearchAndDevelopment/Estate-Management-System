"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Field, Select, Textarea } from "./form";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

/** Accessible dialog built on the native <dialog> element (focus trap and Escape handled by the browser). */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-army-950/50",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-3xl",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-ink-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-canvas hover:text-ink-900" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

/** FR-GEN-09: destructive actions name the record and say whether they can be undone. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", destructive, loading }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-3 text-sm text-ink-600">
        {destructive && <AlertTriangle className="h-5 w-5 shrink-0 text-danger-600" aria-hidden />}
        <div>{message}</div>
      </div>
    </Modal>
  );
}

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  presets?: string[];
  destructive?: boolean;
  loading?: boolean;
  error?: string;
}

/** Reject / withdraw / delete with a required reason (10–500 characters) and optional preset reasons. */
export function ReasonDialog({ open, onClose, title, description, ...formProps }: ReasonDialogProps) {
  // The form mounts only while the dialog is open, so every opening starts empty.
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <ReasonForm onClose={onClose} {...formProps} />
    </Modal>
  );
}

function ReasonForm({ onClose, onSubmit, confirmLabel, presets = [], destructive, loading, error }: Omit<ReasonDialogProps, "open" | "title" | "description">) {
  const [preset, setPreset] = useState("");
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const reason = [preset && preset !== "Other" ? preset : "", text].filter(Boolean).join(": ").trim();
  const invalid = reason.length < 10 || reason.length > 500;

  return (
    <div className="space-y-4">
      {presets.length > 0 && (
        <Field label="Reason" htmlFor="reason-preset">
          <Select id="reason-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="">Choose a reason…</option>
            {presets.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field
        label={presets.length ? "Details" : "Reason"}
        htmlFor="reason-text"
        required
        error={(touched && invalid ? "Give a reason of 10 to 500 characters." : undefined) ?? error}
        hint="The reason is shown to the person affected."
      >
        <Textarea id="reason-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-invalid={touched && invalid} />
      </Field>
      <div className="-mx-5 -mb-4 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          loading={loading}
          onClick={() => {
            setTouched(true);
            if (!invalid) onSubmit(reason);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
