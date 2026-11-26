"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, ExternalLink, FileText, PencilLine, RotateCcw, Star, Trash2, Undo2, XCircle } from "lucide-react";
import { API_URL, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { ConfirmDialog, Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/modules/auth/auth-provider";
import { listingsApi } from "@/modules/listings/api";
import { HistoryTimeline } from "@/modules/listings/history-timeline";
import { priceLabel } from "@/modules/listings/listing-card";
import { ListingForm } from "@/modules/listings/listing-form";
import { PhotoManager } from "@/modules/listings/photo-manager";

type Dialog = null | "approve" | "reject" | "withdraw" | "delete" | "restore" | "edit";

const CHECKLIST = ["Photos are genuine and clear", "Price and charges are present", "Owner authorisation document is valid", "The unit or plot exists in the estate"];

/** SCR-LIST-09 Listing Review: public-page preview, agent and document panel, change diff, checklist, actions. */
export default function AdminListingReviewPage() {
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["admin", "listing", listingId];
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => listingsApi.adminGet(listingId) });
  const options = useQuery({ queryKey: ["admin", "listing-options"], queryFn: listingsApi.options, staleTime: 60 * 60_000 });
  const listing = data?.data;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setDialog(null);
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["admin", "listings"] }), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await refetch();
      toast.error(e instanceof ApiError ? e.message : "The action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;
  if (isLoading || !listing) return <div className="space-y-4"><Skeleton className="h-10 w-96" /><Skeleton className="h-96" /></div>;

  const status = listing.status ?? "draft";
  const latestChange = listing.history?.find((h) => h.changedFields && Object.keys(h.changedFields).length);
  const isDeleted = status === "deleted";

  return (
    <>
      <PageHeader
        title={listing.title}
        description={`${listing.code} · submitted ${formatDateTime(listing.submittedAt)}`}
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Listing approvals", href: "/admin/listings" }, { label: listing.code }]}
        actions={<StatusPill status={status} className="text-sm" />}
      />

      {/* Action bar: buttons shown by current status and permission */}
      <div className="sticky top-16 z-20 -mx-4 mb-6 flex flex-wrap gap-2 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        {status === "pending_approval" && can("listings.approve") && (
          <>
            <Button onClick={() => setDialog("approve")}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
            <Button variant="outline" onClick={() => setDialog("reject")}><XCircle className="h-4 w-4" /> Reject</Button>
          </>
        )}
        {status === "approved" && can("listings.approve") && (
          <Button variant="outline" onClick={() => setDialog("withdraw")}><Undo2 className="h-4 w-4" /> Withdraw approval</Button>
        )}
        {status === "approved" && can("listings.feature") && (
          <Button variant={listing.isFeatured ? "gold" : "outline"} loading={busy} onClick={() => act(() => listingsApi.feature(listing.id, !listing.isFeatured), listing.isFeatured ? "Removed from featured" : "Listing featured on the landing page")}>
            <Star className="h-4 w-4" /> {listing.isFeatured ? "Featured" : "Feature"}
          </Button>
        )}
        {!isDeleted && can("listings.edit_any") && (
          <Button variant="outline" onClick={() => setDialog("edit")}><PencilLine className="h-4 w-4" /> Edit</Button>
        )}
        {status === "approved" && (
          <Link href={`/listings/${listing.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50"><ExternalLink className="h-4 w-4" /> Public page</Link>
        )}
        <div className="flex-1" />
        {isDeleted && can("listings.restore") && (
          <Button variant="secondary" onClick={() => setDialog("restore")}><RotateCcw className="h-4 w-4" /> Restore</Button>
        )}
        {!isDeleted && can("listings.delete_any") && (
          <Button variant="danger" onClick={() => setDialog("delete")}><Trash2 className="h-4 w-4" /> Delete</Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {latestChange && status === "pending_approval" && (
            <Card className="border-gold-500">
              <CardHeader title="What changed" description={`Edited by ${latestChange.actor ?? "agent"} on ${formatDateTime(latestChange.occurredAt)}`} />
              <HistoryTimeline entries={[latestChange]} />
            </Card>
          )}

          <Card>
            <CardHeader title="Public page preview" />
            <div className="space-y-4 p-5">
              {listing.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {listing.photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.url} alt={`Photo ${i + 1}`} className={`aspect-[4/3] w-full rounded-md object-cover ${i === 0 ? "col-span-2 row-span-2 h-full" : ""}`} />
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">No photos uploaded.</p>
              )}
              <div>
                <p className="font-display text-2xl font-semibold text-army-900">{priceLabel(listing)}</p>
                <p className="text-sm text-ink-600">{listing.propertyTypeLabel} for {listing.listingType} · {[listing.unit?.code, listing.street?.name, listing.sector?.name].filter(Boolean).join(", ")}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  ["Bedrooms", listing.bedrooms],
                  ["Bathrooms", listing.bathrooms],
                  ["Size", listing.sizeSqm ? `${listing.sizeSqm} m²` : null],
                  ["Available", formatDate(listing.availableFrom)],
                  ["Furnishing", titleCase(listing.furnishing)],
                  ["Negotiable", listing.negotiable ? "Yes" : "No"],
                  ["Views", listing.viewCount],
                  ["Enquiries", listing.enquiriesCount],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-md bg-canvas p-2.5">
                    <dt className="text-xs text-ink-600">{label}</dt>
                    <dd className="font-medium">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="whitespace-pre-line text-sm text-ink-600">{listing.description}</p>
              {listing.amenities.length > 0 && <p className="text-sm"><span className="font-medium">Amenities:</span> {listing.amenities.join(", ")}</p>}
            </div>
          </Card>

          {!isDeleted && can("listings.edit_any") && (
            <Card>
              <CardHeader title="Photos" description="Admin photo changes keep the current status." />
              <div className="p-5">
                <PhotoManager admin listing={listing} onChange={() => refetch()} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Agent" />
            <div className="space-y-1 p-5 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">{listing.agent?.name}{listing.agent?.verified && <BadgeCheck className="h-4 w-4 text-gold-500" aria-label="Verified" />}</p>
              {listing.agent?.agencyName && <p className="text-ink-600">{listing.agent.agencyName}</p>}
              <p className="text-ink-600">{listing.agent?.email}</p>
              <p className="text-ink-600">{listing.agent?.phone}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ownership" />
            <div className="space-y-3 p-5 text-sm">
              {listing.hasOwnerAuthorisation ? (
                <a href={`${API_URL}/api/v1/admin/listings/${listing.id}/owner-authorisation`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-army-800 hover:underline">
                  <FileText className="h-4 w-4" /> Open owner authorisation document
                </a>
              ) : (
                <p className="text-danger-600">No owner authorisation document uploaded.</p>
              )}
              {listing.unit && <p>Linked unit <span className="font-medium">{listing.unit.code}</span> · currently <StatusPill status={listing.unit.occupancyStatus ?? "vacant"} /></p>}
            </div>
          </Card>

          {status === "pending_approval" && (
            <Card>
              <CardHeader title="Verification checklist" description="For your review; not stored." />
              <div className="space-y-2 p-5">
                {CHECKLIST.map((item) => (
                  <Checkbox key={item} label={item} checked={checked.includes(item)} onChange={(e) => setChecked((c) => (e.target.checked ? [...c, item] : c.filter((x) => x !== item)))} />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="History" />
            <HistoryTimeline entries={listing.history ?? []} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => listingsApi.approve(listing.id, listing.version), "Approved. The listing is now live.")}
        title="Approve this listing?"
        message={checked.length < CHECKLIST.length ? `You have ticked ${checked.length} of ${CHECKLIST.length} checklist items. The listing will go live on the website immediately.` : "The listing will go live on the website immediately and the agent will be notified."}
        confirmLabel="Approve and publish"
        loading={busy}
      />
      <ReasonDialog open={dialog === "reject"} onClose={() => setDialog(null)} onSubmit={(r) => act(() => listingsApi.reject(listing.id, r), "Listing rejected. The agent has been notified.")} title="Reject listing" confirmLabel="Reject" presets={options.data?.data.rejectReasons} loading={busy} destructive />
      <ReasonDialog open={dialog === "withdraw"} onClose={() => setDialog(null)} onSubmit={(r) => act(() => listingsApi.withdraw(listing.id, r), "Approval withdrawn. The listing is no longer public.")} title="Withdraw approval" description="The listing disappears from the website immediately." confirmLabel="Withdraw approval" presets={options.data?.data.rejectReasons} loading={busy} destructive />
      <ReasonDialog open={dialog === "delete"} onClose={() => setDialog(null)} onSubmit={(r) => act(() => listingsApi.adminDelete(listing.id, r), "Listing deleted. A Super Administrator can restore it within 30 days.")} title={`Delete ${listing.title}?`} description="It is removed from the website and the agent's active list. A Super Administrator can restore it within 30 days." confirmLabel="Delete listing" presets={options.data?.data.rejectReasons} loading={busy} destructive />
      <ConfirmDialog open={dialog === "restore"} onClose={() => setDialog(null)} onConfirm={() => act(() => listingsApi.restore(listing.id), "Listing restored to its previous status.")} title="Restore this listing?" message="It returns to the status it had before it was deleted." confirmLabel="Restore" loading={busy} />

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Edit listing" description="Admin corrections keep the current status and are recorded in history." size="lg">
        <ListingForm
          listing={listing}
          submitLabel="Save corrections"
          onSubmit={async (values) => {
            await listingsApi.adminUpdate(listing.id, values, listing.version);
            toast.success("Corrections saved");
            setDialog(null);
            await refetch();
          }}
        />
      </Modal>
    </>
  );
}

