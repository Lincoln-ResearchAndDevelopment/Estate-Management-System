import { readSession } from "@/components/auth/session";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface Paged<T> { data: T[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }

/** Admin API call. Sends the Sanctum token when signed in; throws Error with the server's message. */
export async function adminFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readSession()?.token;
  const res = await fetch(`${API}/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = json?.errors ? Object.values<string[]>(json.errors)[0]?.[0] : undefined;
    throw new Error(first || json?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

export interface AdminUser {
  id: number; name: string; email: string; phone: string | null; role: string; status: string;
  unit_number: string | null; moved_in_at: string | null; created_at: string | null; avatar_url: string | null;
}

export const adminUsers = {
  list: (q: { search?: string; role?: string; status?: string; per_page?: number; page?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    return adminFetch<Paged<AdminUser>>(`/users?${qs}`);
  },
  create: (b: { name: string; email: string; role: string; unit_number?: string; moved_in_at?: string; phone?: string }) =>
    adminFetch<{ data: AdminUser }>("/users", { method: "POST", body: JSON.stringify(b) }),
  remove: (id: number) => adminFetch<unknown>(`/users/${id}`, { method: "DELETE" }),
};
