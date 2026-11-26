"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, IdCard, MapPin, Navigation, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/modules/auth/auth-provider";
import { EstateIdCard, useEstatePass } from "@/modules/resident/estate-pass-card";

interface EstateInfo {
  name: string;
  contact: { address: string | null; phone: string | null; officeHours: string | null; gate: { lat: number | null; lng: number | null; directions: string | null } };
}
interface Sector { id: number; name: string }
interface Street { id: number; sectorId: number; name: string }

/**
 * Figma "Direction" (estate directory): estate location and gate pin with Get Directions, Copy Location,
 * Share Gate Pin and Print ID Card, plus the street directory.
 */
export default function DirectionPage() {
  const toast = useToast();
  const { can } = useAuth();
  const estate = useQuery({ queryKey: ["public", "estate"], queryFn: () => api.get<{ data: EstateInfo }>("/public/estate") });
  const sectors = useQuery({ queryKey: ["estate", "sectors"], queryFn: () => api.get<{ data: Sector[] }>("/sectors") });
  const streets = useQuery({ queryKey: ["estate", "streets"], queryFn: () => api.get<{ data: Street[] }>("/streets") });
  const pass = useEstatePass(can(["finance.pay_own", "access.manage_own"]));

  const info = estate.data?.data;
  const gate = info?.contact.gate;
  const hasPin = gate?.lat != null && gate?.lng != null;
  const address = info?.contact.address ?? info?.name ?? "";
  const mapsLink = hasPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${gate!.lat},${gate!.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const pinLink = hasPin ? `https://maps.google.com/?q=${gate!.lat},${gate!.lng}` : `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  const shareText = `${info?.name ?? "Estate"} main gate${gate?.directions ? ` — ${gate.directions}` : ""}`;

  const copy = async () => {
    await navigator.clipboard?.writeText(`${address}\n${pinLink}`).catch(() => undefined);
    toast.success("Location copied.");
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: shareText, text: shareText, url: pinLink });
      else {
        await navigator.clipboard.writeText(`${shareText}: ${pinLink}`);
        toast.success("Gate pin copied. Paste it into WhatsApp or SMS.");
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <>
      <PageHeader title="Direction" description="Find your way to the estate and share the gate location with visitors." breadcrumbs={[{ label: "Direction" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={info?.name ?? "Estate location"} description={address || undefined} />
          {estate.isLoading ? <Skeleton className="m-5 h-72" /> : (
            <>
              {hasPin ? (
                <iframe
                  title="Map of the estate main gate"
                  className="h-80 w-full border-y border-line"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${gate!.lng! - 0.006},${gate!.lat! - 0.004},${gate!.lng! + 0.006},${gate!.lat! + 0.004}&layer=mapnik&marker=${gate!.lat},${gate!.lng}`}
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 border-y border-line bg-canvas text-sm text-ink-600">
                  <MapPin className="h-6 w-6" />
                  The estate office has not set the gate location on the map yet. Directions use the estate address.
                </div>
              )}
              {gate?.directions && <p className="px-5 pt-4 text-sm"><span className="font-medium">Gate directions:</span> {gate.directions}</p>}
              <div className="flex flex-wrap gap-2 p-5">
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-army-900 px-4 text-sm font-medium text-white hover:bg-army-800"><Navigation className="h-4 w-4" /> Get directions</a>
                <Button variant="outline" onClick={share}><Share2 className="h-4 w-4" /> Share gate pin</Button>
                <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Copy location</Button>
                {pass.data && <Button variant="outline" onClick={() => window.print()}><IdCard className="h-4 w-4" /> Print ID card</Button>}
              </div>
            </>
          )}
        </Card>
        <Card>
          <CardHeader title="Street directory" />
          {sectors.isLoading || streets.isLoading ? <Skeleton className="m-5 h-40" /> : !streets.data?.data.length ? <EmptyState title="No streets recorded yet" /> : (
            <div className="max-h-[28rem] space-y-4 overflow-y-auto p-5 text-sm">
              {(sectors.data?.data ?? []).map((sec) => {
                const list = streets.data!.data.filter((s) => s.sectorId === sec.id);
                if (!list.length) return null;
                return (
                  <div key={sec.id}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-600">{sec.name}</p>
                    <ul className="space-y-1">{list.map((s) => <li key={s.id} className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-army-800" />{s.name}</li>)}</ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      {pass.data && <div className="hidden print:block"><EstateIdCard pass={pass.data.data} /></div>}
    </>
  );
}
