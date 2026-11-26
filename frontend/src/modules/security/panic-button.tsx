"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ambulance, Flame, ShieldAlert, Siren } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { Alert } from "@/types/modules";

const TYPES = [
  { value: "panic", label: "Panic", icon: Siren },
  { value: "security", label: "Intruder", icon: ShieldAlert },
  { value: "medical", label: "Medical", icon: Ambulance },
  { value: "fire", label: "Fire", icon: Flame },
] as const;

function position(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 });
  });
}

/**
 * Figma resident sidebar PANIC button (above Logout). One confirmation step, then the alert goes to the
 * security dashboard; only the security team can acknowledge and resolve it.
 */
export function PanicButton({ collapsed, onDone }: { collapsed: boolean; onDone?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("panic");
  const [note, setNote] = useState("");

  const alerts = useQuery({
    queryKey: ["resident", "alerts"],
    queryFn: () => api.get<{ data: Alert[] }>("/resident/alerts"),
    refetchInterval: 30_000,
  });
  const active = alerts.data?.data.find((a) => ["raised", "acknowledged", "dispatched"].includes(a.status));

  const send = async () => {
    const pos = await position();
    const res = await run("panic", () => api.post("/resident/alerts", { type, description: note || null, lat: pos?.lat ?? null, lng: pos?.lng ?? null }), "Help is on its way. Security has been alerted.");
    if (res !== undefined) {
      setOpen(false);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["resident"] });
      onDone?.();
      router.push("/resident/emergency");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!active) return setOpen(true);
          onDone?.();
          router.push("/resident/emergency");
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg bg-danger-600 px-3 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-danger-600/90",
          active && "animate-pulse",
          collapsed && "px-2",
        )}
        aria-label={active ? "Emergency alert active — view progress" : "PANIC — alert estate security"}
        title={collapsed ? "PANIC" : undefined}
      >
        <Siren className="h-5 w-5 shrink-0" aria-hidden />
        {!collapsed && (active ? "Alert active" : "Panic")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Alert estate security?" description="Use only in a real emergency. Your name, unit and phone number go to the security team immediately."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" loading={busy === "panic"} onClick={send}><Siren className="h-4 w-4" /> Send alert now</Button></>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="What is happening">
          {TYPES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={type === t.value} onClick={() => setType(t.value)}
              className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium", type === t.value ? "border-danger-600 bg-danger-50 text-danger-600" : "border-line hover:bg-canvas")}>
              <t.icon className="h-5 w-5" />{t.label}
            </button>
          ))}
        </div>
        <Textarea className="mt-3" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: anything security should know" aria-label="Details for security" />
      </Modal>
    </>
  );
}
