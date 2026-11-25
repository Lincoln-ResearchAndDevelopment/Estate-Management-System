"use client";

import Link from "next/link";
import { Bell, KeyRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/modules/auth/auth-provider";

/**
 * Resident portal home. The resident dashboard, finance, household, security and marketplace screens
 * are built in later phases (see documentation/progress.md); this page shows only what works today.
 */
export default function ResidentHomePage() {
  const { session } = useAuth();
  if (!session) return null;

  return (
    <>
      <PageHeader title={`Welcome, ${session.user.name.split(" ")[0]}`} breadcrumbs={[{ label: "Home" }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your account" />
          <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
            <div><dt className="text-xs text-ink-600">Name</dt><dd className="font-medium">{session.user.name}</dd></div>
            <div><dt className="text-xs text-ink-600">Role</dt><dd className="font-medium">{session.user.roles?.[0]?.name ?? session.user.primaryRole}</dd></div>
            <div><dt className="text-xs text-ink-600">Email</dt><dd className="font-medium">{session.user.email}</dd></div>
            <div><dt className="text-xs text-ink-600">Status</dt><dd><StatusPill status={session.user.status} /></dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Available now" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Link href="/notifications" className="flex items-center gap-3 rounded-lg border border-line p-4 hover:bg-army-50"><Bell className="h-5 w-5 text-army-800" /> Notifications</Link>
            <Link href="/account/password" className="flex items-center gap-3 rounded-lg border border-line p-4 hover:bg-army-50"><KeyRound className="h-5 w-5 text-army-800" /> Change password</Link>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-600">
            Bills and payments, household, visitor passes, emergency alerts and the marketplace are being built and will appear here as each module is released.
          </p>
        </Card>
      </div>
    </>
  );
}
