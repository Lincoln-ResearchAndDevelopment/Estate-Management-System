"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileInput } from "@/components/shared/file-input";
import type { Listing } from "@/types/api";
import { listingsApi } from "./api";
import { listingDefaults, listingSchema, type ListingFormValues } from "./listing-schema";

interface ListingFormProps {
  listing?: Listing;
  submitLabel: string;
  onSubmit: (values: ListingFormValues) => Promise<void>;
  /** Shown above the form when editing a live listing as an agent (FR-LIST-08). */
  liveWarning?: boolean;
}

/** SCR-LIST-06 Create / Edit Listing form, used by agents and by admins correcting a listing. */
export function ListingForm({ listing, submitLabel, onSubmit, liveWarning }: ListingFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const estate = useQuery({ queryKey: ["public", "estate"], queryFn: listingsApi.estate, staleTime: 10 * 60_000 });

  const { register, control, handleSubmit, setValue, getValues, setError, formState: { errors, isSubmitting, isDirty } } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: listingDefaults(listing),
  });

  const [listingType, propertyType, sectorId] = useWatch({ control, name: ["listing_type", "property_type", "sector_id"] });
  const streets = useQuery({
    queryKey: ["streets", sectorId],
    queryFn: () => listingsApi.streets(Number(sectorId)),
    enabled: !!sectorId,
  });

  // Reset the street when the sector changes to one that does not contain it.
  useEffect(() => {
    if (streets.data && !streets.data.data.some((s) => s.id === Number(getValues("street_id")))) {
      setValue("street_id", undefined as unknown as number);
    }
  }, [streets.data, setValue, getValues]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) {
        Object.entries(e.fieldErrors()).forEach(([f, m]) => setError(f as keyof ListingFormValues, { message: m }));
        setFormError("Some fields need attention.");
      } else setFormError(e instanceof ApiError ? e.message : "The listing could not be saved.");
    }
  });

  const isLand = propertyType === "land";

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {liveWarning && (
        <div className="flex gap-3 rounded-lg border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-600">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          This listing is live. Saving changes hides it from the website until an admin approves it again.
        </div>
      )}
      {formError && <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-600">{formError}</p>}

      <Card>
        <CardHeader title="Basics" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" error={errors.title?.message} className="sm:col-span-2" required>
            <Input id="title" maxLength={120} aria-invalid={!!errors.title} {...register("title")} />
          </Field>
          <Field label="Listing type" htmlFor="listing_type" error={errors.listing_type?.message} required>
            <div className="flex gap-2" role="radiogroup" id="listing_type">
              {(["rent", "sale"] as const).map((t) => (
                <label key={t} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-army-900 has-[:checked]:bg-army-50 has-[:checked]:font-medium">
                  <input type="radio" value={t} className="accent-army-900" {...register("listing_type")} />
                  For {t}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Property type" htmlFor="property_type" error={errors.property_type?.message} required>
            <Select id="property_type" aria-invalid={!!errors.property_type} {...register("property_type")}>
              <option value="">Choose…</option>
              {estate.data?.data.propertyTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message} className="sm:col-span-2" hint="50–5,000 characters. Do not include phone numbers or links." required>
            <Textarea id="description" rows={6} maxLength={5000} aria-invalid={!!errors.description} {...register("description")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Location" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Sector / Block" htmlFor="sector_id" error={errors.sector_id?.message} required>
            <Select id="sector_id" aria-invalid={!!errors.sector_id} {...register("sector_id")}>
              <option value="">Choose…</option>
              {estate.data?.data.sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Street" htmlFor="street_id" error={errors.street_id?.message} required>
            <Select id="street_id" disabled={!sectorId || streets.isLoading} aria-invalid={!!errors.street_id} {...register("street_id")}>
              <option value="">{sectorId ? "Choose…" : "Choose a sector first"}</option>
              {streets.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Checkbox label="Show the house/plot number publicly" className="sm:col-span-2" {...register("show_unit_number")} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {!isLand && (
            <>
              <Field label="Bedrooms" htmlFor="bedrooms" error={errors.bedrooms?.message} required>
                <Input id="bedrooms" type="number" min={0} max={20} inputMode="numeric" aria-invalid={!!errors.bedrooms} {...register("bedrooms")} />
              </Field>
              <Field label="Bathrooms" htmlFor="bathrooms" error={errors.bathrooms?.message} required>
                <Input id="bathrooms" type="number" min={0} max={20} inputMode="numeric" aria-invalid={!!errors.bathrooms} {...register("bathrooms")} />
              </Field>
              <Field label="Toilets" htmlFor="toilets" error={errors.toilets?.message}>
                <Input id="toilets" type="number" min={0} max={20} inputMode="numeric" {...register("toilets")} />
              </Field>
            </>
          )}
          <Field label="Size (m²)" htmlFor="size_sqm" error={errors.size_sqm?.message}>
            <Input id="size_sqm" type="number" min={1} step="0.01" inputMode="decimal" {...register("size_sqm")} />
          </Field>
          {!isLand && (
            <Field label="Furnishing" htmlFor="furnishing" error={errors.furnishing?.message}>
              <Select id="furnishing" {...register("furnishing")}>
                <option value="">Not specified</option>
                <option value="unfurnished">Unfurnished</option>
                <option value="semi_furnished">Semi-furnished</option>
                <option value="furnished">Furnished</option>
              </Select>
            </Field>
          )}
          <Field label="Available from" htmlFor="available_from" error={errors.available_from?.message} required>
            <Input id="available_from" type="date" aria-invalid={!!errors.available_from} {...register("available_from")} />
          </Field>
        </div>
        <fieldset className="border-t border-line p-5">
          <legend className="mb-3 text-sm font-medium">Amenities</legend>
          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {estate.data?.data.amenities.map((a) => (
                  <Checkbox
                    key={a}
                    label={a}
                    checked={field.value.includes(a)}
                    onChange={(e) => field.onChange(e.target.checked ? [...field.value, a] : field.value.filter((x) => x !== a))}
                  />
                ))}
              </div>
            )}
          />
        </fieldset>
      </Card>

      <Card>
        <CardHeader title="Pricing" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Price (₦)" htmlFor="price_ngn" error={errors.price_ngn?.message} required>
            <Input id="price_ngn" type="number" min={1} step="1000" inputMode="numeric" aria-invalid={!!errors.price_ngn} {...register("price_ngn")} />
          </Field>
          {listingType === "rent" && (
            <Field label="Price period" htmlFor="price_period" error={errors.price_period?.message} required>
              <Select id="price_period" aria-invalid={!!errors.price_period} {...register("price_period")}>
                <option value="year">Per year</option>
                <option value="month">Per month</option>
              </Select>
            </Field>
          )}
          <div className="flex items-end pb-2">
            <Checkbox label="Price is negotiable" {...register("negotiable")} />
          </div>
          <Field label="Service charge (₦)" htmlFor="service_charge_ngn" error={errors.service_charge_ngn?.message}>
            <Input id="service_charge_ngn" type="number" min={0} inputMode="numeric" {...register("service_charge_ngn")} />
          </Field>
          <Field label="Caution fee (₦)" htmlFor="caution_fee_ngn" error={errors.caution_fee_ngn?.message}>
            <Input id="caution_fee_ngn" type="number" min={0} inputMode="numeric" {...register("caution_fee_ngn")} />
          </Field>
          <Field label="Agency & legal fee (₦)" htmlFor="agency_fee_ngn" error={errors.agency_fee_ngn?.message}>
            <Input id="agency_fee_ngn" type="number" min={0} inputMode="numeric" {...register("agency_fee_ngn")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Media & documents" description="Photos are added on the next step, after the listing is saved." />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Video tour link" htmlFor="video_url" error={errors.video_url?.message} hint="Optional · YouTube or Vimeo">
            <Input id="video_url" type="url" placeholder="https://www.youtube.com/watch?v=…" {...register("video_url")} />
          </Field>
          <Controller
            name="owner_authorisation"
            control={control}
            render={({ field }) => (
              <FileInput
                label="Owner authorisation"
                accept=".pdf,image/jpeg,image/png"
                maxMb={10}
                value={field.value ?? null}
                onChange={field.onChange}
                error={errors.owner_authorisation?.message}
                hint={listing?.hasOwnerAuthorisation ? "A document is on file. Upload only to replace it." : "Letter of authority or title document · visible to estate management only"}
              />
            )}
          />
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" size="lg" loading={isSubmitting} disabled={!!listing && !isDirty}>{submitLabel}</Button>
      </div>
    </form>
  );
}
