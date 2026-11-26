"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/modules/auth/auth-provider";
import { strongPassword } from "@/modules/auth/password-schema";

const schema = z
  .object({ current_password: z.string().min(1, "Enter your current password."), password: strongPassword, password_confirmation: z.string() })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." })
  .refine((v) => v.password !== v.current_password, { path: ["password"], message: "Choose a password different from the current one." });
type Values = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const toast = useToast();
  const router = useRouter();
  const required = useSearchParams().get("required") === "1";
  const { session, refresh } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/auth/password/change", values);
      toast.success("Password changed");
      reset();
      refresh();
      if (required && session) router.replace(session.portal);
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) Object.entries(e.fieldErrors()).forEach(([f, m]) => setError(f as keyof Values, { message: m }));
      else toast.error(e instanceof ApiError ? e.message : "The password could not be changed.");
    }
  });

  return (
    <>
      <PageHeader title="Change password" breadcrumbs={[{ label: "Account" }, { label: "Change password" }]} />
      {required && <p role="alert" className="mb-4 max-w-xl rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-600">You must change your password before continuing.</p>}
      <Card className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-6">
          <Field label="Current password" htmlFor="current_password" error={errors.current_password?.message} required>
            <Input id="current_password" type="password" autoComplete="current-password" {...register("current_password")} />
          </Field>
          <Field label="New password" htmlFor="password" error={errors.password?.message} hint="8+ characters with upper and lower case, a number and a symbol." required>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Confirm new password" htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
            <Input id="password_confirmation" type="password" autoComplete="new-password" {...register("password_confirmation")} />
          </Field>
          <Button type="submit" loading={isSubmitting}>Change password</Button>
        </form>
      </Card>
    </>
  );
}
