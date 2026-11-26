"use client";

// KAN-67 / KAN-68: public landing page. Shows only listings an admin has approved.
// No Figma design exists for this page; it follows the estate's existing red/gold palette.
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { BedDouble, Bath, MapPin, Search } from "lucide-react";
import { ApiListing, fetchPublicListings } from "@/services/listingsApi";
import { formatNaira } from "@/components/agent-portal/portalUtils";

const KINDS = [
  { v: "", label: "Rent, sale and more" },
  { v: "rent", label: "For rent" },
  { v: "sale", label: "For sale" },
  { v: "other", label: "Other" },
];

export default function LandingPage() {
  const [filters, setFilters] = useState({ q: "", listing_type: "", property_type: "", beds: "", max_price: "" });
  const [items, setItems] = useState<ApiListing[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async (f: typeof filters) => {
    setState("loading");
    try {
      const r = await fetchPublicListings(f);
      setItems(r.data);
      setTotal(r.meta.total);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-extrabold text-primary">LincolnEstate</span>
          <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover">
            Sign in
          </Link>
        </div>
      </header>

      <section className="bg-dark px-4 py-12 text-center text-white">
        <h1 className="text-3xl font-extrabold tracking-tight">Find a home in the estate</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
          Houses and properties for rent or sale, listed by our estate agents and approved by the estate office.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(filters);
          }}
          className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-2 rounded-2xl bg-white p-3 text-left text-slate-800 shadow-xl sm:grid-cols-6"
        >
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search" value={filters.q} onChange={set("q")} placeholder="Area, street or title" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <select aria-label="Listing type" value={filters.listing_type} onChange={set("listing_type")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <select aria-label="Bedrooms" value={filters.beds} onChange={set("beds")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">Any beds</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ beds</option>)}
          </select>
          <input aria-label="Maximum price" inputMode="numeric" value={filters.max_price} onChange={set("max_price")} placeholder="Max price (₦)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover">Search</button>
        </form>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {state === "loading" && <p className="text-center text-sm text-slate-500">Loading listings…</p>}
        {state === "error" && <p className="text-center text-sm text-rose-600">Listings could not be loaded. Please try again shortly.</p>}
        {state === "ready" && items.length === 0 && <p className="text-center text-sm text-slate-500">No listings match your search yet.</p>}
        {state === "ready" && items.length > 0 && (
          <>
            <p className="mb-4 text-xs font-semibold text-slate-500">{total} listing{total === 1 ? "" : "s"}</p>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l) => (
                <li key={l.id}>
                  <Link href={`/listings/${l.id}`} className="block overflow-hidden rounded-2xl border border-slate-100 bg-white transition-shadow hover:shadow-lg">
                    <div className="h-40 bg-gradient-to-br from-rose-200 to-red-300" />
                    <div className="space-y-2 p-4">
                      <span className="rounded-full bg-primary-light px-2.5 py-1 text-[10px] font-bold uppercase text-primary">
                        {l.listing_type === "rent" ? "For rent" : l.listing_type === "sale" ? "For sale" : "Property"}
                      </span>
                      <h2 className="font-bold text-slate-800">{l.title}</h2>
                      <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{l.address}, {l.zone}</p>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-base font-extrabold text-primary">
                          {formatNaira(l.price)}
                          {l.price_period === "per_year" && <span className="text-xs font-semibold text-slate-400"> / year</span>}
                        </p>
                        <p className="flex items-center gap-3 text-xs text-slate-500">
                          {l.beds != null && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{l.beds}</span>}
                          {l.baths != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{l.baths}</span>}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
