"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-list-params";
import { Input } from "@/components/ui/form";

export interface HouseholdOption { id: number; unit: string | null; head: string | null }

/** Search households by unit code or head of household; supports one or many selections. */
export function HouseholdPicker({ value, onChange, multiple = false, id }: { value: HouseholdOption[]; onChange: (v: HouseholdOption[]) => void; multiple?: boolean; id?: string }) {
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q);
  const { data } = useQuery({ queryKey: ["finance", "households", query], queryFn: () => api.get<{ data: HouseholdOption[] }>("/finance/households", { q: query }) });
  const options = (data?.data ?? []).filter((o) => !value.some((v) => v.id === o.id));
  const canAdd = multiple || value.length === 0;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded-full bg-army-50 px-3 py-1 text-sm">
              {v.unit} · {v.head}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== v.id))} aria-label={`Remove ${v.unit}`}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      {canAdd && (
        <>
          <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search unit code or resident name" />
          <ul className="max-h-36 overflow-y-auto rounded-lg border border-line">
            {options.map((o) => (
              <li key={o.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => { onChange([...value, o]); setQ(""); }}>{o.unit} <span className="text-ink-600">· {o.head}</span></button></li>
            ))}
            {options.length === 0 && <li className="px-3 py-2 text-sm text-ink-600">No matching households.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
