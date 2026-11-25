"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { useAuth } from "@/modules/auth/auth-provider";
import { Brand } from "@/components/shared/brand";
import type { AppNotification, Paginated } from "@/types/api";
import { NAVIGATION, PORTAL_SUBTITLE, type NavItem, type Portal } from "./nav";

const COLLAPSE_KEY = "pahe.sidebar.collapsed";
const collapseListeners = new Set<() => void>();

function readCollapse(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapse(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable: the preference lasts for this page only */
  }
  collapseListeners.forEach((l) => l());
}

function subscribeCollapse(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

function useBadges(portal: Portal, can: (p: string | string[]) => boolean) {
  const admin = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<{ data: { kpis: Record<string, { value: number }> } }>("/admin/dashboard"),
    enabled: portal === "admin" && can("dashboard.admin"),
    refetchInterval: 60_000,
  });
  const agent = useQuery({
    queryKey: ["agent", "dashboard"],
    queryFn: () => api.get<{ data: { kpis: Record<string, number> } }>("/agent/dashboard"),
    enabled: portal === "agent",
    refetchInterval: 60_000,
  });

  return {
    pendingListings: admin.data?.data.kpis.pendingListings?.value,
    pendingAccessRequests: admin.data?.data.kpis.pendingAccessRequests?.value,
    pendingAgents: admin.data?.data.kpis.pendingAgents?.value,
    newEnquiries: agent.data?.data.kpis.newEnquiries,
  } as Record<NonNullable<NavItem["badgeKey"]>, number | undefined>;
}

function NavLinks({ portal, collapsed, onNavigate }: { portal: Portal; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const badges = useBadges(portal, can);

  const sections = NAVIGATION[portal]
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.permissions?.length || can(i.permissions)) }))
    .filter((s) => s.items.length > 0);

  const isActive = (href: string) => {
    const roots = ["/admin", "/agent", "/resident"];
    return roots.includes(href) ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && !collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-khaki-400/80">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-army-800 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-gold-500" aria-hidden />}
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!!badge && (
                      <span className={cn("rounded-full bg-gold-500 px-1.5 text-xs font-semibold text-army-950", collapsed && "absolute right-1 top-1 px-1 text-[10px]")}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: () => api.get<Paginated<AppNotification, { unreadCount: number }>>("/notifications", { pageSize: 5 }),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = data?.meta.unreadCount ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-ink-600 hover:bg-army-50 hover:text-ink-900"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger-600 ring-2 ring-white" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <span className="text-xs text-ink-600">{unread} unread</span>}
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {(data?.data ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-600">You have no notifications.</li>}
            {data?.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!n.readAt) api.post(`/notifications/${n.id}/read`).catch(() => undefined);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn("block w-full px-4 py-3 text-left hover:bg-canvas", !n.readAt && "bg-gold-100/40")}
                >
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-400">{formatRelative(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-army-800 hover:bg-canvas">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppShell({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, () => false);
  // The drawer is open only for the page it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const mobileOpen = drawerPath === pathname;
  const setMobileOpen = (open: boolean) => setDrawerPath(open ? pathname : null);

  const toggleCollapsed = () => writeCollapse(!collapsed);

  const initials = useMemo(
    () => (session?.user.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
    [session?.user.name],
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const sidebarBody = (isMobile: boolean) => (
    <>
      <div className={cn("flex h-16 items-center border-b border-white/10 px-4", collapsed && !isMobile && "justify-center px-2")}>
        <Brand inverted subtitle={PORTAL_SUBTITLE[portal]} compact={collapsed && !isMobile} />
      </div>
      <NavLinks portal={portal} collapsed={collapsed && !isMobile} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white", collapsed && !isMobile && "justify-center px-2")}
        >
          <LogOut className="h-5 w-5" aria-hidden />
          {(!collapsed || isMobile) && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar (collapsible) */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col bg-army-900 transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        {sidebarBody(false)}
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-army-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-army-900 shadow-xl">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded p-1 text-white/70 hover:text-white" aria-label="Close navigation">
              <X className="h-5 w-5" />
            </button>
            {sidebarBody(true)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-600 hover:bg-army-50 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-lg p-2 text-ink-600 hover:bg-army-50 lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <div className="flex items-center gap-3 border-l border-line pl-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink-900">{session?.user.name}</p>
              <p className="text-xs leading-tight text-ink-600">{session?.user.roles?.[0]?.name ?? session?.user.primaryRole}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-army-800 text-sm font-semibold text-white" aria-hidden>
              {initials}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
