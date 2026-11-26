"use client";

import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { applyFieldErrors } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  estate_address: z.string().trim().max(255),
  estate_phone: z.string().trim().max(40),
  estate_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]),
  office_hours: z.string().trim().max(120),
  about: z.string().trim().max(2000),
  bank_name: z.string().trim().max(80),
  account_name: z.string().trim().max(120),
  account_number: z.union([z.literal(""), z.string().regex(/^\d{10}$/, "Enter the 10-digit NUBAN account number.")]),
  gate_latitude: z.union([z.literal(""), z.string().regex(/^-?\d{1,2}(\.\d+)?$/, "e.g. 9.0579")]),
  gate_longitude: z.union([z.literal(""), z.string().regex(/^-?\d{1,3}(\.\d+)?$/, "e.g. 7.4951")]),
  gate_directions: z.string().trim().max(500),
});
type Values = z.infer<typeof schema>;
type Settings = Record<keyof Values, string | null>;

/** System settings: estate contact details (shown on the public site) and the bank account for transfers. */
export default function SettingsPage() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<{ data: Settings }>("/admin/settings") });
  const s = data?.data;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: s ? (Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(s[k as keyof Values] ?? "")])) as Values) : undefined,
  });

  const save = form.handleSubmit(async (v) => {
    try {
      await api.put("/admin/settings", Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val || null])));
      toast.success("Settings saved.");
      refetch();
    } catch (e) {
      if (!applyFieldErrors(form, e)) toast.error("Settings could not be saved.");
    }
  });
  const err = form.formState.errors;

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;
  return (
    <>
      <PageHeader title="Settings" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]} />
      {isLoading ? <Skeleton className="h-96" /> : (
        <form onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Estate office" description="Shown in the public website footer and on receipts." />
            <div className="space-y-4 p-5">
              <Field label="Address" htmlFor="s-addr" error={err.estate_address?.message}><Input id="s-addr" {...form.register("estate_address")} /></Field>
              <Field label="Phone" htmlFor="s-phone" error={err.estate_phone?.message}><Input id="s-phone" {...form.register("estate_phone")} /></Field>
              <Field label="Email" htmlFor="s-email" error={err.estate_email?.message}><Input id="s-email" type="email" {...form.register("estate_email")} /></Field>
              <Field label="Office hours" htmlFor="s-hours" error={err.office_hours?.message}><Input id="s-hours" placeholder="Mon–Fri, 8:00 AM – 5:00 PM" {...form.register("office_hours")} /></Field>
              <Field label="About the estate" htmlFor="s-about" error={err.about?.message}><Textarea id="s-about" rows={4} {...form.register("about")} /></Field>
            </div>
          </Card>
          <Card className="h-fit">
            <CardHeader title="Bank account for transfers" description="Residents see these details when they pay by bank transfer." />
            <div className="space-y-4 p-5">
              <Field label="Bank name" htmlFor="s-bank" error={err.bank_name?.message}><Input id="s-bank" {...form.register("bank_name")} /></Field>
              <Field label="Account name" htmlFor="s-acname" error={err.account_name?.message}><Input id="s-acname" {...form.register("account_name")} /></Field>
              <Field label="Account number" htmlFor="s-acno" error={err.account_number?.message}><Input id="s-acno" inputMode="numeric" maxLength={10} {...form.register("account_number")} /></Field>
            </div>
            <div className="space-y-4 border-t border-line p-5">
              <p className="text-sm font-semibold">Main gate location</p>
              <p className="text-xs text-ink-600">Used on the resident Direction page (Get Directions, Share Gate Pin). In Google Maps, long-press the gate and copy the two numbers.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Latitude" htmlFor="s-lat" error={err.gate_latitude?.message}><Input id="s-lat" inputMode="decimal" {...form.register("gate_latitude")} /></Field>
                <Field label="Longitude" htmlFor="s-lng" error={err.gate_longitude?.message}><Input id="s-lng" inputMode="decimal" {...form.register("gate_longitude")} /></Field>
              </div>
              <Field label="Directions to the gate" htmlFor="s-gdir" error={err.gate_directions?.message}><Textarea id="s-gdir" rows={2} placeholder="e.g. Second left after the filling station; main gate faces the expressway" {...form.register("gate_directions")} /></Field>
            </div>
            <div className="flex justify-end border-t border-line p-4"><Button type="submit" loading={form.formState.isSubmitting}>Save settings</Button></div>
          </Card>
        </form>
      )}
    </>
  );
}
