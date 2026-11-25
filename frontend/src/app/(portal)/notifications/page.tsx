"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import type { AppNotification } from "@/types/api";

/** Notification centre (FR-NOTIF-02). */
export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { params, update } = useListParams(["unread"] as const);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications", "page", params],
    queryFn: () => api.get<Paginated<AppNotification, { unreadCount: number }>>("/notifications", { unread: params.unread ? 1 : undefined, page: params.page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumbs={[{ label: "Notifications" }]}
        actions={!!data?.meta.unreadCount && (
          <Button variant="outline" onClick={async () => { await api.post("/notifications/read-all"); refresh(); }}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      />
      <Card>
        <div className="border-b border-line p-4">
          <Tabs items={[{ value: "", label: "All" }, { value: "1", label: "Unread", count: data?.meta.unreadCount }]} value={params.unread} onChange={(v) => update({ unread: v })} />
        </div>
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState title="No notifications" description="Updates about approvals, listings and enquiries appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {data.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn("flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-canvas", !n.readAt && "bg-gold-100/30")}
                  onClick={async () => {
                    if (!n.readAt) { await api.post(`/notifications/${n.id}/read`).catch(() => undefined); refresh(); }
                    if (n.link) router.push(n.link);
                  }}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-gold-500")} aria-hidden />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>}
                    <span className="mt-1 block text-xs text-ink-400">{formatDateTime(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="sr-only">Unread</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>
    </>
  );
}
