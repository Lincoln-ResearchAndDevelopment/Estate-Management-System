import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/states";
import { ListingSearch } from "./listing-search";

export const metadata: Metadata = {
  title: "Properties for rent and sale",
  description: "Approved homes for rent and sale at Post Army Housing Estates, Abuja.",
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10"><Skeleton className="h-96" /></div>}>
      <ListingSearch />
    </Suspense>
  );
}
