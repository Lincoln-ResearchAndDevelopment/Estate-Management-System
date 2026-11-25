import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/shared/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-army-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#c6a04a_0,#c6a04a_1px,transparent_1px,transparent_14px)]" aria-hidden />
        <Link href="/" className="relative">
          <Brand inverted subtitle="Secure Estate Portal" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">Discipline, security and service for every household.</h2>
          <p className="mt-4 text-white/70">Residents, estate management, security and property agents work from one secure system.</p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck className="h-4 w-4 text-gold-500" aria-hidden /> Access is restricted to approved accounts.
        </p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mb-8 lg:hidden">
          <Link href="/"><Brand subtitle="Secure Estate Portal" /></Link>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
        <p className="mx-auto mt-10 w-full max-w-md text-xs text-ink-400">© {new Date().getFullYear()} Post Army Housing Estates. All rights reserved.</p>
      </main>
    </div>
  );
}
