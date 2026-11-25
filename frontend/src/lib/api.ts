/**
 * Browser API client for the Laravel API (Sanctum SPA cookie authentication).
 * - Sends cookies on every request (credentials: "include").
 * - Fetches the CSRF cookie once, then echoes it in X-XSRF-TOKEN on mutating requests.
 * - Turns RFC 7807 problem+json errors into ApiError.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field errors keyed by field name (first message per field). */
  fieldErrors(): Record<string, string> {
    return this.errors.reduce<Record<string, string>>((acc, e) => {
      acc[e.field] ??= e.message;
      return acc;
    }, {});
  }
}

export interface Paginated<T, M = Record<string, unknown>> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number } & M;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrfCookie(): Promise<void> {
  if (readCookie("XSRF-TOKEN")) return;
  csrfPromise ??= fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include" }).then(() => undefined);
  try {
    await csrfPromise;
  } finally {
    csrfPromise = null;
  }
}

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  retried?: boolean;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const isMutation = method !== "GET";
  if (isMutation) await ensureCsrfCookie();

  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const xsrf = readCookie("XSRF-TOKEN");
  if (isMutation && xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  }

  // Session expired or CSRF token rotated: retry once with a fresh CSRF cookie.
  if (response.status === 419 && isMutation && !options.retried) {
    document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
    return request<T>(method, path, { ...options, retried: true });
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? `HTTP_${response.status}`,
      payload?.detail ?? payload?.message ?? "Something went wrong. Please try again.",
      payload?.errors ?? [],
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
  /** Multipart PATCH via Laravel method spoofing (browsers cannot send files with PATCH reliably). */
  patchForm: <T>(path: string, form: FormData) => {
    form.set("_method", "PATCH");
    return request<T>("POST", path, { body: form });
  },
};

/** Builds FormData from a plain object: arrays as key[], booleans as 1/0, skips null/undefined. */
export function toFormData(values: Record<string, unknown>): FormData {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (value instanceof File) form.append(key, value);
    else if (Array.isArray(value)) value.forEach((v) => form.append(`${key}[]`, v instanceof File ? v : String(v)));
    else if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else form.append(key, String(value));
  });
  return form;
}
