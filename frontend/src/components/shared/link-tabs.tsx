"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs that are separate pages (keeps one sidebar entry for a group of screens, as in the Figma hubs). */
export function LinkTabs({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", active ? "border-army-800 text-army-900" : "border-transparent text-ink-600 hover:text-ink-900")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Figma Messages hub: Private Messages ↔ Community ↔ Meetings & Notices. */
export function MessagesTabs() {
  return <LinkTabs label="Messages" items={[{ href: "/messages", label: "Private messages" }, { href: "/community", label: "Community" }, { href: "/notices", label: "Meetings & notices" }]} />;
}

export function MarketplaceTabs() {
  return <LinkTabs label="Marketplace" items={[{ href: "/resident/market", label: "Shop" }, { href: "/resident/orders", label: "My orders" }]} />;
}
