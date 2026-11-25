"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError, toFormData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { FileInput } from "@/components/shared/file-input";
import { NIGERIAN_PHONE, PHONE_MESSAGE, strongPassword } from "@/modules/auth/password-schema";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name.").max(100).regex(/^[\p{L}\s\-'.]+$/u, "Use letters only."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE),
    agency_name: z.string().trim().max(120).optional(),
    agency_reg_no: z.string().trim().max(60).optional(),
    id_document: z.instanceof(File, { message: "Upload a government-issued ID." }).nullable().refine((f) => f !== null, "Upload a government-issued ID."),
    profile_photo: z.instanceof(File).nullable(),
    password: strongPassword,
    password_confirmation: z.string(),
    accept_terms: z.literal(true, { errorMap: () => ({ message: "Accept the terms to continue." }) }),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

/** SCR-LIST-10 Become an Agent. The account stays pending until EM/SA approve it. */
export default function BecomeAgentPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "+234", id_document: null, profile_photo: null } as Partial<Values>,
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post("/auth/agent-applications", toFormData(values));
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) {
        Object.entries(e.fieldErrors()).forEach(([f, m]) => setFieldError(f as keyof Values, { message: m }));
      } else setError(e instanceof ApiError ? e.message : "Your application could not be sent.");
    }
  });

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success-600" aria-hidden />
        <h1 className="mt-4 text-3xl font-semibold">Application received</h1>
        <p className="mt-2 text-ink-600">Estate management will review your application and email you once it is approved. You can then sign in and add listings.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Become an agent</h1>
      <p className="mt-2 text-ink-600">Agents list estate properties for rent or sale. Every listing is reviewed by estate management before it appears on this website.</p>

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
          <Field label="Agency name" htmlFor="agency_name" error={errors.agency_name?.message} hint="Optional">
            <Input id="agency_name" {...register("agency_name")} />
          </Field>
          <Field label="Agency registration / CAC number" htmlFor="agency_reg_no" error={errors.agency_reg_no?.message} hint="Optional">
            <Input id="agency_reg_no" {...register("agency_reg_no")} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller name="id_document" control={control} render={({ field }) => (
            <FileInput label="Government ID" accept=".pdf,image/jpeg,image/png" maxMb={10} value={field.value} onChange={field.onChange} error={errors.id_document?.message} hint="PDF, JPG or PNG, max 10 MB" required />
          )} />
          <Controller name="profile_photo" control={control} render={({ field }) => (
            <FileInput label="Profile photo" accept="image/jpeg,image/png" maxMb={5} value={field.value} onChange={field.onChange} error={errors.profile_photo?.message} hint="Optional · JPG or PNG, max 5 MB" capture="user" />
          )} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with upper and lower case, a number and a symbol." required>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
            <Input id="password_confirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
          </Field>
        </div>

        <div>
          <Checkbox label="I confirm the information is accurate and I agree to the estate's listing rules." {...register("accept_terms")} />
          {errors.accept_terms && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.accept_terms.message}</p>}
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">Submit application</Button>
      </form>
    </div>
  );
}
