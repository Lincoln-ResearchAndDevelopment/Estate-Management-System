import Link from "next/link";
import { Brand } from "@/components/shared/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Brand />
      <div>
        <p className="font-display text-5xl font-semibold text-army-900">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-ink-600">The page you are looking for does not exist or is no longer available.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800">Go to home page</Link>
        <Link href="/listings" className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-army-50">Browse properties</Link>
      </div>
    </div>
  );
}
