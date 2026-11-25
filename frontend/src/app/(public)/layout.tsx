import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { serverGet } from "@/lib/server-api";
import { PublicNav } from "./public-nav";

interface Contact { address: string | null; phone: string | null; email: string | null; officeHours: string | null }

async function estateContact(): Promise<Contact | null> {
  try {
    return (await serverGet<{ data: { contact: Contact } }>("/public/estate", 300))?.data.contact ?? null;
  } catch {
    return null;
  }
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const contact = await estateContact();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Home"><Brand subtitle="Abuja" /></Link>
          <PublicNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-army-900 text-white/80">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <Brand inverted subtitle="Abuja" />
            <p className="mt-4 max-w-sm text-sm text-white/60">A secure, well-managed residential estate. Every property on this site is reviewed by estate management before it is published.</p>
          </div>
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-gold-500">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/listings?type=rent" className="hover:text-white">Homes for rent</Link></li>
              <li><Link href="/listings?type=sale" className="hover:text-white">Homes for sale</Link></li>
              <li><Link href="/become-an-agent" className="hover:text-white">Become an agent</Link></li>
              <li><Link href="/request-access" className="hover:text-white">Resident access</Link></li>
            </ul>
          </div>
          <div id="contact">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-gold-500">Estate office</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {contact?.address ?? "Estate Management Office"}</li>
              {contact?.phone && <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <a href={`tel:${contact.phone}`} className="hover:text-white">{contact.phone}</a></li>}
              {contact?.email && <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a></li>}
              {contact?.officeHours && <li className="pl-6 text-white/60">{contact.officeHours}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/50 sm:px-6 lg:px-8">© {new Date().getFullYear()} Post Army Housing Estates.</p>
        </div>
      </footer>
    </div>
  );
}
