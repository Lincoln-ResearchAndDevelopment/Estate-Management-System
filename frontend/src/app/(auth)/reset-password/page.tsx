"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { strongPassword } from "@/modules/auth/password-schema";

const schema = z
  .object({ password: strongPassword, password_confirmation: z.string() })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const isInvite = params.get("invite") === "1";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  if (!token || !email) {
    return (
      <div role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">
        This link is incomplete. Use the link from your email, or <Link href="/forgot-password" className="font-medium underline">request a new one</Link>.
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
        <h2 className="mt-4 text-2xl font-semibold">Password saved</h2>
        <p className="mt-2 text-sm text-ink-600">You can now sign in with your new password.</p>
        <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white">Sign in</Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post("/auth/password/reset", { token, email, ...values });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError) {
        const fields = e.fieldErrors();
        if (fields.password) setFieldError("password", { message: fields.password });
        setError(fields.token ?? (fields.password ? null : e.message));
      } else setError("Request failed. Please try again.");
    }
  });

  return (
    <>
      <h1 className="text-3xl font-semibold">{isInvite ? "Set your password" : "Reset password"}</h1>
      <p className="mt-1 text-sm text-ink-600">For {email}</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {error && <div role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">{error}</div>}
        <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with upper and lower case, a number and a symbol." required>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
          <Input id="password_confirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Save password</Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
