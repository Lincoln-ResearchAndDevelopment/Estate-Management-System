"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api.post("/auth/password/forgot", { email });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed. Please try again.");
    }
  });

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-12 w-12 text-success-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-ink-600">If an account exists for that address, we have sent a link to reset your password. The link expires in 60 minutes.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-army-800 hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-ink-600">Enter your account email and we will send you a reset link.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {error && <div role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">{error}</div>}
        <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-army-800 hover:underline">Back to sign in</Link>
    </div>
  );
}
