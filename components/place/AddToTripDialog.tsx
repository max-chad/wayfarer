"use client";

import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

interface TripLite {
  id: number;
  title: string;
  days: number;
  itemCount: number;
  destination?: { name: string; slug: string } | null;
}

export function AddToTripDialog({ place, onClose }: { place: { id: number; name: string; destinationSlug: string; destinationName: string }; onClose: () => void }) {
  const { toast } = useApp();
  const [trips, setTrips] = useState<TripLite[] | null>(null);
  const [tripId, setTripId] = useState<number | "new" | null>(null);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState(`${place.destinationName} trip`);
  const [newDays, setNewDays] = useState(3);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((j) => {
        const list: TripLite[] = j.trips || [];
        setTrips(list);
        const match = list.find((t) => t.destination?.slug === place.destinationSlug);
        setTripId(match ? match.id : list.length ? list[0].id : "new");
      });
  }, [place.destinationSlug]);

  const selected = trips?.find((t) => t.id === tripId);
  const maxDays = tripId === "new" ? newDays : selected?.days || 1;

  const submit = async () => {
    setBusy(true);
    try {
      let id = tripId;
      if (id === "new") {
        const r = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: newTitle, destinationSlug: place.destinationSlug, days: newDays }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        id = (await r.json()).id;
      }
      const r = await fetch(`/api/trips/${id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: Math.min(day, maxDays), placeId: place.id }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast(`Added ${place.name} to Day ${Math.min(day, maxDays)}`, "success", { label: "Open trip", href: `/trips/${id}` });
      onClose();
    } catch (e) {
      toast((e as Error).message || "Couldn't add to trip", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-fade-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="Add to trip">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Add to a trip</h2>
            <p className="text-sm text-muted">{place.name}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {!trips ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {trips.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/60 dark:has-[:checked]:bg-brand-950/40">
                  <input type="radio" name="trip" checked={tripId === t.id} onChange={() => setTripId(t.id)} className="accent-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-muted">
                      {t.destination?.name || "No destination"} · {t.days} days · {t.itemCount} items
                    </div>
                  </div>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 has-[:checked]:border-brand-500">
                <input type="radio" name="trip" checked={tripId === "new"} onChange={() => setTripId("new")} className="accent-brand-600" />
                <Plus className="size-4 text-muted" />
                <span className="text-sm font-semibold">Create a new trip</span>
              </label>
            </div>
            {tripId === "new" && (
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="input" aria-label="Trip name" />
                <select value={newDays} onChange={(e) => setNewDays(Number(e.target.value))} className="input" aria-label="Days">
                  {Array.from({ length: 14 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} d
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div className="label">Which day?</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: maxDays }, (_, i) => (
                  <button key={i} onClick={() => setDay(i + 1)} className="chip" data-active={day === i + 1}>
                    Day {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={submit} disabled={busy} className="btn btn-primary w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} Add to trip
            </button>
            <p className="text-center text-xs text-muted">
              Or let AI build the whole thing:{" "}
              <Link href={`/plan?destination=${place.destinationSlug}&mustSee=${place.id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
                plan a trip around it
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
