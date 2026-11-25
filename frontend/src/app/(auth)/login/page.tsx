"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { useAuth } from "@/modules/auth/auth-provider";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const session = await login(values);
      if (session.mustChangePassword) router.replace("/account/password?required=1");
      else router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : session.portal);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Sign-in failed. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-600">{formError}</div>}

      <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input id="email" type="email" autoComplete="email" className="pl-9" aria-invalid={!!errors.email} {...register("email")} />
        </div>
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message} required>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="px-9" aria-invalid={!!errors.password} {...register("password")} />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-900"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <div className="flex items-center justify-between">
        <Checkbox label="Remember me" {...register("remember")} />
        <Link href="/forgot-password" className="text-sm font-medium text-army-800 hover:underline">Forgot password?</Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-600">Use the email and password for your approved account.</p>
      <div className="mt-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <div className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-ink-600">
        <p>
          Resident without an account? <Link href="/request-access" className="font-medium text-army-800 hover:underline">Request access</Link>
        </p>
        <p>
          Property agent? <Link href="/become-an-agent" className="font-medium text-army-800 hover:underline">Apply for an agent account</Link>
        </p>
      </div>
    </div>
  );
}
