/**
 * Display formats from FR-GEN-11/12: dates "Oct 24, 2023", times "02:15 PM" in WAT,
 * money "₦45,000.00" in tables and "₦15.2M" in KPI cards.
 */
const TZ = "Africa/Lagos";

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TZ }).format(d);
  return `${formatDate(iso)}, ${time}`;
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

export function formatNaira(amount?: string | number | null, options: { compact?: boolean; decimals?: boolean } = {}): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return "—";
  if (options.compact) {
    return "₦" + new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return "₦" + new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: options.decimals ? 2 : 0,
    maximumFractionDigits: options.decimals ? 2 : 0,
  }).format(value);
}

export function titleCase(value?: string | null): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
