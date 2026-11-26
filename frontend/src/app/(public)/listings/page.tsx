import { redirect } from "next/navigation";

/** The property search now lives on the landing page; old links and bookmarks keep their filters. */
export default async function ListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) qs.set(k, v);
  redirect(`/${qs.size ? `?${qs.toString()}` : ""}#listings`);
}
