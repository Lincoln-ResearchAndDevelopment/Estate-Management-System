"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquarePlus, MessageSquareText, Send } from "lucide-react";
import { api, ApiError, type Paginated } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-list-params";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ChatMessage, Conversation } from "@/types/modules";

interface Thread { conversation: Conversation; messages: ChatMessage[] }

/** M07 direct messages between residents and estate staff. New messages arrive by polling every few seconds. */
export default function MessagesPage() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const list = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Paginated<Conversation, { unreadCount: number }>>("/conversations", { pageSize: 50 }),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader title="Messages" breadcrumbs={[{ label: "Messages" }]} actions={<Button onClick={() => setComposeOpen(true)}><MessageSquarePlus className="h-4 w-4" /> New message</Button>} />
      <Card className="grid min-h-[32rem] overflow-hidden md:grid-cols-[18rem_1fr]">
        <aside className={cn("border-line md:border-r", activeId && "hidden md:block")}>
          {list.error ? <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
          : list.isLoading ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : !list.data?.data.length ? <EmptyState title="No conversations yet" description="Start one with estate management." icon={<MessageSquareText className="h-6 w-6" />} />
          : (
            <ul className="divide-y divide-line">
              {list.data.data.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setActiveId(c.id)} className={cn("w-full px-4 py-3 text-left hover:bg-canvas", activeId === c.id && "bg-army-50")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.subject}</p>
                      {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-label="Unread" />}
                    </div>
                    <p className="truncate text-xs text-ink-600">{c.participants.map((p) => p.name).join(", ")}</p>
                    {c.lastMessage && <p className="truncate text-xs text-ink-400">{c.lastMessage.body} · {formatRelative(c.lastMessage.createdAt)}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className={cn("flex flex-col", !activeId && "hidden md:flex")}>
          {activeId ? <ThreadView key={activeId} id={activeId} onBack={() => setActiveId(null)} /> : <EmptyState title="Select a conversation" icon={<MessageSquareText className="h-6 w-6" />} />}
        </section>
      </Card>
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} onCreated={(id) => { setComposeOpen(false); setActiveId(id); list.refetch(); }} />}
    </>
  );
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { busy, run } = useAction();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.get<{ data: Thread }>(`/conversations/${id}/messages`),
    refetchInterval: 5000,
  });
  const count = data?.data.messages.length ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [count, queryClient]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const res = await run("send", () => api.post(`/conversations/${id}/messages`, { body }));
    if (res !== undefined) {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
    }
  };

  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading || !data) return <Skeleton className="m-4 h-64" />;
  const { conversation, messages } = data.data;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={onBack} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <p className="font-semibold">{conversation.subject}</p>
          <p className="text-xs text-ink-600">{conversation.participants.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ")}</p>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.mine ? "bg-army-900 text-white" : "bg-canvas")}>
              {!m.mine && <p className="text-xs font-semibold">{m.author}</p>}
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={cn("mt-1 text-[10px]", m.mine ? "text-white/60" : "text-ink-400")}>{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <footer className="flex gap-2 border-t border-line p-3">
        <Textarea rows={1} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message" aria-label="Message" className="min-h-10 resize-none" />
        <Button onClick={send} loading={busy === "send"} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </footer>
    </>
  );
}

function ComposeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q);
  const [to, setTo] = useState<{ id: number; name: string } | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contacts = useQuery({ queryKey: ["contacts", query], queryFn: () => api.get<{ data: { id: number; name: string; role: string | null }[] }>("/contacts", { q: query }) });

  const submit = async () => {
    if (!to || subject.trim().length < 2 || !body.trim()) return setError("Choose a recipient and write a subject and message.");
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: Conversation }>("/conversations", { recipient_ids: [to.id], subject: subject.trim(), body: body.trim() });
      onCreated(res.data.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The message could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New message" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Send</Button></>}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
        <Field label="To" htmlFor="c-to" required>
          {to ? (
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"><span>{to.name}</span><button type="button" className="text-army-800 hover:underline" onClick={() => setTo(null)}>Change</button></div>
          ) : (
            <>
              <Input id="c-to" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search estate staff by name" />
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line">
                {(contacts.data?.data ?? []).map((c) => (
                  <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => setTo(c)}>{c.name} <span className="text-xs text-ink-600">{c.role}</span></button></li>
                ))}
                {contacts.data?.data.length === 0 && <li className="px-3 py-2 text-sm text-ink-600">No matching people.</li>}
              </ul>
            </>
          )}
        </Field>
        <Field label="Subject" htmlFor="c-subject" required><Input id="c-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message" htmlFor="c-body" required><Textarea id="c-body" rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
