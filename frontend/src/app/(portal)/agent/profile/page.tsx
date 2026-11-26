"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BadgeCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";

interface Profile { name: string; email: string; phone: string | null; agencyName: string | null; agencyRegNo: string | null; bio: string | null; status: string; verified: boolean }

const schema = z.object({
  agency_name: z.string().trim().max(120),
  agency_reg_no: z.string().trim().max(60),
  bio: z.string().trim().max(1000),
});
type Values = z.infer<typeof schema>;

export default function AgentProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["agent", "profile"], queryFn: () => api.get<{ data: Profile }>("/agent/profile") });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data) reset({ agency_name: data.data.agencyName ?? "", agency_reg_no: data.data.agencyRegNo ?? "", bio: data.data.bio ?? "" });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.patch<{ data: Profile }>("/agent/profile", { agency_name: values.agency_name || null, agency_reg_no: values.agency_reg_no || null, bio: values.bio || null });
      queryClient.setQueryData(["agent", "profile"], res);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The profile could not be saved.");
    }
  });

  return (
    <>
      <PageHeader title="Profile" breadcrumbs={[{ label: "Dashboard", href: "/agent" }, { label: "Profile" }]} />
      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : isLoading || !data ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="self-start p-5">
            <p className="flex items-center gap-1.5 text-lg font-semibold">{data.data.name}{data.data.verified && <BadgeCheck className="h-5 w-5 text-gold-500" aria-label="Verified" />}</p>
            <p className="mt-1 text-sm text-ink-600">{data.data.email}</p>
            <p className="text-sm text-ink-600">{data.data.phone}</p>
            <div className="mt-3"><StatusPill status={data.data.status} /></div>
            <p className="mt-4 text-xs text-ink-400">To change your name, email or phone, contact estate management.</p>
          </Card>
          <Card>
            <CardHeader title="Agency details" description="Shown on your public listings." />
            <form onSubmit={onSubmit} noValidate className="space-y-5 p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Agency name" htmlFor="agency_name" error={errors.agency_name?.message}><Input id="agency_name" {...register("agency_name")} /></Field>
                <Field label="Registration / CAC number" htmlFor="agency_reg_no" error={errors.agency_reg_no?.message}><Input id="agency_reg_no" {...register("agency_reg_no")} /></Field>
              </div>
              <Field label="About you" htmlFor="bio" error={errors.bio?.message}><Textarea id="bio" rows={5} maxLength={1000} {...register("bio")} /></Field>
              <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save profile</Button></div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
