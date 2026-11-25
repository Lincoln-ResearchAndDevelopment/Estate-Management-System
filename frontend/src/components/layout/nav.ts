import {
  Banknote,
  Bell,
  BarChart3,
  Building2,
  Car,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileClock,
  FileWarning,
  Home,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Package,
  PlusSquare,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShoppingBag,
  Siren,
  Store,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown when the user has any of these permissions. Empty = every signed-in user of the portal. */
  permissions?: string[];
  badgeKey?: "pendingListings" | "pendingAccessRequests" | "pendingAgents" | "newEnquiries" | "unreadMessages" | "activeAlerts";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export type Portal = "admin" | "agent" | "resident" | "security" | "store";

const COMMUNITY: NavSection = {
  title: "Community",
  items: [
    { label: "Notices & Meetings", href: "/notices", icon: Megaphone, permissions: ["comms.use"] },
    { label: "Community Feed", href: "/community", icon: MessagesSquare, permissions: ["comms.use"] },
    { label: "Messages", href: "/messages", icon: MessageSquareText, permissions: ["comms.use"], badgeKey: "unreadMessages" },
  ],
};

const ACCOUNT: NavSection = {
  title: "Account",
  items: [
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Sign-in Security", href: "/account/security", icon: ShieldCheck },
    { label: "Change Password", href: "/account/password", icon: KeyRound },
  ],
};

/** Permission-driven navigation (FR "Permission-based navigation"), following the admin sidebar in SRS 13.4. */
export const NAVIGATION: Record<Portal, NavSection[]> = {
  admin: [
    { items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, permissions: ["dashboard.admin"] }] },
    {
      title: "Residents",
      items: [
        { label: "Access Requests", href: "/admin/access-requests", icon: ClipboardCheck, permissions: ["access_requests.view"], badgeKey: "pendingAccessRequests" },
        { label: "Households", href: "/admin/residents", icon: Home, permissions: ["residents.view"] },
        { label: "Users", href: "/admin/users", icon: Users, permissions: ["users.view"] },
        { label: "Estate Directory", href: "/admin/estate", icon: Building2, permissions: ["estate.view", "estate.manage"] },
      ],
    },
    {
      title: "Finance",
      items: [
        { label: "Finance Overview", href: "/admin/finance", icon: Wallet, permissions: ["finance.view"] },
        { label: "Bills", href: "/admin/finance/bills", icon: Receipt, permissions: ["finance.view"] },
        { label: "Payments", href: "/admin/finance/payments", icon: Banknote, permissions: ["finance.view"] },
        { label: "Outstanding", href: "/admin/finance/outstanding", icon: FileWarning, permissions: ["finance.view"] },
        { label: "Services & Charges", href: "/admin/finance/services", icon: ClipboardList, permissions: ["finance.view"] },
      ],
    },
    {
      title: "Security",
      items: [{ label: "Security Console", href: "/security", icon: Siren, permissions: ["security.respond", "access.view"] }],
    },
    {
      title: "Property Listings",
      items: [
        { label: "Listing Approvals", href: "/admin/listings", icon: ListChecks, permissions: ["listings.review"], badgeKey: "pendingListings" },
        { label: "Agents", href: "/admin/agents", icon: ShieldCheck, permissions: ["agents.view"], badgeKey: "pendingAgents" },
      ],
    },
    { title: "Marketplace", items: [{ label: "Stores", href: "/admin/stores", icon: Store, permissions: ["stores.approve"] }] },
    COMMUNITY,
    {
      title: "Administration",
      items: [
        { label: "Staff", href: "/admin/staff", icon: UserCog, permissions: ["staff.view"] },
        { label: "Reports", href: "/admin/reports", icon: BarChart3, permissions: ["reports.view"] },
        { label: "Settings", href: "/admin/settings", icon: Settings, permissions: ["settings.manage"] },
        { label: "Audit Log", href: "/admin/audit-logs", icon: FileClock, permissions: ["audit.view"] },
      ],
    },
    ACCOUNT,
  ],
  agent: [
    {
      items: [
        { label: "Dashboard", href: "/agent", icon: LayoutDashboard, permissions: ["listings.manage_own"] },
        { label: "My Listings", href: "/agent/listings", icon: Home, permissions: ["listings.manage_own"] },
        { label: "Add Listing", href: "/agent/listings/new", icon: PlusSquare, permissions: ["listings.manage_own"] },
        { label: "Enquiries", href: "/agent/enquiries", icon: MessageSquareText, permissions: ["listings.manage_own"], badgeKey: "newEnquiries" },
        { label: "Profile", href: "/agent/profile", icon: UserCircle, permissions: ["listings.manage_own"] },
      ],
    },
    ACCOUNT,
  ],
  resident: [
    {
      items: [
        { label: "Home", href: "/resident", icon: LayoutDashboard },
        { label: "My Household", href: "/resident/household", icon: Users, permissions: ["finance.pay_own", "household.manage_own"] },
        { label: "Bills & Payments", href: "/resident/finance", icon: Wallet, permissions: ["finance.pay_own"] },
        { label: "Visitors & Gate", href: "/resident/visitors", icon: DoorOpen, permissions: ["access.manage_own"] },
        { label: "Emergency", href: "/resident/emergency", icon: ShieldAlert, permissions: ["alerts.raise"] },
      ],
    },
    {
      title: "Marketplace",
      items: [
        { label: "Shop", href: "/resident/market", icon: ShoppingBag, permissions: ["market.shop"] },
        { label: "My Orders", href: "/resident/orders", icon: Package, permissions: ["market.shop"] },
      ],
    },
    COMMUNITY,
    ACCOUNT,
  ],
  security: [
    {
      title: "Operations",
      items: [
        { label: "HQ Dashboard", href: "/security", icon: LayoutDashboard, permissions: ["security.respond", "access.view"] },
        { label: "Emergency Alerts", href: "/security/alerts", icon: Siren, permissions: ["security.respond"], badgeKey: "activeAlerts" },
        { label: "Gate Control", href: "/security/gate", icon: DoorOpen, permissions: ["access.gate"] },
        { label: "Access Logs", href: "/security/logs", icon: Car, permissions: ["access.view", "access.gate"] },
        { label: "Blacklist & Watchlist", href: "/security/blacklist", icon: ShieldBan, permissions: ["blacklist.view"] },
        { label: "Incident Reports", href: "/security/incidents", icon: FileWarning, permissions: ["security.reports"] },
      ],
    },
    COMMUNITY,
    ACCOUNT,
  ],
  store: [
    {
      items: [
        { label: "Store Dashboard", href: "/store", icon: LayoutDashboard, permissions: ["store.manage_own"] },
        { label: "Products", href: "/store/products", icon: Package, permissions: ["store.manage_own"] },
        { label: "Orders", href: "/store/orders", icon: ShoppingBag, permissions: ["store.manage_own"] },
      ],
    },
    COMMUNITY,
    ACCOUNT,
  ],
};

export const PORTAL_SUBTITLE: Record<Portal, string> = {
  admin: "Estate Administration",
  agent: "Agent Portal",
  resident: "Resident Portal",
  security: "Security Operations",
  store: "Store Portal",
};

export function portalFromPath(path: string): Portal {
  if (path.startsWith("/agent")) return "agent";
  if (path.startsWith("/resident")) return "resident";
  if (path.startsWith("/security")) return "security";
  if (path.startsWith("/store")) return "store";
  return "admin";
}

export function portalFromSession(portalPath: string): Portal {
  return portalFromPath(portalPath);
}
