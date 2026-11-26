"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EyeOff, MessageCircle, MessagesSquare, Send, Trash2 } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Post } from "@/types/modules";
import { MessagesTabs } from "@/components/shared/link-tabs";

/** M07 community feed: residents and staff post and comment; moderators can hide posts with a reason. */
export default function CommunityPage() {
  const { can } = useAuth();
  const { busy, run } = useAction();
  const [page, setPage] = useState(1);
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<Record<number, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [hideId, setHideId] = useState<number | null>(null);
  const moderator = can("comms.moderate");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["posts", page],
    queryFn: () => api.get<Paginated<Post>>("/posts", { page }),
    refetchInterval: 60_000,
  });

  const post = async () => {
    if (body.trim().length < 2) return;
    const res = await run("post", () => api.post("/posts", { body: body.trim() }), "Posted.");
    if (res !== undefined) {
      setBody("");
      setPage(1);
      refetch();
    }
  };

  const comment = async (id: number) => {
    const text = (comments[id] ?? "").trim();
    if (!text) return;
    const res = await run(`c-${id}`, () => api.post(`/posts/${id}/comments`, { body: text }));
    if (res !== undefined) {
      setComments((c) => ({ ...c, [id]: "" }));
      refetch();
    }
  };

  return (
    <>
      <PageHeader title="Community feed" description="Share news, ask for recommendations and help neighbours. Keep it respectful — posts are moderated." breadcrumbs={[{ label: "Community feed" }]} />
      <MessagesTabs />
      <Card className="mb-6 p-4">
        <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share something with the estate…" aria-label="New post" />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-400">{body.length}/2000</span>
          <Button loading={busy === "post"} disabled={body.trim().length < 2} onClick={post}><Send className="h-4 w-4" /> Post</Button>
        </div>
      </Card>

      {error ? <Card><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></Card>
      : isLoading ? <Skeleton className="h-64" />
      : !data?.data.length ? <Card><EmptyState title="No posts yet" description="Be the first to post." icon={<MessagesSquare className="h-6 w-6" />} /></Card>
      : (
        <div className="space-y-4">
          {data.data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-army-100 font-semibold text-army-900">{p.author.name.charAt(0)}</span>
                  <div>
                    <p className="font-medium">{p.author.name}</p>
                    <p className="text-xs text-ink-600">{p.author.role ?? "Member"} · {formatRelative(p.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {p.status === "hidden" && <StatusPill status="hidden" />}
                  {moderator && p.status === "visible" && <Button size="sm" variant="ghost" aria-label="Hide post" onClick={() => setHideId(p.id)}><EyeOff className="h-4 w-4" /></Button>}
                  {(p.mine || moderator) && <Button size="sm" variant="ghost" className="text-danger-600" aria-label="Delete post" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{p.body}</p>
              {p.moderationReason && <p className="mt-2 text-xs text-danger-600">Hidden by moderator: {p.moderationReason}</p>}
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                {p.comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-canvas px-3 py-2 text-sm"><span className="font-medium">{c.author}</span> <span className="text-xs text-ink-400">{formatRelative(c.createdAt)}</span><p>{c.body}</p></div>
                ))}
                <div className="flex gap-2">
                  <Input value={comments[p.id] ?? ""} maxLength={1000} onChange={(e) => setComments((c) => ({ ...c, [p.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && comment(p.id)} placeholder="Write a comment…" aria-label="Comment" />
                  <Button variant="outline" loading={busy === `c-${p.id}`} onClick={() => comment(p.id)} aria-label="Send comment"><MessageCircle className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
          <Card><Pagination {...data.meta} onPageChange={setPage} /></Card>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} destructive loading={busy === "delete"} title="Delete this post?" message="The post and its comments will be removed." confirmLabel="Delete"
        onConfirm={async () => { await run("delete", () => api.delete(`/posts/${deleteId}`), "Post deleted."); setDeleteId(null); refetch(); }} />
      <ReasonDialog open={!!hideId} onClose={() => setHideId(null)} title="Hide this post" description="The author sees the reason; other members no longer see the post." confirmLabel="Hide post" destructive loading={busy === "hide"}
        presets={["Offensive or abusive language", "Spam or advertising", "Shares private information", "Other"]}
        onSubmit={async (reason) => { await run("hide", () => api.post(`/posts/${hideId}/moderate`, { status: "hidden", reason }), "Post hidden."); setHideId(null); refetch(); }} />
    </>
  );
}
