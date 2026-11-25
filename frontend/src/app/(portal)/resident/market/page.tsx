"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Store as StoreIcon } from "lucide-react";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { SearchInput } from "@/components/shared/search-input";
import type { Store } from "@/types/modules";

const CATEGORIES = ["groceries", "pharmacy", "food", "laundry", "services", "other"];

/** M06 marketplace: approved stores inside the estate. Payment is on delivery. */
export default function MarketPage() {
  const { params, update } = useListParams(["q", "category"] as const);
  const q = useDebouncedValue(params.q);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["market", "stores", q, params.category],
    queryFn: () => api.get<{ data: Store[] }>("/market/stores", { q, category: params.category }),
  });

  return (
    <>
      <PageHeader title="Estate marketplace" description="Order from stores approved by estate management. You pay the store on delivery." breadcrumbs={[{ label: "Home", href: "/resident" }, { label: "Marketplace" }]} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={params.q} onChange={(v) => update({ q: v })} placeholder="Search stores" />
        <Select className="sm:w-48" value={params.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </Select>
      </div>
      {error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : data?.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((s) => (
            <Link key={s.id} href={`/resident/market/${s.slug}`} className="card flex flex-col p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-army-50 text-army-800"><StoreIcon className="h-6 w-6" /></span>
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-ink-600">{titleCase(s.category)}</p>
                </div>
              </div>
              {s.description && <p className="mt-3 line-clamp-2 text-sm text-ink-600">{s.description}</p>}
              <div className="mt-auto space-y-1 pt-3 text-xs text-ink-600">
                {s.location && <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.location}</p>}
                {s.phone && <p className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {s.phone}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card><EmptyState title="No stores found" description="Approved estate stores will appear here." icon={<StoreIcon className="h-6 w-6" />} /></Card>
      )}
    </>
  );
}
