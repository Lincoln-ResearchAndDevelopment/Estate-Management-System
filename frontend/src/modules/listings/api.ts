import { api, toFormData, type Paginated } from "@/lib/api";
import type { Enquiry, EstateInfo, Listing, ListingHistoryEntry, Sector, Street } from "@/types/api";
import type { ListingFormValues } from "./listing-schema";

/** Agent-portal and admin listing endpoints (SRS 10.17). */
export const listingsApi = {
  estate: () => api.get<{ data: EstateInfo }>("/public/estate"),
  streets: (sectorId?: number) => api.get<{ data: Street[] }>("/public/streets", { sector_id: sectorId }),
  sectors: () => api.get<{ data: Sector[] }>("/sectors"),

  // Agent
  mine: (q: Record<string, string | number>) => api.get<Paginated<Listing, { statusCounts: Record<string, number> }>>("/agent/listings", q),
  get: (id: number) => api.get<{ data: Listing }>(`/agent/listings/${id}`),
  create: (values: ListingFormValues) => api.post<{ data: Listing }>("/agent/listings", toFormData(serialise(values))),
  update: (id: number, values: Partial<ListingFormValues>) => api.patchForm<{ data: Listing }>(`/agent/listings/${id}`, toFormData(serialise(values))),
  submit: (id: number) => api.post<{ data: Listing }>(`/agent/listings/${id}/submit`, { declaration: true }),
  markClosed: (id: number) => api.post<{ data: Listing }>(`/agent/listings/${id}/mark-closed`),
  renew: (id: number) => api.post<{ data: Listing }>(`/agent/listings/${id}/renew`),
  remove: (id: number) => api.delete(`/agent/listings/${id}`),
  history: (id: number) => api.get<{ data: ListingHistoryEntry[] }>(`/agent/listings/${id}/history`),
  uploadPhotos: (id: number, files: File[], admin = false) => {
    const form = new FormData();
    files.forEach((f) => form.append("photos[]", f));
    return api.post<{ data: Listing }>(`${admin ? "/admin" : "/agent"}/listings/${id}/media`, form);
  },
  deletePhoto: (id: number, mediaId: number, admin = false) => api.delete<{ data: Listing }>(`${admin ? "/admin" : "/agent"}/listings/${id}/media/${mediaId}`),
  reorderPhotos: (id: number, order: number[]) => api.put<{ data: Listing }>(`/agent/listings/${id}/media/order`, { order }),
  dashboard: () =>
    api.get<{
      data: {
        kpis: { live: number; pending: number; rejectedOrWithdrawn: number; drafts: number; newEnquiries: number; totalViews: number };
        recentDecisions: { listingId: number; listingTitle: string; decision: string; reason: string | null; occurredAt: string }[];
        latestEnquiries: Enquiry[];
      };
    }>("/agent/dashboard"),
  enquiries: (q: Record<string, string | number>) => api.get<Paginated<Enquiry>>("/agent/enquiries", q),
  updateEnquiry: (id: number, body: { status?: string; agent_note?: string | null }) => api.patch<{ data: Enquiry }>(`/agent/enquiries/${id}`, body),

  // Admin
  queue: (q: Record<string, string | number>) =>
    api.get<Paginated<Listing, { kpis: { pending: number; live: number; withdrawn: number; rejected: number; deletedLast30Days: number } }>>("/admin/listings", q),
  adminGet: (id: number) => api.get<{ data: Listing }>(`/admin/listings/${id}`),
  adminUpdate: (id: number, values: Partial<ListingFormValues>, version?: number) =>
    api.patchForm<{ data: Listing }>(`/admin/listings/${id}`, toFormData({ ...serialise(values), version })),
  approve: (id: number, version?: number) => api.post<{ data: Listing }>(`/admin/listings/${id}/approve`, { version }),
  reject: (id: number, reason: string) => api.post<{ data: Listing }>(`/admin/listings/${id}/reject`, { reason }),
  withdraw: (id: number, reason: string) => api.post<{ data: Listing }>(`/admin/listings/${id}/withdraw`, { reason }),
  adminDelete: (id: number, reason: string) => api.delete(`/admin/listings/${id}`, { reason }),
  restore: (id: number) => api.post<{ data: Listing }>(`/admin/listings/${id}/restore`),
  feature: (id: number, featured: boolean) => api.post<{ data: Listing }>(`/admin/listings/${id}/feature`, { featured }),
  options: () => api.get<{ data: { rejectReasons: string[]; propertyTypes: { value: string; label: string }[]; amenities: string[] } }>("/admin/listings/options"),
};

/** Converts form values to the API's snake_case fields; empty optional numbers are omitted. */
function serialise(values: Partial<ListingFormValues>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  delete out.declaration;
  return out;
}
