"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X as XIcon } from "lucide-react";
import { api, ApiError, type Paginated } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Modal, ReasonDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import type { AccessRequest } from "@/types/api";

/** Resident access request queue (FR-USR-02, WF-01). */
export default function AccessRequestsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { params, update } = useListParams(["status", "q", "selected"] as const);
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "info">(null);
  const [busy, setBusy] = useState(false);
  const status = params.status || "pending";

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "access-requests", status, params.q, params.page],
    queryFn: () => api.get<Paginated<AccessRequest, { pendingCount: number }>>("/admin/access-requests", { status: status === "all" ? "" : status, q: params.q, page: params.page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (params.selected && data) setSelected(data.data.find((r) => r.id === Number(params.selected)) ?? null);
  }, [params.selected, data]);

  const decide = async (path: string, body: object | undefined, success: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${selected.id}/${path}`, body);
      toast.success(success);
      setDialog(null);
      setSelected(null);
      update({ selected: null });
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The decision could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AccessRequest>[] = [
    { key: "name", header: "Applicant", cell: (r) => <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-ink-600">{r.email}</p></div> },
    { key: "unit", header: "House", cell: (r) => r.unit?.code ?? "—" },
    { key: "rel", header: "Relationship", cell: (r) => titleCase(r.relationship), hideOnMobile: true },
    { key: "ref", header: "Reference", cell: (r) => r.reference, hideOnMobile: true },
    { key: "date", header: "Submitted", cell: (r) => formatDate(r.createdAt), hideOnMobile: true },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
  ];

  const open = selected && ["pending", "info_requested"].includes(selected.status);

  return (
    <>
      <PageHeader title="Access requests" description="Review resident registration requests. Approval activates the account and links it to the unit." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Access requests" }]} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={[
              { value: "pending", label: "Pending", count: data?.meta.pendingCount },
              { value: "info_requested", label: "Info requested" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ]}
            value={status}
            onChange={(v) => update({ status: v })}
          />
          <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search name, email or reference" />
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(r) => r.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} onRowClick={setSelected} emptyTitle="No requests here" />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal
        open={!!selected && !dialog}
        onClose={() => { setSelected(null); update({ selected: null }); }}
        title={selected?.fullName ?? ""}
        description={selected ? `${selected.reference} · submitted ${formatDateTime(selected.createdAt)}` : undefined}
        size="lg"
        footer={
          open && can("access_requests.decide") ? (
            <>
              <Button variant="outline" onClick={() => setDialog("info")}>Request information</Button>
              <Button variant="outline" onClick={() => setDialog("reject")}>Reject</Button>
              <Button onClick={() => setDialog("approve")}>Approve</Button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Email", selected.email],
                ["Phone", selected.phone],
                ["Relationship", titleCase(selected.relationship)],
                ["House", `${selected.unit?.code ?? "—"}${selected.unit?.street ? `, ${selected.unit.street}` : ""}`],
                ["NIN", selected.nationalIdMasked],
                ["Status", <StatusPill key="s" status={selected.status} />],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-ink-600">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-ink-600">Declarations</dt>
                <dd className="mt-1 space-y-1">
                  {([["insideEstate", "Currently a resident of the estate"], ["infoCorrect", "Information is correct"], ["agreeRules", "Agrees to estate rules"]] as const).map(([k, label]) => (
                    <p key={k} className="flex items-center gap-2">{selected.declarations[k] ? <Check className="h-4 w-4 text-success-600" /> : <XIcon className="h-4 w-4 text-danger-600" />}{label}</p>
                  ))}
                </dd>
              </div>
              {selected.decisionReason && (
                <div className="col-span-2 rounded-md bg-canvas p-3">
                  <dt className="text-xs text-ink-600">Decision note{selected.reviewedBy ? ` by ${selected.reviewedBy}` : ""}</dt>
                  <dd className="mt-0.5">{selected.decisionReason}</dd>
                </div>
              )}
            </dl>
            <div className="space-y-3">
              {[["Profile photo", selected.photoUrl], ["Face capture", selected.faceUrl]].map(([label, url]) => (
                <figure key={label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${label} of ${selected.fullName}`} className="aspect-square w-full rounded-lg border border-line bg-canvas object-cover" />
                  <figcaption className="mt-1 text-xs text-ink-600">{label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        onConfirm={() => decide("approve", undefined, "Request approved. The resident can now sign in.")}
        title="Approve access request?"
        message={`${selected?.fullName} gets an active resident account linked to ${selected?.unit?.code}. If the unit already has a head of household, they join as a household member.`}
        confirmLabel="Approve"
        loading={busy}
      />
      <ReasonDialog open={dialog === "reject"} onClose={() => setDialog(null)} onSubmit={(reason) => decide("reject", { reason }, "Request rejected. The applicant has been emailed the reason.")} title="Reject request" confirmLabel="Reject" destructive loading={busy} />
      <ReasonDialog open={dialog === "info"} onClose={() => setDialog(null)} onSubmit={(reason) => decide("request-info", { reason }, "Information requested from the applicant.")} title="Request more information" confirmLabel="Send request" loading={busy} />
    </>
  );
}
