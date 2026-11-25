"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

/** Segmented status tabs that scroll horizontally on small screens. */
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-army-900 text-white" : "text-ink-600 hover:bg-army-50 hover:text-ink-900",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-gold-500 text-army-950" : "bg-canvas text-ink-600")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
