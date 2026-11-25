"use client";

import { CalendarCheck, CheckCircle2, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { cn, formatDate, formatUsd } from "@/lib/utils";

type Kind = "experience" | "ticket" | "table";

interface TripOption {
  id: number;
  title: string;
  startDate: string | null;
  days: number;
}

const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const COPY: Record<Kind, { title: string; cta: string; unit: string }> = {
  experience: { title: "Book this experience", cta: "Reserve now, pay later", unit: "travelers" },
  ticket: { title: "Skip-the-line tickets", cta: "Reserve tickets", unit: "tickets" },
  table: { title: "Reserve a table", cta: "Reserve table", unit: "guests" },
};

export function BookingWidget({ place, kind, trips }: { place: { id: number; name: string; priceUsd: number }; kind: Kind; trips: TripOption[] }) {
  const { user, requireLogin, toast } = useApp();
  const [date, setDate] = useState(() => isoIn(kind === "table" ? 2 : 7));
  const [party, setParty] = useState(2);
  const [slots, setSlots] = useState<{ time: string; left: number }[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(user?.displayName ?? "");
  const [notes, setNotes] = useState("");
  const [tripId, setTripId] = useState<number | "">(() => {
    const upcoming = trips.find((t) => t.startDate && t.startDate >= isoIn(0));
    return upcoming?.id ?? "";
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; date: string; time: string; party: number; tripId: number | null } | null>(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setTime(null);
    fetch(`/api/bookings/availability?placeId=${place.id}&date=${date}`)
      .then((r) => r.json())
      .then((j) => alive && setSlots(j.slots || []))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [place.id, date]);

  // Default the date to the trip's dates when a trip is chosen.
  useEffect(() => {
    const t = trips.find((x) => x.id === tripId);
    if (t?.startDate && t.startDate >= isoIn(0)) setDate(t.startDate);
  }, [tripId, trips]);

  const total = kind === "table" ? 0 : place.priceUsd * party;
  const copy = COPY[kind];

  const submit = async () => {
    if (!requireLogin("Sign in to book")) return;
    if (!time) return toast("Pick a time", "info");
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: place.id, date, time, party, contactName: name || user?.displayName || "Guest", notes: notes || undefined, tripId: tripId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Booking failed");
      setDone({ ref: j.booking.ref, date: j.booking.date, time: j.booking.time, party: j.booking.party, tripId: j.booking.tripId });
      toast(kind === "table" ? "Table reserved!" : "You're booked!", "success", { label: "View", href: `/bookings/${j.booking.ref}` });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div id="book" className="scroll-mt-24 text-center">
        <CheckCircle2 className="mx-auto size-10 text-brand-600" />
        <div className="mt-2 font-display text-xl font-semibold">{kind === "table" ? "Table reserved" : "Booking confirmed"}</div>
        <p className="mt-1 text-sm text-muted">
          {formatDate(done.date, { weekday: "short", month: "short", day: "numeric" })} at {done.time} · {done.party} {copy.unit}
        </p>
        <p className="mt-2 font-mono text-sm font-semibold tracking-wider">{done.ref}</p>
        <div className="mt-4 grid gap-2">
          <Link href={`/bookings/${done.ref}`} className="btn btn-dark w-full">
            View booking
          </Link>
          {done.tripId && (
            <Link href={`/trips/${done.tripId}`} className="btn btn-outline w-full">
              Open trip — it&apos;s on your itinerary
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="book" className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">{copy.title}</div>
        {place.priceUsd > 0 && (
          <div className="text-sm text-muted">
            {kind === "table" ? "≈ " : ""}
            <strong className="text-ink">{formatUsd(place.priceUsd)}</strong> / person
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input type="date" value={date} min={isoIn(0)} max={isoIn(365)} onChange={(e) => e.target.value && setDate(e.target.value)} className="input min-w-0 px-2.5 py-2 text-sm" aria-label="Date" />
        <div className="flex items-center rounded-xl border border-line-strong">
          <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} className="p-2 text-muted hover:text-ink" aria-label="Fewer people">
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-10 text-center text-sm">
            {party}
            <span className="block text-[9px] uppercase leading-none text-muted">{copy.unit}</span>
          </span>
          <button type="button" onClick={() => setParty((p) => Math.min(kind === "table" ? 10 : 15, p + 1))} className="p-2 text-muted hover:text-ink" aria-label="More people">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Available times</div>
        {!slots ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Checking availability…
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted">No online availability that day.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => {
              const soldOut = s.left < (kind === "table" ? 1 : party);
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={soldOut}
                  onClick={() => setTime(s.time)}
                  className={cn("chip px-2.5 py-1.5 text-xs", soldOut && "line-through opacity-40")}
                  data-active={time === s.time}
                  title={soldOut ? "Sold out" : kind === "table" ? "Available" : `${s.left} left`}
                >
                  {s.time}
                  {!soldOut && kind !== "table" && s.left <= 4 && <span className="text-[10px] text-coral-500">{s.left} left</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {time && (
        <div className="mt-3 space-y-2 animate-fade-up">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name for the booking" className="input py-2 text-sm" aria-label="Name for the booking" maxLength={80} />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={kind === "table" ? "Occasion, allergies… (optional)" : "Requests (optional)"} className="input py-2 text-sm" aria-label="Notes" maxLength={400} />
          {user && trips.length > 0 && (
            <select value={tripId} onChange={(e) => setTripId(e.target.value ? Number(e.target.value) : "")} className="input py-2 text-sm" aria-label="Add to trip">
              <option value="">Don&apos;t add to a trip</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  Add to “{t.title}”
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">{kind === "table" ? "Free to reserve" : "Total"}</span>
        <span className="font-display text-xl font-semibold">{kind === "table" ? "Pay at the venue" : formatUsd(total)}</span>
      </div>
      <button onClick={submit} disabled={busy || !time} className="btn btn-primary mt-3 w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
        {copy.cta}
      </button>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
        Free cancellation up to 24 hours before. {kind === "table" ? "No card needed." : "Nothing is charged in this demo."} Wayfarer earns a small commission from the venue.
      </p>
    </div>
  );
}
