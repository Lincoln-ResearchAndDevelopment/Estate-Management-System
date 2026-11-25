"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { listingsApi } from "@/modules/listings/api";
import { ListingForm } from "@/modules/listings/listing-form";

/** Step 1: save the listing as a draft. Step 2 (edit page): photos, then submit for approval. */
export default function NewListingPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  return (
    <>
      <PageHeader
        title="Add listing"
        description="Save the details as a draft, then add photos and submit it for approval. It will not appear on the website until an admin approves it."
        breadcrumbs={[{ label: "Dashboard", href: "/agent" }, { label: "My listings", href: "/agent/listings" }, { label: "Add listing" }]}
      />
      <ListingForm
        submitLabel="Save draft and add photos"
        onSubmit={async (values) => {
          const res = await listingsApi.create(values);
          await queryClient.invalidateQueries({ queryKey: ["agent"] });
          toast.success("Draft saved. Now add photos and submit it for approval.");
          router.push(`/agent/listings/${res.data.id}?step=photos`);
        }}
      />
    </>
  );
}
