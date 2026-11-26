"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckSquare, ExternalLink, Send, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { listingsApi } from "@/modules/listings/api";
import { HistoryTimeline } from "@/modules/listings/history-timeline";
import { ListingForm } from "@/modules/listings/listing-form";
import { PhotoManager } from "@/modules/listings/photo-manager";
import type { Listing } from "@/types/api";

const SUBMITTABLE = ["draft", "rejected", "approval_withdrawn", "expired", "rented_sold"];

export default function AgentListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["agent", "listing", listingId];

  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => listingsApi.get(listingId) });
  const listing = data?.data;

  const [dialog, setDialog] = useState<null | "submit" | "delete" | "close">(null);
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);

  const setListing = (l: Listing) => {
    queryClient.setQueryData(key, (prev: { data: Listing } | undefined) => ({ data: { ...prev?.data, ...l, history: l.history ?? prev?.data.history } as Listing }));
    queryClient.invalidateQueries({ queryKey: ["agent", "listings"] });
    queryClient.invalidateQueries({ queryKey: ["agent", "dashboard"] });
  };

  const act = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setDialog(null);
      after?.();
      await refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>;
  if (isLoading || !listing) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-64" /><Skeleton className="h-96" /></div>;

  const status = listing.status ?? "draft";
  const canSubmit = SUBMITTABLE.includes(status);
  const photoCount = listing.photos.length;

  return (
    <>
      <PageHeader
        title={listing.title}
        description={`${listing.code} · For ${listing.listingType}`}
        breadcrumbs={[{ label: "Dashboard", href: "/agent" }, { label: "My listings", href: "/agent/listings" }, { label: listing.code }]}
        actions={
          <>
            {status === "approved" && (
              <Link href={`/listings/${listing.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50">
                <ExternalLink className="h-4 w-4" /> View public page
              </Link>
            )}
            {canSubmit && (
              <Button onClick={() => { setDeclared(false); setDialog("submit"); }}>
                <Send className="h-4 w-4" /> {status === "draft" ? "Submit for approval" : "Resubmit for approval"}
              </Button>
            )}
            {status === "approved" && (
              <>
                <Button variant="outline" onClick={() => act(() => listingsApi.renew(listing.id), "Listing renewed for another 90 days.")} loading={busy}>
                  <CalendarClock className="h-4 w-4" /> Renew
                </Button>
                <Button variant="secondary" onClick={() => setDialog("close")}>
                  <CheckSquare className="h-4 w-4" /> Mark rented / sold
                </Button>
              </>
            )}
            <Button variant="danger" onClick={() => setDialog("delete")}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
        <StatusPill status={status} />
        {status === "pending_approval" && <span className="text-ink-600">Waiting for estate management to review. It is not visible on the website yet.</span>}
        {status === "approved" && <span className="text-ink-600">Live on the website until {formatDate(listing.publishedUntil)}.</span>}
        {status === "draft" && <span className="text-ink-600">Draft — add at least 3 photos and the owner authorisation, then submit.</span>}
        {listing.lastDecisionReason && ["rejected", "approval_withdrawn", "deleted"].includes(status) && (
          <span className="text-danger-600">Reason: {listing.lastDecisionReason}</span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Photos" description="The first photo is the cover image on the website." />
            <div className="p-5">
              <PhotoManager listing={listing} onChange={setListing} />
            </div>
          </Card>

          <ListingForm
            key={`${listing.id}-${listing.version}`}
            listing={listing}
            liveWarning={status === "approved"}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              const res = await listingsApi.update(listing.id, values);
              setListing(res.data);
              toast.success(res.data.status === "pending_approval" && status === "approved" ? "Saved. The listing is hidden until it is re-approved." : "Changes saved.");
              await refetch();
            }}
          />
        </div>

        <Card className="self-start">
          <CardHeader title="History" description="Status changes and admin decisions" />
          <HistoryTimeline entries={listing.history ?? []} />
        </Card>
      </div>

      <Modal
        open={dialog === "submit"}
        onClose={() => setDialog(null)}
        title="Submit for approval"
        description="An estate manager will review the listing. It appears on the website only after approval."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={!declared} loading={busy} onClick={() => act(() => listingsApi.submit(listing.id), "Submitted for approval. Your listing will appear on the website once approved.")}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <ul className="space-y-1 text-ink-600">
            <li>{photoCount >= 3 ? "✓" : "✗"} Photos: {photoCount} (at least 3)</li>
            <li>{listing.hasOwnerAuthorisation ? "✓" : "✗"} Owner authorisation document</li>
          </ul>
          <Checkbox checked={declared} onChange={(e) => setDeclared(e.target.checked)} label="I am authorised to market this property and the details are accurate." />
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => listingsApi.markClosed(listing.id), "Listing marked as rented / sold.")}
        title="Mark as rented / sold?"
        message="The listing will be removed from the website. You can relist it later; relisting needs approval."
        confirmLabel="Mark rented / sold"
        loading={busy}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => listingsApi.remove(listing.id), "Listing deleted", () => router.replace("/agent/listings"))}
        title={`Delete ${listing.title}?`}
        message="It will be removed from the website immediately and open enquiries will be closed. This cannot be undone."
        confirmLabel="Delete listing"
        destructive
        loading={busy}
      />
    </>
  );
}
