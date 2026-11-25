"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

/** After signing in from the planner, saves the itinerary that was waiting in sessionStorage. */
export function PendingPlanImporter() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useApp();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || sp.get("import") !== "1") return;
    done.current = true;
    const raw = sessionStorage.getItem("wf-pending-plan");
    if (!raw) return;
    sessionStorage.removeItem("wf-pending-plan");
    fetch("/api/trips/from-plan", { method: "POST", headers: { "content-type": "application/json" }, body: raw })
      .then((r) => r.json())
      .then((j) => {
        if (j.id) {
          toast("Your AI itinerary was saved to your trips");
          router.push(`/trips/${j.id}`);
        }
      });
  }, [sp, router, toast]);
  return null;
}

export function NewTripButton({ destinations }: { destinations: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dest, setDest] = useState("");
  const [days, setDays] = useState(3);
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useApp();

  const create = async () => {
    setBusy(true);
    const d = destinations.find((x) => x.slug === dest);
    const r = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title || (d ? `${d.name} trip` : "My trip"), destinationSlug: dest || null, days, startDate: start || null }),
    });
    setBusy(false);
    if (!r.ok) return toast((await r.json()).error || "Couldn't create trip", "error");
    router.push(`/trips/${(await r.json()).id}`);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Plus className="size-4" /> Blank trip
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md space-y-4 p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">New trip</h2>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-icon" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div>
              <label className="label" htmlFor="nt-title">
                Name
              </label>
              <input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer in Lisbon" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="nt-dest">
                Destination
              </label>
              <select id="nt-dest" value={dest} onChange={(e) => setDest(e.target.value)} className="input">
                <option value="">Decide later</option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="nt-start">
                  Start date
                </label>
                <input id="nt-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="nt-days">
                  Days
                </label>
                <input id="nt-days" type="number" min={1} max={21} value={days} onChange={(e) => setDays(Math.max(1, Math.min(21, Number(e.target.value))))} className="input" />
              </div>
            </div>
            <button onClick={create} disabled={busy} className="btn btn-primary w-full">
              {busy && <Loader2 className="size-4 animate-spin" />} Create trip
            </button>
          </div>
        </div>
      )}
    </>
  );
}
