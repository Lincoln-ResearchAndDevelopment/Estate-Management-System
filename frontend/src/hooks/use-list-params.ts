"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps list filters, search and page in the URL query string (FR-GEN-03), so filtered views can be
 * bookmarked and shared. Changing any filter resets to page 1.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo(() => {
    const out = { page: Number(searchParams.get("page") ?? "1") || 1 } as { page: number } & Record<K, string>;
    keys.forEach((k) => {
      (out as Record<string, string | number>)[k] = searchParams.get(k) ?? "";
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const update = useCallback(
    (changes: Partial<Record<K | "page", string | number | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      });
      if (!("page" in changes)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  return { params, update, clear };
}

/** FR-GEN-02: search is debounced by 300 ms. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
