import "server-only";

/**
 * Server-side fetch for public, SEO-rendered pages (landing page, listing detail).
 * Public endpoints only — no cookies are forwarded.
 */
const BASE = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function serverGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("API ")) throw error;
    // API unreachable during build or at runtime: callers render an error state.
    throw new Error("API unreachable");
  }
}
