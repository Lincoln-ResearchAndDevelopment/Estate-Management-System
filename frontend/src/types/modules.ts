/** Shapes returned by the operational module endpoints (resident, finance, security, community, market). */
import type { Money } from "./api";

export interface Bill {
  id: number;
  reference: string;
  description: string;
  periodLabel: string | null;
  amount: Money;
  amountPaid: Money;
  balance: Money;
  dueDate: string;
  status: "unpaid" | "part_paid" | "paid" | "overdue" | "void";
  service: { id: number; name: string } | null;
  unit: string | null;
  createdAt: string;
}

export interface Payment {
  id: number;
  reference: string;
  receiptNumber: string | null;
  amount: Money;
  method: "paystack" | "bank_transfer" | "cash" | "pos";
  status: "pending" | "success" | "failed" | "pending_verification" | "rejected";
  payer: string | null;
  unit: string | null;
  note: string | null;
  rejectionReason: string | null;
  hasProof: boolean;
  proofUrl: string | null;
  allocations: { billId: number; description: string | null; amount: Money }[];
  verifiedBy: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface Receipt extends Payment {
  estate: string;
  verifyUrl: string;
}

export interface Vehicle {
  id: number;
  plateNumber: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  stickerNumber: string | null;
  status: string;
}

export interface Alert {
  id: number;
  reference: string;
  type: "panic" | "medical" | "fire" | "security";
  status: "raised" | "acknowledged" | "dispatched" | "resolved" | "false_alarm" | "cancelled";
  description: string | null;
  lat: string | null;
  lng: string | null;
  raisedBy: { id: number; name: string; phone: string | null } | null;
  unit: string | null;
  responder: string | null;
  resolutionNote: string | null;
  escalated: boolean;
  acknowledgedAt: string | null;
  dispatchedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  events: { from: string | null; to: string; note: string | null; actor: string | null; occurredAt: string }[];
}

export interface Incident {
  id: number;
  reference: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  location: string | null;
  description: string;
  status: "open" | "investigating" | "closed";
  reportedBy: string | null;
  assignedTo: { id: number; name: string } | null;
  notes: { id: number; body: string; author: string | null; createdAt: string }[];
  createdAt: string;
  closedAt: string | null;
}

export interface VisitorPass {
  id: number;
  code: string;
  visitorName: string;
  visitorPhone: string | null;
  purpose: string | null;
  vehiclePlate: string | null;
  validFrom: string;
  validUntil: string;
  maxEntries: number;
  entriesUsed: number;
  status: "active" | "used" | "expired" | "cancelled";
  unit: string | null;
  host: string | null;
  createdAt: string;
}

export interface AccessLog {
  id: number;
  subjectType: string;
  direction: "in" | "out";
  personName: string | null;
  plateNumber: string | null;
  gate: string;
  unit: string | null;
  passCode: string | null;
  officer: string | null;
  flagged: boolean;
  flagReason: string | null;
  note: string | null;
  occurredAt: string;
}

export interface AwayNotice {
  id: number;
  fromDate: string;
  toDate: string;
  note: string | null;
  emergencyContact: string | null;
  status: "active" | "cancelled" | "ended";
  createdAt: string;
  unit?: string | null;
  resident?: string | null;
}

export interface BlacklistEntry {
  id: number;
  list: "black" | "watch";
  subjectType: "person" | "vehicle";
  fullName: string | null;
  phone: string | null;
  plateNumber: string | null;
  reason: string;
  status: "active" | "cleared";
  addedBy: string | null;
  clearedReason: string | null;
  clearedAt: string | null;
  createdAt: string;
}

export interface StaffMember {
  id: number;
  staffCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  jobTitle: string;
  department: string;
  employmentType: string;
  hiredOn: string | null;
  status: "active" | "suspended" | "deactivated";
  notes: string | null;
  hasLogin: boolean;
  createdAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: "all" | "residents" | "staff" | "security";
  pinned: boolean;
  publishedBy?: string | null;
  publishedAt: string;
  expiresAt?: string | null;
}

export interface Meeting {
  id: number;
  title: string;
  agenda: string | null;
  location: string;
  startsAt: string;
  endsAt: string | null;
  status: "scheduled" | "cancelled" | "held";
  minutes: string | null;
  createdBy: string | null;
  rsvp: { yes: number; no: number; maybe: number };
  myResponse: "yes" | "no" | "maybe" | null;
}

export interface Post {
  id: number;
  body: string;
  status: "visible" | "hidden";
  moderationReason: string | null;
  author: { id: number; name: string; role: string | null };
  mine: boolean;
  comments: { id: number; body: string; author: string | null; createdAt: string }[];
  createdAt: string;
}

export interface Conversation {
  id: number;
  subject: string;
  participants: { id: number; name: string; role: string | null }[];
  lastMessage: { body: string; createdAt: string } | null;
  unread: boolean;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: number;
  body: string;
  author: string | null;
  mine: boolean;
  createdAt: string;
}

export interface Store {
  id: number;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  phone: string | null;
  location: string | null;
  logoUrl: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  plan: "basic" | "standard" | "premium";
  decisionReason: string | null;
  owner: string | null;
  productsCount: number | null;
  createdAt: string;
}

export interface Product {
  id: number;
  storeId: number;
  name: string;
  description: string | null;
  price: Money;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface Order {
  id: number;
  reference: string;
  status: "placed" | "accepted" | "ready" | "delivered" | "cancelled" | "rejected";
  total: Money;
  paymentMethod: string;
  deliveryNote: string | null;
  statusReason: string | null;
  store: { id: number; name: string; phone: string | null } | null;
  buyer: { name: string; phone: string | null } | null;
  items: { name: string; quantity: number; unitPrice: Money; lineTotal: Money }[];
  createdAt: string;
}

export interface Service {
  id: number;
  name: string;
  code: string;
  description: string | null;
  amount: Money;
  frequency: "monthly" | "quarterly" | "yearly" | "one_off";
  appliesTo: "all" | "selected";
  autoBill: boolean;
  dueDays: number;
  isActive: boolean;
  householdsCount: number | null;
  householdIds: number[];
}
