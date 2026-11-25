"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ListingCard } from "@/modules/listings/listing-card";
import type { EstateInfo, Listing } from "@/types/api";

const FILTERS = ["type", "property_type", "bedrooms", "min_price", "max_price", "sector_id", "sort", "q"] as const;

/** SCR-LIST-02: results with a filter sidebar on desktop and a filter sheet on mobile; filters live in the URL. */
export function ListingSearch() {
  const { params, update, clear } = useListParams(FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const estate = useQuery({ queryKey: ["public", "estate"], queryFn: () => api.get<{ data: EstateInfo }>("/public/estate"), staleTime: 10 * 60_000 });

  const { page, ...filters } = params;
  const priceInvalid = !!filters.min_price && !!filters.max_price && Number(filters.min_price) > Number(filters.max_price);

  const results = useQuery({
    queryKey: ["public", "listings", params],
    queryFn: () => api.get<Paginated<Listing>>("/public/listings", { ...filters, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
    enabled: !priceInvalid,
  });

  const typeLabel = filters.type === "rent" ? "for rent" : filters.type === "sale" ? "for sale" : "for rent and sale";
  const activeCount = FILTERS.filter((k) => k !== "sort" && filters[k]).length;

  const filterPanel = (
    <div className="space-y-4">
      <Field label="Rent or buy" htmlFor="f-type">
        <Select id="f-type" value={filters.type} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All</option>
          <option value="rent">For rent</option>
          <option value="sale">For sale</option>
        </Select>
      </Field>
      <Field label="Property type" htmlFor="f-ptype">
        <Select id="f-ptype" value={filters.property_type} onChange={(e) => update({ property_type: e.target.value })}>
          <option value="">Any</option>
          {estate.data?.data.propertyTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </Field>
      <Field label="Bedrooms" htmlFor="f-beds">
        <Select id="f-beds" value={filters.bedrooms} onChange={(e) => update({ bedrooms: e.target.value })}>
          <option value="">Any</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="5">5+</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min price (₦)" htmlFor="f-min">
          <Input id="f-min" type="number" min={0} inputMode="numeric" defaultValue={filters.min_price} onBlur={(e) => update({ min_price: e.target.value })} />
        </Field>
        <Field label="Max price (₦)" htmlFor="f-max" error={priceInvalid ? "Must be at least the minimum." : undefined}>
          <Input id="f-max" type="number" min={0} inputMode="numeric" defaultValue={filters.max_price} onBlur={(e) => update({ max_price: e.target.value })} aria-invalid={priceInvalid} />
        </Field>
      </div>
      <Field label="Sector" htmlFor="f-sector">
        <Select id="f-sector" value={filters.sector_id} onChange={(e) => update({ sector_id: e.target.value })}>
          <option value="">All sectors</option>
          {estate.data?.data.sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="w-full">Clear filters</Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Properties {typeLabel}</h1>
          <p className="mt-1 text-sm text-ink-600" aria-live="polite">
            {results.data ? `${results.data.meta.total} propert${results.data.meta.total === 1 ? "y" : "ies"} found` : "Searching…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <Select id="sort" className="w-44" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5">{filterPanel}</div>
        </aside>

        <div>
          {results.isError ? (
            <div className="card"><ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} /></div>
          ) : results.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
          ) : results.data && results.data.data.length === 0 ? (
            <div className="card">
              <EmptyState title="No properties match your search" description="Try removing a filter or widening the price range." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {results.data?.data.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
              {results.data && (
                <div className="card mt-6">
                  <Pagination {...results.data.meta} onPageChange={(p) => { update({ page: p }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-army-950/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold">Filters</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close filters" className="rounded p-1 text-ink-400"><X className="h-5 w-5" /></button>
            </div>
            {filterPanel}
            <Button className="mt-4 w-full" onClick={() => setSheetOpen(false)}>Show results</Button>
          </div>
        </div>
      )}
    </div>
  );
}
