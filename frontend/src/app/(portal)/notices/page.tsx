"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, MapPin, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { applyFieldErrors, localToIso, useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Announcement, Meeting } from "@/types/modules";

const noticeSchema = z.object({
  title: z.string().trim().min(3, "Enter a title.").max(150),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(5000),
  audience: z.enum(["all", "residents", "staff", "security"]),
  pinned: z.boolean(),
  notify: z.boolean(),
});
const meetingSchema = z.object({
  title: z.string().trim().min(3, "Enter a title.").max(150),
  location: z.string().trim().min(2, "Enter the venue.").max(150),
  starts_at: z.string().min(1, "Choose the date and time."),
  agenda: z.string().trim().max(5000),
});

/** M07 notices and meetings. Everyone reads; estate management publishes and records minutes. */
export default function NoticesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();
  const initial = useSearchParams().get("tab") === "meetings" ? "meetings" : "notices";
  const [tab, setTab] = useState(initial);
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [minutesFor, setMinutesFor] = useState<Meeting | null>(null);
  const [minutes, setMinutes] = useState("");
  const publisher = can("comms.publish");

  const notices = useQuery({ queryKey: ["notices", page], queryFn: () => api.get<Paginated<Announcement>>("/announcements", { page }), enabled: tab === "notices" });
  const meetings = useQuery({ queryKey: ["meetings", when], queryFn: () => api.get<Paginated<Meeting>>("/meetings", { when }), enabled: tab === "meetings" });

  const noticeForm = useForm<z.infer<typeof noticeSchema>>({ resolver: zodResolver(noticeSchema), defaultValues: { title: "", body: "", audience: "all", pinned: false, notify: true } });
  const meetingForm = useForm<z.infer<typeof meetingSchema>>({ resolver: zodResolver(meetingSchema), defaultValues: { title: "", location: "", starts_at: "", agenda: "" } });

  const publish = noticeForm.handleSubmit(async (v) => {
    try {
      await api.post("/announcements", v);
      toast.success(v.notify ? "Notice published and residents notified." : "Notice published.");
      setNoticeOpen(false);
      noticeForm.reset();
      notices.refetch();
    } catch (e) {
      if (!applyFieldErrors(noticeForm, e)) toast.error("The notice could not be published.");
    }
  });

  const schedule = meetingForm.handleSubmit(async (v) => {
    try {
      await api.post("/meetings", { ...v, starts_at: localToIso(v.starts_at), agenda: v.agenda || null });
      toast.success("Meeting scheduled and residents notified.");
      setMeetingOpen(false);
      meetingForm.reset();
      setWhen("upcoming");
      meetings.refetch();
    } catch (e) {
      if (!applyFieldErrors(meetingForm, e)) toast.error("The meeting could not be scheduled.");
    }
  });

  const rsvp = async (m: Meeting, response: "yes" | "no" | "maybe") => {
    await run(`rsvp-${m.id}`, () => api.post(`/meetings/${m.id}/rsvp`, { response }));
    meetings.refetch();
  };

  const updateMeeting = async (m: Meeting, body: Record<string, unknown>, message: string) => {
    await run(`m-${m.id}`, () => api.patch(`/meetings/${m.id}`, body), message);
    meetings.refetch();
  };

  return (
    <>
      <PageHeader
        title="Notices & meetings"
        breadcrumbs={[{ label: "Notices & meetings" }]}
        actions={publisher && (tab === "notices"
          ? <Button onClick={() => setNoticeOpen(true)}><Plus className="h-4 w-4" /> New notice</Button>
          : <Button onClick={() => setMeetingOpen(true)}><Plus className="h-4 w-4" /> Schedule meeting</Button>)}
      />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "notices", label: "Notices" }, { value: "meetings", label: "Meetings" }]} />

      {tab === "notices" ? (
        notices.error ? <Card><ErrorState message={(notices.error as Error).message} onRetry={() => notices.refetch()} /></Card>
        : notices.isLoading ? <Skeleton className="h-64" />
        : !notices.data?.data.length ? <Card><EmptyState title="No notices" icon={<Megaphone className="h-6 w-6" />} /></Card>
        : (
          <div className="space-y-4">
            {notices.data.data.map((n) => (
              <Card key={n.id} className={cn("p-5", n.pinned && "border-l-4 border-l-gold-500")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">{n.pinned && <Pin className="h-4 w-4 text-gold-500" aria-label="Pinned" />}{n.title}</p>
                    <p className="text-xs text-ink-600">{n.publishedBy ? `${n.publishedBy} · ` : ""}{formatRelative(n.publishedAt)}{publisher ? ` · ${titleCase(n.audience)}` : ""}{n.expiresAt ? ` · expires ${formatDateTime(n.expiresAt)}` : ""}</p>
                  </div>
                  {publisher && <Button size="sm" variant="ghost" className="text-danger-600" aria-label={`Delete ${n.title}`} onClick={() => setDeleteId(n.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-ink-900">{n.body}</p>
              </Card>
            ))}
            <Card><Pagination {...notices.data.meta} onPageChange={setPage} /></Card>
          </div>
        )
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {(["upcoming", "past"] as const).map((w) => <Button key={w} size="sm" variant={when === w ? "primary" : "outline"} onClick={() => setWhen(w)}>{titleCase(w)}</Button>)}
          </div>
          {meetings.error ? <Card><ErrorState message={(meetings.error as Error).message} onRetry={() => meetings.refetch()} /></Card>
          : meetings.isLoading ? <Skeleton className="h-64" />
          : !meetings.data?.data.length ? <Card><EmptyState title={`No ${when} meetings`} icon={<CalendarDays className="h-6 w-6" />} /></Card>
          : (
            <div className="space-y-4">
              {meetings.data.data.map((m) => (
                <Card key={m.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                        <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDateTime(m.startsAt)}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {m.location}</span>
                      </p>
                    </div>
                    <StatusPill status={m.status} />
                  </div>
                  {m.agenda && <p className="mt-3 whitespace-pre-line text-sm">{m.agenda}</p>}
                  {m.minutes && <div className="mt-3 rounded-lg bg-canvas p-3 text-sm"><p className="mb-1 text-xs font-semibold uppercase text-ink-600">Minutes</p><p className="whitespace-pre-line">{m.minutes}</p></div>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                    <p className="text-xs text-ink-600">Attending: {m.rsvp.yes} · Maybe: {m.rsvp.maybe} · Not attending: {m.rsvp.no}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.status === "scheduled" && when === "upcoming" && (["yes", "maybe", "no"] as const).map((r) => (
                        <Button key={r} size="sm" variant={m.myResponse === r ? "primary" : "outline"} disabled={busy === `rsvp-${m.id}`} onClick={() => rsvp(m, r)}>
                          {r === "yes" ? "I'll attend" : r === "no" ? "Can't attend" : "Maybe"}
                        </Button>
                      ))}
                      {publisher && m.status === "scheduled" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setMinutesFor(m); setMinutes(m.minutes ?? ""); }}>Record minutes</Button>
                          <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => updateMeeting(m, { status: "cancelled" }, "Meeting cancelled.")}>Cancel meeting</Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title="New notice" size="lg"
        footer={<><Button variant="outline" onClick={() => setNoticeOpen(false)}>Cancel</Button><Button onClick={publish} loading={noticeForm.formState.isSubmitting}>Publish</Button></>}>
        <form onSubmit={publish} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="n-title" error={noticeForm.formState.errors.title?.message} required><Input id="n-title" {...noticeForm.register("title")} /></Field>
          <Field label="Message" htmlFor="n-body" error={noticeForm.formState.errors.body?.message} required><Textarea id="n-body" rows={6} {...noticeForm.register("body")} /></Field>
          <Field label="Audience" htmlFor="n-aud">
            <Select id="n-aud" {...noticeForm.register("audience")}>
              <option value="all">Everyone</option><option value="residents">Residents</option><option value="staff">Estate staff</option><option value="security">Security team</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-6">
            <Checkbox label="Pin to the top" {...noticeForm.register("pinned")} />
            <Checkbox label="Send a notification" {...noticeForm.register("notify")} />
          </div>
        </form>
      </Modal>

      <Modal open={meetingOpen} onClose={() => setMeetingOpen(false)} title="Schedule a meeting"
        footer={<><Button variant="outline" onClick={() => setMeetingOpen(false)}>Cancel</Button><Button onClick={schedule} loading={meetingForm.formState.isSubmitting}>Schedule</Button></>}>
        <form onSubmit={schedule} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="mt-title" error={meetingForm.formState.errors.title?.message} required><Input id="mt-title" {...meetingForm.register("title")} /></Field>
          <Field label="Venue" htmlFor="mt-loc" error={meetingForm.formState.errors.location?.message} required><Input id="mt-loc" {...meetingForm.register("location")} /></Field>
          <Field label="Date and time" htmlFor="mt-start" error={meetingForm.formState.errors.starts_at?.message} required><Input id="mt-start" type="datetime-local" {...meetingForm.register("starts_at")} /></Field>
          <Field label="Agenda" htmlFor="mt-agenda"><Textarea id="mt-agenda" rows={4} {...meetingForm.register("agenda")} /></Field>
        </form>
      </Modal>

      <Modal open={!!minutesFor} onClose={() => setMinutesFor(null)} title="Meeting minutes" size="lg"
        footer={<><Button variant="outline" onClick={() => setMinutesFor(null)}>Cancel</Button><Button loading={busy === `m-${minutesFor?.id}`} onClick={async () => { if (minutesFor) { await updateMeeting(minutesFor, { status: "held", minutes }, "Minutes saved."); setMinutesFor(null); } }}>Save and mark held</Button></>}>
        <Textarea rows={10} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" placeholder="Decisions, action points and attendance" />
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} destructive loading={busy === "delete"} title="Delete this notice?" message="It will be removed for everyone." confirmLabel="Delete"
        onConfirm={async () => { await run("delete", () => api.delete(`/announcements/${deleteId}`), "Notice deleted."); setDeleteId(null); notices.refetch(); }} />
    </>
  );
}
