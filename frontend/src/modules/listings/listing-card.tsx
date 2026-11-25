import Link from "next/link";
import { Bath, BedDouble, Home, MapPin, Ruler } from "lucide-react";
import { formatNaira } from "@/lib/format";
import type { Listing } from "@/types/api";

export function priceLabel(listing: Pick<Listing, "price" | "pricePeriod" | "listingType">) {
  const base = formatNaira(listing.price.amount);
  return listing.listingType === "rent" && listing.pricePeriod ? `${base} / ${listing.pricePeriod}` : base;
}

/** Listing card for the landing page and search results. */
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing.slug}`} className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-army-50">
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.coverUrl} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-army-800/40"><Home className="h-12 w-12" aria-hidden /></div>
        )}
        <span className={`absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${listing.listingType === "rent" ? "bg-army-900 text-white" : "bg-gold-500 text-army-950"}`}>
          For {listing.listingType}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-display text-xl font-semibold text-army-900">{priceLabel(listing)}</p>
        <h3 className="mt-1 line-clamp-2 font-sans text-sm font-medium text-ink-900">{listing.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {[listing.street?.name, listing.sector?.name].filter(Boolean).join(", ")}
        </p>
        <div className="mt-auto flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-ink-600">
          {listing.bedrooms !== null && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" aria-hidden />{listing.bedrooms} bed</span>}
          {listing.bathrooms !== null && <span className="flex items-center gap-1"><Bath className="h-4 w-4" aria-hidden />{listing.bathrooms} bath</span>}
          {listing.sizeSqm && <span className="flex items-center gap-1"><Ruler className="h-4 w-4" aria-hidden />{listing.sizeSqm} m²</span>}
          <span className="ml-auto">{listing.propertyTypeLabel}</span>
        </div>
      </div>
    </Link>
  );
}
