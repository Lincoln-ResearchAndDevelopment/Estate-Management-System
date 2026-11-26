import { z } from "zod";
import type { Listing } from "@/types/api";

const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)), z.number().min(min).max(max).optional());

const optionalMoney = z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)), z.number().min(0, "Cannot be negative.").optional());

/** SCR-LIST-06 field rules (mirrors the API's ListingRequest). */
export const listingSchema = z
  .object({
    title: z.string().trim().min(10, "Use at least 10 characters.").max(120),
    listing_type: z.enum(["rent", "sale"]),
    property_type: z.string().min(1, "Choose a property type."),
    description: z
      .string()
      .trim()
      .min(50, "Describe the property in at least 50 characters.")
      .max(5000)
      .refine((v) => !/(https?:\/\/|www\.)/i.test(v), "Do not include links in the description."),
    sector_id: z.coerce.number({ invalid_type_error: "Choose a sector." }).int().positive("Choose a sector."),
    street_id: z.coerce.number({ invalid_type_error: "Choose a street." }).int().positive("Choose a street."),
    show_unit_number: z.boolean(),
    bedrooms: optionalNumber(0, 20),
    bathrooms: optionalNumber(0, 20),
    toilets: optionalNumber(0, 20),
    size_sqm: optionalNumber(1, 1_000_000),
    furnishing: z.enum(["", "unfurnished", "semi_furnished", "furnished"]).optional(),
    price_ngn: z.coerce.number({ invalid_type_error: "Enter the price." }).positive("Enter a price above ₦0."),
    price_period: z.enum(["", "year", "month"]).optional(),
    negotiable: z.boolean(),
    service_charge_ngn: optionalMoney,
    caution_fee_ngn: optionalMoney,
    agency_fee_ngn: optionalMoney,
    available_from: z.string().min(1, "Choose the date it becomes available."),
    amenities: z.array(z.string()),
    video_url: z.union([z.literal(""), z.string().url("Enter a valid link.").regex(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i, "Use a YouTube or Vimeo link.")]),
    owner_authorisation: z.instanceof(File).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.listing_type === "rent" && !v.price_period) ctx.addIssue({ code: "custom", path: ["price_period"], message: "Choose per year or per month." });
    if (v.property_type !== "land") {
      if (v.bedrooms === undefined) ctx.addIssue({ code: "custom", path: ["bedrooms"], message: "Enter the number of bedrooms." });
      if (v.bathrooms === undefined) ctx.addIssue({ code: "custom", path: ["bathrooms"], message: "Enter the number of bathrooms." });
    }
  });

export type ListingFormValues = z.infer<typeof listingSchema> & { declaration?: boolean };

export function listingDefaults(l?: Listing): ListingFormValues {
  return {
    title: l?.title ?? "",
    listing_type: l?.listingType ?? "rent",
    property_type: l?.propertyType ?? "",
    description: l?.description ?? "",
    sector_id: l?.sector?.id ?? (undefined as unknown as number),
    street_id: l?.street?.id ?? (undefined as unknown as number),
    show_unit_number: l?.showUnitNumber ?? false,
    bedrooms: l?.bedrooms ?? undefined,
    bathrooms: l?.bathrooms ?? undefined,
    toilets: l?.toilets ?? undefined,
    size_sqm: l?.sizeSqm ?? undefined,
    furnishing: (l?.furnishing as ListingFormValues["furnishing"]) ?? "",
    price_ngn: l ? Number(l.price.amount) : (undefined as unknown as number),
    price_period: l?.pricePeriod ?? "year",
    negotiable: l?.negotiable ?? false,
    service_charge_ngn: l?.serviceCharge ? Number(l.serviceCharge.amount) : undefined,
    caution_fee_ngn: l?.cautionFee ? Number(l.cautionFee.amount) : undefined,
    agency_fee_ngn: l?.agencyFee ? Number(l.agencyFee.amount) : undefined,
    available_from: l?.availableFrom ?? "",
    amenities: l?.amenities ?? [],
    video_url: l?.videoUrl ?? "",
    owner_authorisation: null,
  };
}
