import Link from "next/link";
import { Bath, BedDouble, Home, MapPin } from "lucide-react";
import { formatNaira } from "@/lib/format";
import type { Listing } from "@/types/api";

export function priceLabel(listing: Pick<Listing, "price" | "pricePeriod" | "listingType">) {
  const base = formatNaira(listing.price.amount);
  // "/ year" (or the stated period) only for rentals; a sale price is a one-off amount.
  return listing.listingType === "rent" && listing.pricePeriod ? `${base} / ${listing.pricePeriod}` : base;
}

/** Listing card (landing page): photo, type tag, title, location, then price with beds and baths. */
export function ListingCard({ listing }: { listing: Listing }) {
  const location = [listing.street?.name, listing.sector?.name].filter(Boolean).join(", ");
  return (
    <Link href={`/listings/${listing.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] overflow-hidden bg-army-50">
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.coverUrl} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-army-800/40"><Home className="h-12 w-12" aria-hidden /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className={`w-fit rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${listing.listingType === "rent" ? "bg-army-50 text-army-800" : "bg-gold-100 text-olive-700"}`}>
          For {listing.listingType}
        </span>
        <h3 className="mt-2 line-clamp-2 font-sans text-base font-semibold text-ink-900">{listing.title}</h3>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{location}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="font-display text-lg font-bold text-army-800">{priceLabel(listing)}</p>
          <div className="flex shrink-0 gap-3 text-xs text-ink-600">
            {listing.bedrooms !== null && <span className="flex items-center gap-1" title="Bedrooms"><BedDouble className="h-4 w-4" aria-hidden />{listing.bedrooms}<span className="sr-only"> bedrooms</span></span>}
            {listing.bathrooms !== null && <span className="flex items-center gap-1" title="Bathrooms"><Bath className="h-4 w-4" aria-hidden />{listing.bathrooms}<span className="sr-only"> bathrooms</span></span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
