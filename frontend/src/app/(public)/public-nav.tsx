"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/modules/auth/auth-provider";

const links = [
  { href: "/listings?type=rent", label: "Rent" },
  { href: "/listings?type=sale", label: "Buy" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export function PublicNav() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  const accountLink = session ? (
    <Link href={session.portal} className="inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">My portal</Link>
  ) : (
    <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">Sign in</Link>
  );

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm font-medium text-ink-600 hover:text-army-900">{l.label}</Link>
        ))}
        <Link href="/become-an-agent" className="text-sm font-medium text-olive-600 hover:text-olive-700">Become an Agent</Link>
        {accountLink}
      </nav>
      <button type="button" className="rounded-lg p-2 text-ink-600 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-white px-4 pb-4 shadow-lg md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1 pt-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-army-50">{l.label}</Link>
            ))}
            <Link href="/become-an-agent" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-olive-600 hover:bg-army-50">Become an Agent</Link>
            <div className="pt-2">{accountLink}</div>
          </nav>
        </div>
      )}
    </>
  );
}
