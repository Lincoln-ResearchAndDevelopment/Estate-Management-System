"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, DoorOpen, Home, Plus } from "lucide-react";
import { api, ApiError, type Paginated } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { useListParams } from "@/hooks/use-list-params";
import { Button } from "@/components/ui/button";
import { Card, KpiCard } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/modules/auth/auth-provider";
import type { Sector, Street, Unit } from "@/types/api";

const unitSchema = z.object({
  unit_code: z.string().trim().min(1, "Enter the house number.").max(40),
  sector_id: z.coerce.number().int().positive("Choose a sector."),
  street_id: z.coerce.number().int().positive("Choose a street."),
  unit_type: z.string().trim().min(1, "Enter the unit type.").max(40),
  rooms: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number().int().min(0).max(50).optional()),
  occupancy_status: z.enum(["occupied", "vacant", "under_watch"]),
});
type UnitValues = z.infer<typeof unitSchema>;

const simpleSchema = z.object({ name: z.string().trim().min(2, "Enter a name.").max(120), code: z.string().trim().max(20).optional(), sector_id: z.coerce.number().optional() });
type SimpleValues = z.infer<typeof simpleSchema>;

/** M04 Estate directory: sectors, streets and units (FR-PROP-01/02). */
export default function EstatePage() {
  const { can } = useAuth();
  const toast = useToast();
  const manage = can("estate.manage");
  const { params, update } = useListParams(["q", "sector_id", "status"] as const);
  const [editing, setEditing] = useState<Unit | "new" | null>(null);
  const [adding, setAdding] = useState<"sector" | "street" | null>(null);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => api.get<{ data: Sector[] }>("/sectors") });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["units", params],
    queryFn: () => api.get<Paginated<Unit, { kpis: { totalUnits: number; vacant: number; occupied: number } }>>("/units", { ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const unitForm = useForm<UnitValues>({ resolver: zodResolver(unitSchema) });
  const unitSector = unitForm.watch("sector_id");
  const streets = useQuery({ queryKey: ["streets", Number(unitSector)], queryFn: () => api.get<{ data: Street[] }>("/streets", { sector_id: unitSector }), enabled: !!unitSector });
  const simpleForm = useForm<SimpleValues>({ resolver: zodResolver(simpleSchema) });

  const openUnit = (u: Unit | "new") => {
    setEditing(u);
    unitForm.reset(
      u === "new"
        ? { unit_code: "", sector_id: undefined as unknown as number, street_id: undefined as unknown as number, unit_type: "", rooms: undefined, occupancy_status: "vacant" }
        : { unit_code: u.code, sector_id: u.sector?.id, street_id: u.street?.id, unit_type: u.unitType, rooms: u.rooms ?? undefined, occupancy_status: u.occupancyStatus },
    );
  };

  const saveUnit = unitForm.handleSubmit(async (values) => {
    try {
      if (editing === "new") await api.post("/units", values);
      else if (editing) await api.patch(`/units/${editing.id}`, values);
      toast.success("Unit saved");
      setEditing(null);
      refetch();
      sectors.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) Object.entries(e.fieldErrors()).forEach(([f, m]) => unitForm.setError(f as keyof UnitValues, { message: m }));
      else toast.error(e instanceof ApiError ? e.message : "The unit could not be saved.");
    }
  });

  const saveSimple = simpleForm.handleSubmit(async (values) => {
    try {
      if (adding === "sector") await api.post("/sectors", { name: values.name, code: values.code });
      else await api.post("/streets", { name: values.name, sector_id: values.sector_id });
      toast.success(`${adding === "sector" ? "Sector" : "Street"} added`);
      setAdding(null);
      simpleForm.reset();
      sectors.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) Object.entries(e.fieldErrors()).forEach(([f, m]) => simpleForm.setError(f as keyof SimpleValues, { message: m }));
      else toast.error(e instanceof ApiError ? e.message : "Could not be saved.");
    }
  });

  const columns: Column<Unit>[] = [
    { key: "code", header: "House", cell: (u) => <span className="font-medium">{u.code}</span> },
    { key: "street", header: "Street", cell: (u) => u.street?.name ?? "—" },
    { key: "sector", header: "Sector", cell: (u) => u.sector?.name ?? "—", hideOnMobile: true },
    { key: "type", header: "Type", cell: (u) => u.unitType, hideOnMobile: true },
    { key: "rooms", header: "Rooms", cell: (u) => u.rooms ?? "—", hideOnMobile: true },
    { key: "status", header: "Occupancy", cell: (u) => <StatusPill status={u.occupancyStatus} /> },
  ];
  const k = data?.meta.kpis;

  return (
    <>
      <PageHeader
        title="Estate directory"
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Estate directory" }]}
        actions={manage && (
          <>
            <Button variant="outline" onClick={() => { simpleForm.reset({ name: "", code: "" }); setAdding("sector"); }}><Plus className="h-4 w-4" /> Sector</Button>
            <Button variant="outline" onClick={() => { simpleForm.reset({ name: "" }); setAdding("street"); }}><Plus className="h-4 w-4" /> Street</Button>
            <Button onClick={() => openUnit("new")}><Plus className="h-4 w-4" /> Add unit</Button>
          </>
        )}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total units" value={k?.totalUnits ?? 0} icon={<Building2 className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Occupied" value={k?.occupied ?? 0} icon={<Home className="h-5 w-5" />} loading={isLoading} />
        <KpiCard label="Vacant" value={k?.vacant ?? 0} icon={<DoorOpen className="h-5 w-5" />} loading={isLoading} />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Search house number" />
          <Select className="sm:w-48" value={params.sector_id} onChange={(e) => update({ sector_id: e.target.value })} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unitsCount})</option>)}
          </Select>
          <Select className="sm:w-44" value={params.status} onChange={(e) => update({ status: e.target.value })} aria-label="Occupancy">
            <option value="">All occupancy</option>
            {["occupied", "vacant", "under_watch"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.data} rowKey={(u) => u.id} loading={isLoading || isFetching} error={error as Error | null} onRetry={() => refetch()} onRowClick={manage ? openUnit : undefined} emptyTitle="No units found" emptyDescription={manage ? "Add sectors, streets and units to build the estate directory." : undefined} />
        {data && <Pagination {...data.meta} onPageChange={(page) => update({ page })} />}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add unit" : `Edit ${editing && editing !== "new" ? editing.code : ""}`}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveUnit} loading={unitForm.formState.isSubmitting}>Save unit</Button></>}>
        <form onSubmit={saveUnit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="House number" htmlFor="unit_code" error={unitForm.formState.errors.unit_code?.message} required><Input id="unit_code" {...unitForm.register("unit_code")} /></Field>
          <Field label="Unit type" htmlFor="unit_type" error={unitForm.formState.errors.unit_type?.message} required><Input id="unit_type" placeholder="e.g. Bungalow" {...unitForm.register("unit_type")} /></Field>
          <Field label="Sector" htmlFor="u-sector" error={unitForm.formState.errors.sector_id?.message} required>
            <Select id="u-sector" {...unitForm.register("sector_id")}><option value="">Choose…</option>{sectors.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </Field>
          <Field label="Street" htmlFor="u-street" error={unitForm.formState.errors.street_id?.message} required>
            <Select id="u-street" disabled={!unitSector} {...unitForm.register("street_id")}><option value="">Choose…</option>{streets.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </Field>
          <Field label="Rooms" htmlFor="rooms" error={unitForm.formState.errors.rooms?.message}><Input id="rooms" type="number" min={0} {...unitForm.register("rooms")} /></Field>
          <Field label="Occupancy" htmlFor="occ" error={unitForm.formState.errors.occupancy_status?.message} required>
            <Select id="occ" {...unitForm.register("occupancy_status")}>{["occupied", "vacant", "under_watch"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
          </Field>
        </form>
      </Modal>

      <Modal open={!!adding} onClose={() => setAdding(null)} title={adding === "sector" ? "Add sector" : "Add street"} size="sm"
        footer={<><Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button><Button onClick={saveSimple} loading={simpleForm.formState.isSubmitting}>Save</Button></>}>
        <form onSubmit={saveSimple} noValidate className="space-y-4">
          {adding === "street" && (
            <Field label="Sector" htmlFor="s-sector" error={simpleForm.formState.errors.sector_id?.message} required>
              <Select id="s-sector" {...simpleForm.register("sector_id")}><option value="">Choose…</option>{sectors.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
          )}
          <Field label="Name" htmlFor="s-name" error={simpleForm.formState.errors.name?.message} required><Input id="s-name" {...simpleForm.register("name")} /></Field>
          {adding === "sector" && <Field label="Code" htmlFor="s-code" error={simpleForm.formState.errors.code?.message} hint="Short code, e.g. SEC-D" required><Input id="s-code" {...simpleForm.register("code")} /></Field>}
        </form>
      </Modal>
    </>
  );
}
