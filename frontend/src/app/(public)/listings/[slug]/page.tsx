import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, CalendarDays, Check, ChevronRight, MapPin, Ruler, Sofa, Droplets } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { formatDate, formatNaira, titleCase } from "@/lib/format";
import { ListingCard, priceLabel } from "@/modules/listings/listing-card";
import type { Listing } from "@/types/api";
import { Gallery } from "./gallery";
import { EnquiryPanel } from "./enquiry-panel";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  return serverGet<{ data: Listing; similar: Listing[] }>(`/public/listings/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await load(slug).catch(() => null);
  if (!result) return { title: "Property not available" };
  const l = result.data;
  return {
    title: l.title,
    description: `${priceLabel(l)} · ${l.propertyTypeLabel} for ${l.listingType} at Post Army Housing Estates. ${l.description.slice(0, 120)}`,
    openGraph: { title: l.title, images: l.coverUrl ? [l.coverUrl] : [], type: "website" },
    alternates: { canonical: `/listings/${l.slug}` },
  };
}

export default async function ListingDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const result = await load(slug);
  // Not approved, withdrawn, deleted or expired listings are 404 for the public (FR-LIST-03).
  if (!result) notFound();
  const { data: listing, similar } = result;

  const facts = [
    listing.bedrooms !== null && { icon: BedDouble, label: "Bedrooms", value: listing.bedrooms },
    listing.bathrooms !== null && { icon: Bath, label: "Bathrooms", value: listing.bathrooms },
    listing.toilets !== null && { icon: Droplets, label: "Toilets", value: listing.toilets },
    listing.sizeSqm && { icon: Ruler, label: "Size", value: `${listing.sizeSqm} m²` },
    listing.furnishing && { icon: Sofa, label: "Furnishing", value: titleCase(listing.furnishing) },
    listing.availableFrom && { icon: CalendarDays, label: "Available", value: formatDate(listing.availableFrom) },
  ].filter(Boolean) as { icon: typeof Bath; label: string; value: string | number }[];

  const charges = [
    ["Service charge", listing.serviceCharge],
    ["Caution fee", listing.cautionFee],
    ["Agency & legal fee", listing.agencyFee],
  ].filter(([, v]) => v) as [string, { amount: string }][];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description,
    image: listing.photos.map((p) => p.url),
    datePosted: listing.approvedAt,
    offers: { "@type": "Offer", price: listing.price.amount, priceCurrency: "NGN", businessFunction: listing.listingType === "rent" ? "LeaseOut" : "Sell" },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-ink-600">
        <Link href="/" className="hover:underline">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link href={`/listings?type=${listing.listingType}`} className="hover:underline">For {listing.listingType}</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-ink-900">{listing.code}</span>
      </nav>

      <Gallery photos={listing.photos} title={listing.title} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${listing.listingType === "rent" ? "bg-army-900 text-white" : "bg-gold-500 text-army-950"}`}>For {listing.listingType}</span>
              <span className="rounded-md bg-canvas px-2 py-1 text-xs font-medium text-ink-600">{listing.propertyTypeLabel}</span>
              {listing.negotiable && <span className="rounded-md bg-olive-100 px-2 py-1 text-xs font-medium text-olive-700">Negotiable</span>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-ink-600">
              <MapPin className="h-4 w-4" aria-hidden />
              {[listing.unit?.code, listing.street?.name, listing.sector?.name].filter(Boolean).join(", ")}
            </p>
            <p className="mt-4 font-display text-3xl font-semibold text-army-900">{priceLabel(listing)}</p>
            {charges.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-600">
                {charges.map(([label, money]) => <li key={label}>{label}: <span className="font-medium text-ink-900">{formatNaira(money.amount)}</span></li>)}
              </ul>
            )}
          </div>

          {facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="card flex items-center gap-3 p-4">
                  <f.icon className="h-5 w-5 text-army-800" aria-hidden />
                  <div>
                    <dt className="text-xs text-ink-600">{f.label}</dt>
                    <dd className="font-semibold">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          <section>
            <h2 className="text-xl font-semibold">Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{listing.description}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Amenities</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success-600" aria-hidden />{a}</li>
                ))}
              </ul>
            </section>
          )}

          {listing.videoUrl && (
            <p className="text-sm">
              <a href={listing.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-army-800 hover:underline">Watch the video tour</a>
            </p>
          )}
        </div>

        <EnquiryPanel listing={listing} />
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold">Similar properties</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}
    </div>
  );
}
