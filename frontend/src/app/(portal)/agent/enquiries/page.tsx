"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { listingsApi } from "@/modules/listings/api";
import type { Enquiry } from "@/types/api";

/** SCR-LIST-07 Agent Enquiries. */
export default function AgentEnquiriesPage() {
  const { params, update } = useListParams(["status", "selected"] as const);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["agent", "enquiries", params.status, params.page],
    queryFn: () => listingsApi.enquiries({ status: params.status, page: params.page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const [selectedId, setSelectedId] = useState<number | null>(() => (params.selected ? Number(params.selected) : null));
  const selected = data?.data.find((e) => e.id === selectedId) ?? null;
  const setSelected = (e: Enquiry | null) => setSelectedId(e?.id ?? null);
  const close = () => {
    setSelected(null);
    update({ selected: null });
  };

  const columns: Column<Enquiry>[] = [
    { key: "name", header: "From", cell: (e) => <div><p className="font-medium">{e.name}</p><p className="text-xs text-ink-600">{e.phone}</p></div> },
    { key: "listing", header: "Listing", cell: (e) => <span className="line-clamp-1">{e.listing?.title ?? "—"}</span> },
    { key: "message", header: "Message", cell: (e) => <span className="line-clamp-1 text-ink-600">{e.message}</span>, hideOnMobile: true },
    { key: "date", header: "Received", cell: (e) => formatDate(e.createdAt), hideOnMobile: true },
    { key: "status", header: "Status", cell: (e) => <StatusPill status={e.status} /> },
  ];

  return (
    <>
      <PageHeader title="Enquiries" breadcrumbs={[{ label: "Dashboard", href: "/agent" }, { label: "Enquiries" }]} />
      <Card>
        <div className="border-b border-line p-4">
          <Tabs
            items={[{ value: "", label: "All" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "closed", label: "Closed" }]}
            value={params.status}
            onChange={(v) => update({ status: v })}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(e) => e.id}
          loading={isLoading || isFetching}
          error={error as Error | null}
          onRetry={() => refetch()}
          onRowClick={setSelected}
          emptyTitle="No enquiries"
          emptyDescription="Enquiries from the public appear here once your listings are live."
        />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal open={!!selected} onClose={close} title={selected ? `Enquiry from ${selected.name}` : ""} description={selected?.listing?.title}>
        {selected && (
          <EnquiryEditor
            key={selected.id}
            enquiry={selected}
            onCancel={close}
            onSaved={() => {
              toast.success("Enquiry updated");
              close();
              queryClient.invalidateQueries({ queryKey: ["agent"] });
            }}
            onError={(e) => toast.error(e instanceof ApiError ? e.message : "Update failed")}
          />
        )}
      </Modal>
    </>
  );
}

/** Mounted per enquiry (keyed), so its fields start from that enquiry's saved values. */
function EnquiryEditor({ enquiry, onCancel, onSaved, onError }: { enquiry: Enquiry; onCancel: () => void; onSaved: () => void; onError: (e: unknown) => void }) {
  const [note, setNote] = useState(enquiry.agentNote ?? "");
  const [status, setStatus] = useState<Enquiry["status"]>(enquiry.status);
  const save = useMutation({
    mutationFn: () => listingsApi.updateEnquiry(enquiry.id, { status, agent_note: note || null }),
    onSuccess: onSaved,
    onError,
  });

  return (
    <div className="space-y-4 text-sm">
      <p className="whitespace-pre-line rounded-lg bg-canvas p-3">{enquiry.message}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-ink-600">
        <div><dt>Received</dt><dd className="font-medium text-ink-900">{formatDateTime(enquiry.createdAt)}</dd></div>
        <div><dt>Preferred viewing</dt><dd className="font-medium text-ink-900">{formatDate(enquiry.preferredViewingDate)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${enquiry.phone}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-army-50"><Phone className="h-4 w-4" /> Call</a>
        <a href={`https://wa.me/${enquiry.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-army-50"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
        {enquiry.email && <a href={`mailto:${enquiry.email}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-army-50"><Mail className="h-4 w-4" /> Email</a>}
      </div>
      <Field label="Status" htmlFor="enq-status">
        <Select id="enq-status" value={status} onChange={(e) => setStatus(e.target.value as Enquiry["status"])}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </Select>
      </Field>
      <Field label="Private note" htmlFor="enq-note" hint="Only you can see this note.">
        <Textarea id="enq-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="outline" onClick={onCancel}>Close</Button>
        <Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button>
      </div>
    </div>
  );
}
