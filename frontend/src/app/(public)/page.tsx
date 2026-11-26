import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { ListingCard } from "@/modules/listings/listing-card";
import type { Listing, Paginated } from "@/types/api";

export const dynamic = "force-dynamic";

type Params = { q?: string; type?: string; bedrooms?: string; max_price?: string; page?: string };

const field = "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-army-800 focus:outline-none focus:ring-2 focus:ring-army-800/20";

/** Only pass filters the API accepts, so a hand-edited URL cannot break the page. */
function cleanFilters(p: Params) {
  const out: Record<string, string> = {};
  if (p.q?.trim()) out.q = p.q.trim().slice(0, 100);
  if (p.type === "rent" || p.type === "sale") out.type = p.type;
  if (p.bedrooms && /^\d{1,2}$/.test(p.bedrooms)) out.bedrooms = p.bedrooms;
  if (p.max_price && /^\d{1,12}$/.test(p.max_price)) out.max_price = p.max_price;
  if (p.page && /^\d{1,4}$/.test(p.page)) out.page = p.page;
  return out;
}

async function loadListings(filters: Record<string, string>) {
  try {
    const qs = new URLSearchParams({ ...filters, pageSize: "12" }).toString();
    return { result: await serverGet<Paginated<Listing>>(`/public/listings?${qs}`, 0), error: false };
  } catch {
    return { result: null, error: true };
  }
}

function pageHref(filters: Record<string, string>, page: number) {
  const qs = new URLSearchParams({ ...filters, page: String(page) }).toString();
  return `/?${qs}#listings`;
}

/**
 * Public landing page: hero with search, then the approved listings that match. Search is a plain GET
 * form, so it works without JavaScript and results can be bookmarked or shared.
 */
export default async function LandingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = cleanFilters(await searchParams);
  const { result, error } = await loadListings(filters);
  const listings = result?.data ?? [];
  const meta = result?.meta;
  const total = meta?.total ?? listings.length;

  return (
    <>
      <section className="relative overflow-hidden bg-army-900">
        {/* No estate photograph has been supplied: a textured Army-green backdrop stands in until one is. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(85,107,47,0.55),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(198,160,74,0.18),transparent_55%)]" aria-hidden />
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#c6a04a_0,#c6a04a_1px,transparent_1px,transparent_18px)]" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <p className="inline-block rounded-full border border-gold-500/50 bg-gold-500/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-100 sm:text-xs">
            Post Army Housing Estate · Residential &amp; Commercial
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">Find your dream home in the estate</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/80 sm:text-base">
            Verified houses, modern apartments, and prime properties for rent or purchase, vetted and approved directly by the estate management office.
          </p>

          <form action="/" method="get" className="mx-auto mt-8 grid max-w-4xl gap-2 rounded-xl bg-white p-2.5 text-left shadow-xl sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <label className="sr-only" htmlFor="hero-q">Area, street or title</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input id="hero-q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Area, street or title" maxLength={100} className={`${field} pl-9`} />
            </div>
            <label className="sr-only" htmlFor="hero-type">Rent or sale</label>
            <select id="hero-type" name="type" defaultValue={filters.type ?? ""} className={field}>
              <option value="">Rent and sale</option>
              <option value="rent">For rent</option>
              <option value="sale">For sale</option>
            </select>
            <label className="sr-only" htmlFor="hero-beds">Bedrooms</label>
            <select id="hero-beds" name="bedrooms" defaultValue={filters.bedrooms ?? ""} className={field}>
              <option value="">Any beds</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} bed{n > 1 ? "s" : ""}</option>)}
              <option value="5">5+ beds</option>
            </select>
            <label className="sr-only" htmlFor="hero-max">Maximum price (₦)</label>
            <input id="hero-max" name="max_price" type="number" min={0} step={50000} defaultValue={filters.max_price ?? ""} placeholder="Max price (₦)" className={field} />
            <button type="submit" className="h-11 rounded-lg bg-army-800 px-8 text-sm font-semibold text-white hover:bg-army-900 sm:col-span-2 lg:col-span-1">Search</button>
          </form>
        </div>
      </section>

      <section id="listings" className="bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {error ? (
            <p role="alert" className="rounded-lg border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-600">Property listings are temporarily unavailable. Please try again shortly.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-olive-600">{total} listing{total === 1 ? "" : "s"}</p>
                {Object.keys(filters).some((k) => k !== "page") && <Link href="/#listings" className="text-sm font-medium text-army-800 hover:underline">Clear search</Link>}
              </div>
              {listings.length === 0 ? (
                <p className="mt-6 rounded-xl bg-white px-4 py-12 text-center text-sm text-ink-600">No properties match your search. Try fewer filters or check back soon.</p>
              ) : (
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
                </div>
              )}
              {meta && meta.totalPages > 1 && (
                <nav aria-label="Listing pages" className="mt-8 flex items-center justify-center gap-3 text-sm">
                  {meta.page > 1 ? <Link href={pageHref(filters, meta.page - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 hover:bg-army-50"><ChevronLeft className="h-4 w-4" /> Previous</Link> : null}
                  <span className="text-ink-600">Page {meta.page} of {meta.totalPages}</span>
                  {meta.page < meta.totalPages ? <Link href={pageHref(filters, meta.page + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 hover:bg-army-50">Next <ChevronRight className="h-4 w-4" /></Link> : null}
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
