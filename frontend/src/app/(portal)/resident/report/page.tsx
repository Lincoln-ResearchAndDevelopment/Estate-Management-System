"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileWarning, Send, Siren } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { applyFieldErrors } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import type { Incident } from "@/types/modules";

const CATEGORIES = [
  ["suspicious_activity", "Suspicious person or activity"],
  ["theft", "Theft or attempted theft"],
  ["trespass", "Trespass / unauthorised entry"],
  ["vandalism", "Vandalism or damage"],
  ["noise", "Noise or disturbance"],
  ["fire_hazard", "Fire hazard"],
  ["other", "Something else"],
] as const;

const schema = z.object({
  title: z.string().trim().min(5, "Give it a short title (at least 5 characters).").max(150),
  category: z.string().min(1, "Choose what you are reporting."),
  location: z.string().trim().max(150),
  description: z.string().trim().min(10, "Tell security what happened (at least 10 characters).").max(5000),
});
type Values = z.infer<typeof schema>;

/** Figma "Report": residents report security concerns to the security team. For danger now, use PANIC. */
export default function ReportPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const reports = useQuery({ queryKey: ["resident", "reports", page], queryFn: () => api.get<Paginated<Incident>>("/resident/reports", { page }) });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", category: "", location: "", description: "" } });

  const submit = form.handleSubmit(async (v) => {
    try {
      await api.post("/resident/reports", { ...v, location: v.location || null });
      toast.success("Report sent. The security team has been notified.");
      form.reset();
      setPage(1);
      reports.refetch();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error("Your report could not be sent.");
    }
  });
  const err = form.formState.errors;

  return (
    <>
      <PageHeader title="Report to security" description="Tell the estate security team about anything that worries you. They will follow up." breadcrumbs={[{ label: "Report" }]} />
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-600/30 bg-danger-50 p-4 text-sm text-danger-600">
        <Siren className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>In danger right now?</strong> Use the red PANIC button at the bottom of the menu instead — it alerts security immediately.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="New report" />
          <form onSubmit={submit} noValidate className="space-y-4 p-5">
            <Field label="What are you reporting?" htmlFor="r-cat" error={err.category?.message} required>
              <Select id="r-cat" {...form.register("category")}><option value="">Choose…</option>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Title" htmlFor="r-title" error={err.title?.message} required><Input id="r-title" placeholder="e.g. Car alarm going off on Lugard Street" {...form.register("title")} /></Field>
            <Field label="Where?" htmlFor="r-loc" hint="Leave empty to use your unit."><Input id="r-loc" placeholder="Street, landmark or unit" {...form.register("location")} /></Field>
            <Field label="What happened?" htmlFor="r-desc" error={err.description?.message} required><Textarea id="r-desc" rows={5} {...form.register("description")} /></Field>
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}><Send className="h-4 w-4" /> Send to security</Button>
          </form>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="My reports" />
          {reports.error ? <ErrorState message={(reports.error as Error).message} onRetry={() => reports.refetch()} /> : reports.isLoading ? <Skeleton className="m-5 h-40" /> : !reports.data?.data.length ? (
            <EmptyState title="You have not sent any reports" icon={<FileWarning className="h-6 w-6" />} />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {reports.data.data.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-ink-600">{r.reference} · {titleCase(r.category)} · {formatDateTime(r.createdAt)}</p>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    {r.notes.length > 0 && (
                      <div className="mt-2 rounded-lg bg-canvas p-3 text-sm">
                        <p className="text-xs font-semibold text-ink-600">Latest from security</p>
                        <p>{r.notes[r.notes.length - 1].body}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination {...reports.data.meta} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
