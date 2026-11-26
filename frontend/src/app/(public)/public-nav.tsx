"use client";

import Link from "next/link";
import { useAuth } from "@/modules/auth/auth-provider";

/**
 * Public header action: only "Sign in" (or "My portal" when already signed in). The public menu links were
 * removed at the client's request; Request access and Become an agent are linked from the sign-in page.
 */
export function PublicNav() {
  const { session } = useAuth();
  const cls = "inline-flex h-9 items-center rounded-lg bg-army-800 px-5 text-sm font-semibold text-white hover:bg-army-900";
  return session ? <Link href={session.portal} className={cls}>My portal</Link> : <Link href="/login" className={cls}>Sign in</Link>;
}
