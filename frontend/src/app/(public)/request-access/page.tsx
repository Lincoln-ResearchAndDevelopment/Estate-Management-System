"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError, toFormData } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { FileInput } from "@/components/shared/file-input";
import { NIGERIAN_PHONE, PHONE_MESSAGE, strongPassword } from "@/modules/auth/password-schema";

const RELATIONSHIPS = [
  ["primary_resident", "Head / Primary resident"],
  ["spouse", "Spouse"],
  ["child", "Child"],
  ["parent", "Parent"],
  ["relative", "Relative"],
  ["tenant", "Tenant"],
  ["sub_tenant", "Sub-tenant"],
] as const;

const mustTick = z.literal(true, { errorMap: () => ({ message: "This declaration is required." }) });

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name.").max(100).regex(/^[\p{L}\s\-'.]+$/u, "Use letters only."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE),
    relationship: z.enum(RELATIONSHIPS.map(([v]) => v) as [string, ...string[]], { errorMap: () => ({ message: "Choose your relationship." }) }),
    unit_id: z.number({ invalid_type_error: "Choose your house number from the list." }).int().positive("Choose your house number from the list."),
    national_id: z.string().trim().regex(/^\d{11}$/, "The NIN must be 11 digits."),
    password: strongPassword,
    password_confirmation: z.string(),
    declaration_inside_estate: mustTick,
    declaration_info_correct: mustTick,
    declaration_agree_rules: mustTick,
    profile_photo: z.instanceof(File).nullable().refine((f) => f !== null, "Upload a profile photo."),
    face_capture: z.instanceof(File).nullable().refine((f) => f !== null, "Take a face photo."),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

interface UnitOption { id: number; code: string; street: string | null }

/** SCR-AUTH-02 Request Resident Access. Creates a pending request that EM/SA approve. */
export default function RequestAccessPage() {
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);
  const debouncedUnit = useDebouncedValue(unitQuery);

  const { register, control, handleSubmit, setValue, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "+234", profile_photo: null, face_capture: null } as Partial<Values>,
  });

  useEffect(() => {
    if (debouncedUnit.length < 2 || selectedUnit?.code === debouncedUnit) {
      setUnitOptions([]);
      return;
    }
    const controller = new AbortController();
    api.get<{ data: UnitOption[] }>("/public/units/lookup", { q: debouncedUnit }, controller.signal)
      .then((r) => setUnitOptions(r.data))
      .catch(() => setUnitOptions([]));
    return () => controller.abort();
  }, [debouncedUnit, selectedUnit]);

  const chooseUnit = (u: UnitOption) => {
    setSelectedUnit(u);
    setUnitQuery(u.code);
    setUnitOptions([]);
    setValue("unit_id", u.id, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await api.post<{ data: { reference: string } }>("/auth/access-requests", toFormData(values));
      setReference(res.data.reference);
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) {
        Object.entries(e.fieldErrors()).forEach(([f, m]) => setFieldError(f as keyof Values, { message: m }));
      } else setError(e instanceof ApiError ? e.message : "Your request could not be sent.");
    }
  });

  if (reference) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success-600" aria-hidden />
        <h1 className="mt-4 text-3xl font-semibold">Request submitted</h1>
        <p className="mt-2 text-ink-600">Your reference is <span className="font-semibold text-ink-900">{reference}</span>. You will be notified by email once management approves your request.</p>
        <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Request resident access</h1>
      <p className="mt-2 text-ink-600">Only registered residents can use the resident portal. Registration requests require management approval.</p>

      <form onSubmit={onSubmit} noValidate className="card mt-8 space-y-6 p-6">
        {error && <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
            <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register("full_name")} />
          </Field>
          <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} required>
            <Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Family relationship" htmlFor="relationship" error={errors.relationship?.message} required>
            <Select id="relationship" defaultValue="" aria-invalid={!!errors.relationship} {...register("relationship")}>
              <option value="" disabled>Choose…</option>
              {RELATIONSHIPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="House number" htmlFor="unit" error={errors.unit_id?.message} hint={selectedUnit?.street ? `Street: ${selectedUnit.street}` : "Start typing, then choose from the list."} required>
            <div className="relative">
              <Input
                id="unit"
                role="combobox"
                aria-expanded={unitOptions.length > 0}
                aria-controls="unit-options"
                aria-autocomplete="list"
                autoComplete="off"
                value={unitQuery}
                aria-invalid={!!errors.unit_id}
                onChange={(e) => {
                  setUnitQuery(e.target.value);
                  setSelectedUnit(null);
                  setValue("unit_id", undefined as unknown as number);
                }}
              />
              {unitOptions.length > 0 && (
                <ul id="unit-options" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
                  {unitOptions.map((u) => (
                    <li key={u.id} role="option" aria-selected={false}>
                      <button type="button" onClick={() => chooseUnit(u)} className="block w-full px-3 py-2 text-left text-sm hover:bg-army-50">
                        <span className="font-medium">{u.code}</span>
                        {u.street && <span className="text-ink-600"> · {u.street}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <Field label="National Identification Number (NIN)" htmlFor="national_id" error={errors.national_id?.message} required>
            <Input id="national_id" inputMode="numeric" maxLength={11} aria-invalid={!!errors.national_id} {...register("national_id")} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with upper and lower case, a number and a symbol." required>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
            <Input id="password_confirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller name="profile_photo" control={control} render={({ field }) => (
            <FileInput label="Profile picture" accept="image/jpeg,image/png" maxMb={5} value={field.value} onChange={field.onChange} error={errors.profile_photo?.message} hint="JPG or PNG, max 5 MB" required />
          )} />
          <Controller name="face_capture" control={control} render={({ field }) => (
            <FileInput label="Face verification photo" accept="image/jpeg,image/png" maxMb={5} value={field.value} onChange={field.onChange} error={errors.face_capture?.message} hint="Look straight at the camera in good light" capture="user" required />
          )} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Declarations</legend>
          {([
            ["declaration_inside_estate", "I am currently a resident of the estate."],
            ["declaration_info_correct", "The information I have provided is correct."],
            ["declaration_agree_rules", "I agree to abide by the estate rules and bylaws."],
          ] as const).map(([name, label]) => (
            <div key={name}>
              <Checkbox label={label} {...register(name)} />
              {errors[name] && <p role="alert" className="ml-6 mt-1 text-xs text-danger-600">{errors[name]?.message}</p>}
            </div>
          ))}
        </fieldset>

        <p className="rounded-lg bg-sand-50 px-4 py-3 text-xs text-ink-600">
          Your NIN and photos are stored securely and used only to verify your identity, in line with the Nigeria Data Protection Act 2023.
        </p>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">Submit registration</Button>
      </form>
    </div>
  );
}
