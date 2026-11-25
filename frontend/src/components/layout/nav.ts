import {
  Bell,
  Building2,
  ClipboardCheck,
  FileClock,
  Home,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PlusSquare,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown when the user has any of these permissions. Empty = every signed-in user of the portal. */
  permissions?: string[];
  badgeKey?: "pendingListings" | "pendingAccessRequests" | "pendingAgents" | "newEnquiries";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export type Portal = "admin" | "agent" | "resident";

/**
 * Permission-driven navigation (FR "Permission-based navigation"). Sections follow the admin sidebar
 * proposed in SRS 13.4; modules not yet built are added here as they ship.
 */
export const NAVIGATION: Record<Portal, NavSection[]> = {
  admin: [
    { items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, permissions: ["dashboard.admin"] }] },
    {
      title: "Residents",
      items: [
        { label: "Access Requests", href: "/admin/access-requests", icon: ClipboardCheck, permissions: ["access_requests.view"], badgeKey: "pendingAccessRequests" },
        { label: "Users", href: "/admin/users", icon: Users, permissions: ["users.view"] },
        { label: "Estate Directory", href: "/admin/estate", icon: Building2, permissions: ["estate.view", "estate.manage"] },
      ],
    },
    {
      title: "Property Listings",
      items: [
        { label: "Listing Approvals", href: "/admin/listings", icon: ListChecks, permissions: ["listings.review"], badgeKey: "pendingListings" },
        { label: "Agents", href: "/admin/agents", icon: ShieldCheck, permissions: ["agents.view"], badgeKey: "pendingAgents" },
      ],
    },
    {
      title: "Administration",
      items: [{ label: "Audit Log", href: "/admin/audit-logs", icon: FileClock, permissions: ["audit.view"] }],
    },
    {
      title: "Account",
      items: [
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Change Password", href: "/account/password", icon: KeyRound },
      ],
    },
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
    {
      title: "Account",
      items: [
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Change Password", href: "/account/password", icon: KeyRound },
      ],
    },
  ],
  resident: [
    {
      items: [
        { label: "Home", href: "/resident", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Change Password", href: "/account/password", icon: KeyRound },
      ],
    },
  ],
};

export const PORTAL_SUBTITLE: Record<Portal, string> = {
  admin: "Estate Administration",
  agent: "Agent Portal",
  resident: "Resident Portal",
};

export function portalFromPath(path: string): Portal {
  if (path.startsWith("/agent")) return "agent";
  if (path.startsWith("/resident")) return "resident";
  return "admin";
}

export function portalFromSession(portalPath: string): Portal {
  return portalFromPath(portalPath);
}
