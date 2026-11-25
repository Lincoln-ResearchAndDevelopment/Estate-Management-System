import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Trees, Zap } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { ListingCard } from "@/modules/listings/listing-card";
import type { EstateInfo, Listing, Paginated } from "@/types/api";

export const revalidate = 60;

async function loadLanding() {
  try {
    const [estate, featured, latest] = await Promise.all([
      serverGet<{ data: EstateInfo }>("/public/estate"),
      serverGet<{ data: Listing[] }>("/public/listings/featured"),
      serverGet<Paginated<Listing>>("/public/listings?pageSize=6"),
    ]);
    return { estate: estate?.data ?? null, featured: featured?.data ?? [], latest: latest?.data ?? [], error: false };
  } catch {
    return { estate: null, featured: [], latest: [], error: true };
  }
}

const selectClass = "h-12 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-900 focus:border-army-800 focus:outline-none focus:ring-2 focus:ring-army-800/20";

export default async function LandingPage() {
  const { estate, featured, latest, error } = await loadLanding();

  return (
    <>
      {/* Hero with search (plain GET form: works without JavaScript) */}
      <section className="relative overflow-hidden bg-army-900">
        <div className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(135deg,#c6a04a_0,#c6a04a_1px,transparent_1px,transparent_16px)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">Post Army Housing Estates · Abuja</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">Find a secure home in a disciplined, well-run estate.</h1>
          <p className="mt-4 max-w-2xl text-white/70">Every property listed here has been reviewed and approved by estate management.</p>

          <form action="/listings" method="get" className="mt-8 grid gap-3 rounded-xl bg-white p-3 shadow-lg sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <label className="sr-only" htmlFor="hero-type">Rent or buy</label>
            <select id="hero-type" name="type" className={selectClass} defaultValue="">
              <option value="">Rent or buy</option>
              <option value="rent">For rent</option>
              <option value="sale">For sale</option>
            </select>
            <label className="sr-only" htmlFor="hero-ptype">Property type</label>
            <select id="hero-ptype" name="property_type" className={selectClass} defaultValue="">
              <option value="">Any property type</option>
              {estate?.propertyTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="hero-beds">Bedrooms</label>
            <select id="hero-beds" name="bedrooms" className={selectClass} defaultValue="">
              <option value="">Any bedrooms</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} bedroom{n > 1 ? "s" : ""}</option>)}
              <option value="5">5+ bedrooms</option>
            </select>
            <label className="sr-only" htmlFor="hero-max">Maximum price (₦)</label>
            <input id="hero-max" name="max_price" type="number" min={0} step={50000} placeholder="Max price (₦)" className={selectClass} />
            <button type="submit" className="h-12 rounded-lg bg-gold-500 px-6 text-sm font-semibold text-army-950 hover:bg-gold-500/90">Search</button>
          </form>

          {estate && (
            <dl className="mt-8 flex flex-wrap gap-8 text-white">
              <div><dt className="text-xs uppercase tracking-wider text-white/60">Live listings</dt><dd className="font-display text-3xl font-semibold">{estate.stats.liveListings}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-white/60">For rent</dt><dd className="font-display text-3xl font-semibold">{estate.stats.forRent}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-white/60">For sale</dt><dd className="font-display text-3xl font-semibold">{estate.stats.forSale}</dd></div>
            </dl>
          )}
        </div>
      </section>

      {error && (
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <p role="alert" className="rounded-lg border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-600">
            Property listings are temporarily unavailable. Please try again shortly.
          </p>
        </div>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold">Featured properties</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Latest listings</h2>
          <Link href="/listings" className="inline-flex items-center gap-1 text-sm font-medium text-army-800 hover:underline">View all properties <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {latest.length === 0 && !error ? (
          <p className="mt-6 rounded-lg bg-canvas px-4 py-10 text-center text-sm text-ink-600">No properties are listed right now. Please check back soon.</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      <section id="about" className="bg-sand-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-olive-600">About the estate</p>
            <h2 className="mt-2 text-3xl font-semibold">Order, security and community</h2>
            <p className="mt-4 text-ink-600">
              Post Army Housing Estates is a gated residential community in Abuja. Estate management oversees access control, security response and
              essential services so residents can live with confidence.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, title: "Controlled access", text: "Gate checks, visitor passes and round-the-clock security." },
              { icon: Building2, title: "Managed estate", text: "Maintained roads, streets and shared facilities." },
              { icon: Zap, title: "Essential services", text: "Water, waste and power services coordinated by management." },
              { icon: Trees, title: "Community", text: "A calm environment for families and professionals." },
            ].map((f) => (
              <li key={f.title} className="card p-5">
                <f.icon className="h-6 w-6 text-army-800" aria-hidden />
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-ink-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="card flex flex-col items-start justify-between gap-4 bg-army-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Are you a property agent?</h2>
            <p className="mt-1 text-sm text-ink-600">Apply for an agent account to list estate properties. Listings go live after management approval.</p>
          </div>
          <Link href="/become-an-agent" className="inline-flex h-11 items-center rounded-lg bg-olive-600 px-5 text-sm font-medium text-white hover:bg-olive-700">Become an agent</Link>
        </div>
      </section>
    </>
  );
}
