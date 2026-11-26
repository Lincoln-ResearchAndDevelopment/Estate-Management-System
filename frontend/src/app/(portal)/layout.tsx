"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { portalFromPath, portalFromSession, type Portal } from "@/components/layout/nav";
import { Skeleton } from "@/components/ui/states";
import { useAuth } from "@/modules/auth/auth-provider";

/** Which permissions open each portal. The API re-checks every request; this only guards navigation. */
const PORTAL_ACCESS: Record<Portal, string[] | "resident"> = {
  admin: ["dashboard.admin", "users.view", "listings.review", "access_requests.view", "agents.view", "audit.view"],
  agent: ["listings.manage_own"],
  resident: "resident",
  security: ["security.respond", "security.view", "access.gate", "access.view", "blacklist.view", "security.reports"],
  store: ["store.manage_own"],
};

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 bg-army-900 lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { session, loading, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    // Roles that must use two-factor sign-in are sent to set it up before anything else (FR-AUTH-12).
    else if (session?.mfaSetupRequired && !pathname.startsWith("/account/security")) router.replace("/account/security?required=1");
  }, [loading, session, pathname, router]);

  if (loading || !session) return <FullPageLoader />;

  const isPortalPath = /^\/(admin|agent|resident|security|store)(\/|$)/.test(pathname);
  const portal = isPortalPath ? portalFromPath(pathname) : portalFromSession(session.portal);
  const rule = PORTAL_ACCESS[portal];
  const allowed = rule === "resident" ? session.portal === "/resident" : can(rule);

  return (
    <AppShell portal={allowed ? portal : portalFromSession(session.portal)}>
      {allowed ? (
        <Suspense fallback={<Skeleton className="h-72" />}>{children}</Suspense>
      ) : (
        <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-danger-600" aria-hidden />
          <h1 className="mt-3 text-xl font-semibold">You do not have access to this page</h1>
          <p className="mt-2 text-sm text-ink-600">Your role does not include this area. If you think this is wrong, contact estate management.</p>
          <Link href={session.portal} className="mt-5 inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">
            Go to my portal
          </Link>
        </div>
      )}
    </AppShell>
  );
}
