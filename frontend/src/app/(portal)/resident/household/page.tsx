"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Car, Plus, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import type { Vehicle } from "@/types/modules";

interface Profile {
  user: { id: number; name: string; email: string; phone: string | null };
  relationship: string | null;
  isHead: boolean;
  unit: { code: string; street: string | null; sector: string | null; type: string | null } | null;
  members: { id: number; fullName: string; relationship: string; phone: string | null; status: string; hasLogin: boolean; isMe: boolean }[];
  vehicles: Vehicle[];
}

const phone = z.union([z.literal(""), z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE)]);
const profileSchema = z.object({ name: z.string().trim().min(2, "Enter your full name.").max(120), phone });
const memberSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name.").max(120),
  relationship: z.string().min(1, "Choose the relationship."),
  phone,
});
const vehicleSchema = z.object({
  plate_number: z
    .string()
    .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9-]{5,12}$/, "Use 5–12 letters, numbers or dashes, e.g. ABC123XY.")),
  make: z.string().trim().max(40),
  model: z.string().trim().max(40),
  colour: z.string().trim().max(30),
});

const RELATIONSHIPS = ["spouse", "child", "parent", "relative", "tenant", "sub_tenant", "domestic_staff"];

/** M03 household profile: personal details, household members and registered vehicles. */
export default function HouseholdPage() {
  const toast = useToast();
  const { busy, run } = useAction();
  const [memberOpen, setMemberOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [remove, setRemove] = useState<{ kind: "member" | "vehicle"; id: number; label: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["resident", "profile"], queryFn: () => api.get<{ data: Profile }>("/resident/profile") });
  const p = data?.data;

  const profileForm = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { name: p?.user.name ?? "", phone: p?.user.phone ?? "" } });
  const memberForm = useForm<z.infer<typeof memberSchema>>({ resolver: zodResolver(memberSchema), defaultValues: { full_name: "", relationship: "", phone: "" } });
  const vehicleForm = useForm<z.infer<typeof vehicleSchema>>({ resolver: zodResolver(vehicleSchema), defaultValues: { plate_number: "", make: "", model: "", colour: "" } });

  const saveProfile = profileForm.handleSubmit(async (v) => {
    try {
      await api.patch("/resident/profile", { name: v.name, phone: v.phone || null });
      toast.success("Your details were updated.");
      refetch();
    } catch (e) {
      if (!applyFieldErrors(profileForm, e)) toast.error("Your details could not be saved.");
    }
  });

  const addMember = memberForm.handleSubmit(async (v) => {
    try {
      await api.post("/resident/household/members", { ...v, phone: v.phone || null });
      toast.success(`${v.full_name} was added to your household.`);
      memberForm.reset();
      setMemberOpen(false);
      refetch();
    } catch (e) {
      if (!applyFieldErrors(memberForm, e)) toast.error("The member could not be added.");
    }
  });

  const addVehicle = vehicleForm.handleSubmit(async (v) => {
    try {
      await api.post("/resident/vehicles", { plate_number: v.plate_number, make: v.make || null, model: v.model || null, colour: v.colour || null });
      toast.success("Vehicle registered.");
      vehicleForm.reset();
      setVehicleOpen(false);
      refetch();
    } catch (e) {
      if (!applyFieldErrors(vehicleForm, e)) toast.error("The vehicle could not be registered.");
    }
  });

  const confirmRemove = async () => {
    if (!remove) return;
    const path = remove.kind === "member" ? `/resident/household/members/${remove.id}` : `/resident/vehicles/${remove.id}`;
    await run("remove", () => api.delete(path), `${remove.label} was removed.`);
    setRemove(null);
    refetch();
  };

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;

  return (
    <>
      <PageHeader title="My household" breadcrumbs={[{ label: "Home", href: "/resident" }, { label: "My household" }]} />
      {isLoading || !p ? (
        <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="My details" description={p.unit ? `Unit ${p.unit.code}${p.unit.street ? `, ${p.unit.street}` : ""}${p.unit.sector ? ` · ${p.unit.sector}` : ""}` : "No unit linked"} />
            <form onSubmit={saveProfile} className="space-y-4 p-5" noValidate>
              <Field label="Full name" htmlFor="name" error={profileForm.formState.errors.name?.message} required>
                <Input id="name" {...profileForm.register("name")} />
              </Field>
              <Field label="Phone number" htmlFor="phone" hint="Format: +2348012345678" error={profileForm.formState.errors.phone?.message}>
                <Input id="phone" inputMode="tel" {...profileForm.register("phone")} />
              </Field>
              <Field label="Email address" htmlFor="email" hint="Contact estate management to change your sign-in email.">
                <Input id="email" value={p.user.email} disabled readOnly />
              </Field>
              <div className="flex justify-end"><Button type="submit" loading={profileForm.formState.isSubmitting}>Save details</Button></div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Household members" action={p.isHead && <Button size="sm" onClick={() => setMemberOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>} />
            {p.members.length === 0 ? (
              <EmptyState title="No household members yet" />
            ) : (
              <ul className="divide-y divide-line">
                {p.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-medium">{m.fullName} {m.isMe && <span className="text-xs text-ink-400">(you)</span>}</p>
                      <p className="text-xs text-ink-600">{titleCase(m.relationship)}{m.phone ? ` · ${m.phone}` : ""}{m.hasLogin ? " · has portal access" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={m.status} />
                      {p.isHead && !m.isMe && (
                        <Button size="sm" variant="ghost" className="text-danger-600" aria-label={`Remove ${m.fullName}`} onClick={() => setRemove({ kind: "member", id: m.id, label: m.fullName })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Registered vehicles" description="Gate officers use this list to recognise household vehicles." action={p.isHead && <Button size="sm" onClick={() => setVehicleOpen(true)}><Plus className="h-4 w-4" /> Add vehicle</Button>} />
            {p.vehicles.length === 0 ? (
              <EmptyState title="No vehicles registered" icon={<Car className="h-6 w-6" />} />
            ) : (
              <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {p.vehicles.map((v) => (
                  <li key={v.id} className="flex items-start justify-between rounded-lg border border-line p-4">
                    <div>
                      <p className="font-mono text-lg font-semibold tracking-wider">{v.plateNumber}</p>
                      <p className="text-sm text-ink-600">{[v.colour, v.make, v.model].filter(Boolean).join(" ") || "Details not provided"}</p>
                    </div>
                    {p.isHead && (
                      <Button size="sm" variant="ghost" className="text-danger-600" aria-label={`Remove ${v.plateNumber}`} onClick={() => setRemove({ kind: "vehicle", id: v.id, label: v.plateNumber })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal open={memberOpen} onClose={() => setMemberOpen(false)} title="Add household member"
        footer={<><Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button><Button onClick={addMember} loading={memberForm.formState.isSubmitting}>Add member</Button></>}>
        <form onSubmit={addMember} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="m-name" error={memberForm.formState.errors.full_name?.message} required><Input id="m-name" {...memberForm.register("full_name")} /></Field>
          <Field label="Relationship" htmlFor="m-rel" error={memberForm.formState.errors.relationship?.message} required>
            <Select id="m-rel" {...memberForm.register("relationship")}>
              <option value="">Choose…</option>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
            </Select>
          </Field>
          <Field label="Phone number" htmlFor="m-phone" error={memberForm.formState.errors.phone?.message}><Input id="m-phone" inputMode="tel" {...memberForm.register("phone")} /></Field>
        </form>
      </Modal>

      <Modal open={vehicleOpen} onClose={() => setVehicleOpen(false)} title="Register a vehicle"
        footer={<><Button variant="outline" onClick={() => setVehicleOpen(false)}>Cancel</Button><Button onClick={addVehicle} loading={vehicleForm.formState.isSubmitting}>Register</Button></>}>
        <form onSubmit={addVehicle} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Plate number" htmlFor="v-plate" error={vehicleForm.formState.errors.plate_number?.message} required className="sm:col-span-2"><Input id="v-plate" className="uppercase" {...vehicleForm.register("plate_number")} /></Field>
          <Field label="Make" htmlFor="v-make"><Input id="v-make" {...vehicleForm.register("make")} /></Field>
          <Field label="Model" htmlFor="v-model"><Input id="v-model" {...vehicleForm.register("model")} /></Field>
          <Field label="Colour" htmlFor="v-colour"><Input id="v-colour" {...vehicleForm.register("colour")} /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!remove} onClose={() => setRemove(null)} onConfirm={confirmRemove} destructive loading={busy === "remove"}
        title={remove?.kind === "member" ? "Remove household member?" : "Remove vehicle?"}
        message={`${remove?.label} will be removed from your household records.`} confirmLabel="Remove" />
    </>
  );
}
