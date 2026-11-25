/** Shapes returned by the Laravel API (camelCase JSON). */

export type Permission = string;

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: "pending" | "active" | "inactive" | "blocked";
  primaryRole: string;
  roles?: { code: string; name: string }[];
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface Session {
  user: User;
  permissions: Permission[];
  portal: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  /** MFA is mandatory for this role but not yet set up; the portal sends the user to set it up. */
  mfaSetupRequired: boolean;
}

export interface Money {
  amount: string;
  currency: "NGN";
}

export type ListingStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "approval_withdrawn"
  | "rented_sold"
  | "expired"
  | "deleted";

export interface ListingHistoryEntry {
  id: number;
  from: ListingStatus | null;
  to: ListingStatus;
  actor: string | null;
  reason: string | null;
  changedFields: Record<string, { from: unknown; to: unknown }> | null;
  occurredAt: string;
}

export interface Listing {
  id: number;
  code: string;
  slug: string;
  title: string;
  listingType: "rent" | "sale";
  propertyType: string;
  propertyTypeLabel: string;
  description: string;
  price: Money;
  pricePeriod: "year" | "month" | null;
  negotiable: boolean;
  serviceCharge: Money | null;
  cautionFee: Money | null;
  agencyFee: Money | null;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  sizeSqm: number | null;
  furnishing: string | null;
  availableFrom: string | null;
  amenities: string[];
  videoUrl: string | null;
  sector?: { id: number; name: string };
  street?: { id: number; name: string };
  unit?: { id: number; code: string; occupancyStatus: string | null };
  showUnitNumber: boolean;
  coverUrl: string | null;
  photos: { id: number; url: string; isCover: boolean }[];
  isFeatured: boolean;
  approvedAt: string | null;
  agent?: {
    id: number;
    name: string;
    avatarUrl: string | null;
    agencyName: string | null;
    verified: boolean;
    email?: string;
    phone?: string | null;
  };
  // Owner / admin only
  status?: ListingStatus;
  statusLabel?: string;
  submittedAt?: string | null;
  publishedUntil?: string | null;
  lastDecisionReason?: string | null;
  hasOwnerAuthorisation?: boolean;
  viewCount?: number;
  version?: number;
  enquiriesCount?: number;
  updatedAt?: string | null;
  deletedAt?: string | null;
  history?: ListingHistoryEntry[];
}

export interface EstateInfo {
  name: string;
  shortName: string;
  propertyTypes: { value: string; label: string }[];
  amenities: string[];
  sectors: { id: number; name: string }[];
  stats: { liveListings: number; forRent: number; forSale: number };
}

export interface Enquiry {
  id: number;
  listing: { id: number; title: string; slug: string } | null;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  preferredViewingDate: string | null;
  status: "new" | "contacted" | "closed";
  agentNote: string | null;
  createdAt: string;
}

export interface Agent {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  agencyName: string | null;
  agencyRegNo: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  verified: boolean;
  decisionReason: string | null;
  idDocumentUrl: string;
  liveListings: number;
  appliedAt: string;
}

export interface AccessRequest {
  id: number;
  reference: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  unit?: { id: number; code: string; street: string | null };
  nationalIdMasked: string;
  declarations: { insideEstate: boolean; infoCorrect: boolean; agreeRules: boolean };
  photoUrl: string;
  faceUrl: string;
  status: "pending" | "info_requested" | "approved" | "rejected" | "expired";
  decisionReason: string | null;
  reviewedBy?: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface Unit {
  id: number;
  code: string;
  unitType: string;
  rooms: number | null;
  occupancyStatus: "occupied" | "vacant" | "under_watch";
  sector?: { id: number; name: string };
  street?: { id: number; name: string };
}

export interface Sector {
  id: number;
  name: string;
  code: string;
  streetsCount: number;
  unitsCount: number;
}

export interface Street {
  id: number;
  sectorId: number;
  name: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  category: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  actor: string;
  actorRole: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  occurredAt: string;
}

export type { Paginated } from "@/lib/api";
