"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  Download,
  Globe2,
  GripVertical,
  Link2,
  ListChecks,
  Navigation,
  Loader2,
  Lock,
  Map as MapIcon,
  NotebookPen,
  Plus,
  Printer,
  Route,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LazyMap, type MapMarker } from "@/components/map/LazyMap";
import { DAY_COLORS } from "@/components/planner/ItineraryView";
import { useApp } from "@/components/providers/AppProviders";
import { Avatar } from "@/components/ui/Avatar";
import { Markdown } from "@/components/ui/Markdown";
import { SmartImage } from "@/components/ui/SmartImage";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { haversineKm, orderRoute, routeLengthKm } from "@/lib/geo";
import type { WeatherIcon as WIcon } from "@/lib/services/weather";
import type { PackingList, PlaceCardData, PlaceType, Trip, TripItem } from "@/lib/types";
import { cn, formatDate, formatDuration, formatUsd, imgUrl, TYPE_LABELS } from "@/lib/utils";

interface DayWeather {
  date: string;
  tmax: number;
  tmin: number;
  precipProb: number;
  summary: string;
  icon: WIcon;
  source: "forecast" | "climate";
}

type Tab = "itinerary" | "map" | "book" | "packing" | "budget" | "notes";

export interface TripBooking {
  ref: string;
  placeId: number;
  date: string;
  time: string | null;
  party: number;
}

export function TripEditor({
  initial,
  editable,
  shared = false,
  weather,
  destination,
  bookings = [],
}: {
  initial: Trip;
  editable: boolean;
  shared?: boolean;
  bookings?: TripBooking[];
  weather: DayWeather[];
  destination: { slug: string; name: string; lat: number; lng: number; currency: { code: string; symbol: string }; dailyBudget: Record<string, number> } | null;
}) {
  const { toast, user, upgrade } = useApp();
  const router = useRouter();
  const [trip, setTrip] = useState(initial);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: number; index: number } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setTrip(initial), [initial]);

  const api = useCallback(
    async (url: string, method: string, body?: unknown) => {
      setSaving(true);
      try {
        const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Request failed");
        if (j.trip) setTrip(j.trip);
        return j;
      } catch (e) {
        toast((e as Error).message, "error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [toast]
  );

  const patchTrip = (patch: Partial<Trip> & Record<string, unknown>) => api(`/api/trips/${trip.id}`, "PATCH", patch);

  const hotelItem = trip.items.find((i) => i.position < 0 && i.place?.type === "hotel");
  const itemsByDay = useMemo(() => {
    const m = new Map<number, TripItem[]>();
    for (let d = 1; d <= trip.days; d++) m.set(d, []);
    for (const it of trip.items) {
      if (it === hotelItem) continue;
      const day = Math.min(it.day, trip.days);
      m.get(day)?.push(it);
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position || (a.startTime || "").localeCompare(b.startTime || ""));
    return m;
  }, [trip.items, trip.days, hotelItem]);

  // ── reordering ────────────────────────────────────────────────────────────
  const commitOrder = async (next: Map<number, TripItem[]>) => {
    const order = [...next.entries()].flatMap(([day, list]) => list.map((it, position) => ({ id: it.id, day, position })));
    // optimistic
    setTrip((t) => ({
      ...t,
      items: t.items.map((it) => {
        const o = order.find((x) => x.id === it.id);
        return o ? { ...it, day: o.day, position: o.position } : it;
      }),
    }));
    await api(`/api/trips/${trip.id}/reorder`, "POST", { order });
  };

  const moveItem = (id: number, toDay: number, toIndex: number) => {
    const next = new Map([...itemsByDay.entries()].map(([d, l]) => [d, [...l]]));
    let moving: TripItem | undefined;
    for (const [, list] of next) {
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) moving = list.splice(i, 1)[0];
    }
    if (!moving) return;
    const target = next.get(toDay)!;
    target.splice(Math.min(toIndex, target.length), 0, moving);
    commitOrder(next);
  };

  const optimizeDay = async (day: number) => {
    const list = itemsByDay.get(day) || [];
    const withPlace = list.filter((i) => i.place);
    if (withPlace.length < 3) return toast("Add at least 3 places to optimise a day's route", "info");
    const start = hotelItem?.place || undefined;
    const pts = withPlace.map((i) => ({ ...i, lat: i.place!.lat, lng: i.place!.lng }));
    const before = routeLengthKm(start ? [start, ...pts] : pts);
    const ordered = orderRoute(pts, start);
    const after = routeLengthKm(start ? [start, ...ordered] : ordered);
    if (after >= before - 0.05) return toast("This day's route is already optimal 👌", "info");
    // keep non-place items (notes) at their relative slots, re-sequence place items
    const queue = [...ordered];
    const nextList = list.map((i) => (i.place ? queue.shift()! : i));
    const next = new Map(itemsByDay);
    next.set(day, nextList as TripItem[]);
    await commitOrder(next);
    toast(`Route optimised: ${before.toFixed(1)} km → ${after.toFixed(1)} km (−${Math.round((1 - after / before) * 100)}%)`);
  };

  const removeItem = (id: number) => api(`/api/trips/${trip.id}/items/${id}`, "DELETE");
  const updateItem = (id: number, patch: Partial<Pick<TripItem, "title" | "note" | "startTime" | "durationMin" | "costUsd">>) => api(`/api/trips/${trip.id}/items/${id}`, "PATCH", patch);

  // ── derived ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byDay = [...itemsByDay.entries()].map(([day, list]) => ({ day, cost: list.reduce((s, i) => s + i.costUsd, 0) }));
    const nights = Math.max(1, trip.days - 1);
    const lodging = hotelItem?.place ? hotelItem.place.priceUsd * nights * Math.ceil(trip.travelers / 2) : 0;
    const itemsCost = byDay.reduce((s, d) => s + d.cost, 0);
    return { byDay, lodging, itemsCost, total: lodging + itemsCost };
  }, [itemsByDay, hotelItem, trip.days, trip.travelers]);

  const allMarkers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    for (const [day, list] of itemsByDay)
      list
        .filter((i) => i.place)
        .forEach((i, idx) =>
          out.push({
            id: i.id,
            lat: i.place!.lat,
            lng: i.place!.lng,
            title: i.title,
            subtitle: `Day ${day}${i.startTime ? ` · ${i.startTime}` : ""}`,
            href: `/place/${i.place!.slug}`,
            image: i.place!.image ? imgUrl(i.place!.image, 330) : null,
            color: DAY_COLORS[(day - 1) % DAY_COLORS.length],
            label: tab === "map" ? day : idx + 1,
          })
        );
    if (hotelItem?.place) out.push({ id: "hotel", lat: hotelItem.place.lat, lng: hotelItem.place.lng, title: hotelItem.place.name, subtitle: "Hotel", color: "#111827", label: "H", href: `/place/${hotelItem.place.slug}` });
    return out;
  }, [itemsByDay, hotelItem, tab]);

  const polylines = useMemo(
    () =>
      [...itemsByDay.entries()].map(([day, list]) => ({
        color: DAY_COLORS[(day - 1) % DAY_COLORS.length],
        points: list.filter((i) => i.place).map((i) => [i.place!.lat, i.place!.lng] as [number, number]),
      })),
    [itemsByDay]
  );

  const shareUrl = typeof window !== "undefined" && trip.shareToken ? `${window.location.origin}/trips/share/${trip.shareToken}` : "";

  const togglePublic = async () => {
    const j = await patchTrip({ isPublic: !trip.isPublic });
    if (j && !trip.isPublic) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/trips/share/${trip.shareToken}`);
        toast("Trip is public — share link copied");
      } catch {
        toast("Trip is now public");
      }
    }
  };

  const duplicate = async () => {
    const r = await fetch(`/api/trips/${trip.id}/duplicate`, { method: "POST" });
    if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    const j = await r.json();
    if (j.id) {
      toast("Copied to your trips");
      router.push(`/trips/${j.id}`);
    }
  };

  const del = async () => {
    if (!confirm("Delete this trip? This can't be undone.")) return;
    const r = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
    if (r.ok) {
      toast("Trip deleted");
      router.push("/trips");
      router.refresh();
    }
  };

  const dateFor = (day: number) => {
    if (!trip.startDate) return null;
    const d = new Date(trip.startDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + day - 1);
    return d;
  };

  return (
    <div className="pb-10">
      {/* header */}
      <div className="relative overflow-hidden border-b border-line">
        <SmartImage image={trip.destination?.image} alt="" width={1280} className="absolute inset-0 h-full w-full opacity-25 dark:opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
        <div className="container-page relative py-8">
          {shared && trip.owner && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted">
              <Avatar name={trip.owner.displayName} color={trip.owner.avatarColor} size={24} /> Shared by{" "}
              <Link href={`/profile/${trip.owner.username}`} className="font-semibold text-ink hover:underline">
                {trip.owner.displayName}
              </Link>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editable ? (
                <input
                  defaultValue={trip.title}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== trip.title && patchTrip({ title: e.target.value.trim() })}
                  className="w-full bg-transparent font-display text-3xl font-semibold tracking-tight outline-none focus:underline sm:text-4xl"
                  aria-label="Trip name"
                />
              ) : (
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{trip.title}</h1>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                {trip.destination && (
                  <Link href={`/destinations/${trip.destination.slug}`} className="font-semibold text-ink hover:underline">
                    📍 {trip.destination.name}, {trip.destination.country}
                  </Link>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {editable ? (
                    <input
                      type="date"
                      defaultValue={trip.startDate || ""}
                      onChange={(e) => patchTrip({ startDate: e.target.value || null }).then(() => router.refresh())}
                      className="rounded-md border border-line bg-surface px-2 py-0.5 text-ink"
                      aria-label="Start date"
                    />
                  ) : trip.startDate ? (
                    formatDate(trip.startDate)
                  ) : (
                    "Flexible dates"
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  {editable ? (
                    <>
                      <button onClick={() => trip.days > 1 && patchTrip({ days: trip.days - 1 })} className="rounded-md border border-line px-1.5 leading-none" aria-label="Remove a day">
                        −
                      </button>
                      {trip.days} days
                      <button onClick={() => trip.days < 21 && patchTrip({ days: trip.days + 1 })} className="rounded-md border border-line px-1.5 leading-none" aria-label="Add a day">
                        +
                      </button>
                    </>
                  ) : (
                    `${trip.days} days`
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" /> {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
                </span>
                <span className="capitalize">{trip.budget === "midrange" ? "Mid-range" : trip.budget} · {trip.pace}</span>
                {saving && <Loader2 className="size-4 animate-spin" />}
              </div>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              {editable ? (
                <>
                  <button onClick={togglePublic} className={cn("btn btn-outline", trip.isPublic && "border-brand-500 text-brand-700 dark:text-brand-300")}>
                    {trip.isPublic ? <Globe2 className="size-4" /> : <Lock className="size-4" />} {trip.isPublic ? "Public" : "Private"}
                  </button>
                  {trip.isPublic && (
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareUrl);
                        toast("Share link copied");
                      }}
                      className="btn btn-outline btn-icon"
                      title="Copy share link"
                      aria-label="Copy share link"
                    >
                      <Link2 className="size-4" />
                    </button>
                  )}
                </>
              ) : (
                <button onClick={duplicate} className="btn btn-primary">
                  <Copy className="size-4" /> {user ? "Copy to my trips" : "Sign in to copy"}
                </button>
              )}
              <a href={`/api/trips/${trip.id}/ics`} className="btn btn-outline" title="Export to Google/Apple/Outlook calendar">
                <Download className="size-4" /> .ics
              </a>
              <a
                href={`/api/trips/${trip.id}/gpx`}
                onClick={async (e) => {
                  e.preventDefault();
                  const res = await fetch(`/api/trips/${trip.id}/gpx`);
                  if (res.status === 402) return upgrade("gpx", "GPX export for offline map apps is part of Wayfarer Plus.");
                  if (!res.ok) return toast("Couldn't export this trip", "error");
                  const url = URL.createObjectURL(await res.blob());
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${trip.title.replace(/[^\w-]+/g, "-").toLowerCase() || "trip"}.gpx`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-outline"
                title="Download GPX for offline maps (Plus)"
              >
                <Navigation className="size-4" /> GPX
              </a>
              <button onClick={() => window.print()} className="btn btn-outline btn-icon" aria-label="Print" title="Print">
                <Printer className="size-4" />
              </button>
              {editable && (
                <>
                  <button onClick={duplicate} className="btn btn-outline btn-icon" aria-label="Duplicate trip" title="Duplicate">
                    <Copy className="size-4" />
                  </button>
                  <button onClick={del} className="btn btn-outline btn-icon hover:border-coral-500 hover:text-coral-600" aria-label="Delete trip" title="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="no-print mt-6 flex gap-1 overflow-x-auto scrollbar-none">
            {(
              [
                ["itinerary", "Itinerary", CalendarDays],
                ["map", "Map", MapIcon],
                ["book", "Bookings", CalendarCheck],
                ["packing", "Packing list", ListChecks],
                ["budget", "Budget", Wallet],
                ["notes", "Notes", NotebookPen],
              ] as const
            ).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className="chip shrink-0" data-active={tab === k}>
                <Icon className="size-4" /> {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container-page mt-6">
        {tab === "itinerary" && (
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              {hotelItem?.place && (
                <div className="card flex items-center gap-3 p-3">
                  <SmartImage image={hotelItem.place.image} alt="" width={330} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">Hotel</div>
                    <Link href={`/place/${hotelItem.place.slug}`} className="font-semibold hover:underline">
                      {hotelItem.place.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {formatUsd(hotelItem.place.priceUsd)}/night · ★ {hotelItem.place.rating.toFixed(1)}
                    </div>
                  </div>
                  {editable && (
                    <button onClick={() => removeItem(hotelItem.id)} className="btn btn-ghost btn-icon" aria-label="Remove hotel">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )}
              {[...itemsByDay.entries()].map(([day, list]) => {
                const w = weather[day - 1];
                const date = dateFor(day);
                const km = routeLengthKm(list.filter((i) => i.place).map((i) => i.place!));
                return (
                  <section
                    key={day}
                    className={cn("card overflow-hidden transition-shadow", dropTarget?.day === day && "ring-2 ring-brand-400")}
                    onDragOver={(e) => {
                      if (!editable || dragId == null) return;
                      e.preventDefault();
                      if (!list.length) setDropTarget({ day, index: 0 });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId != null && dropTarget) moveItem(dragId, dropTarget.day, dropTarget.index);
                      setDragId(null);
                      setDropTarget(null);
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3" style={{ borderLeft: `4px solid ${DAY_COLORS[(day - 1) % DAY_COLORS.length]}` }}>
                      <div>
                        <div className="font-display text-lg font-semibold">Day {day}</div>
                        <div className="text-xs text-muted">
                          {date ? date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }) : "Flexible"} · {list.length} stops
                          {km > 0 ? ` · ${km.toFixed(1)} km` : ""}
                        </div>
                      </div>
                      {w && (
                        <div className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs" title={w.source === "climate" ? "Climate average" : "Forecast"}>
                          <WeatherIcon icon={w.icon} className="size-4" /> {w.tmax}°/{w.tmin}° · {w.precipProb}%
                        </div>
                      )}
                      {editable && (
                        <div className="no-print ml-auto flex gap-1">
                          <button onClick={() => optimizeDay(day)} className="btn btn-ghost btn-sm" title="Reorder stops into the shortest route">
                            <Route className="size-4" /> Optimise route
                          </button>
                          <button onClick={() => setAdding(day)} className="btn btn-outline btn-sm">
                            <Plus className="size-4" /> Add
                          </button>
                        </div>
                      )}
                    </div>
                    <ol className="divide-y divide-line">
                      {list.length === 0 && (
                        <li className="px-4 py-8 text-center text-sm text-muted">
                          {editable ? "Drag stops here or add a place to this day." : "Free day — nothing planned yet."}
                        </li>
                      )}
                      {list.map((it, idx) => {
                        const prev = idx > 0 ? list[idx - 1] : null;
                        const leg = prev?.place && it.place ? haversineKm(prev.place, it.place) : null;
                        return (
                          <li
                            key={it.id}
                            draggable={editable}
                            onDragStart={(e) => {
                              setDragId(it.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(e) => {
                              if (!editable || dragId == null) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropTarget({ day, index: e.clientY < rect.top + rect.height / 2 ? idx : idx + 1 });
                            }}
                            className={cn(
                              "group relative flex gap-3 px-3 py-3 transition-colors",
                              dragId === it.id && "opacity-40",
                              dropTarget?.day === day && dropTarget.index === idx && "shadow-[inset_0_3px_0_var(--color-brand-500)]",
                              dropTarget?.day === day && dropTarget.index === idx + 1 && idx === list.length - 1 && "shadow-[inset_0_-3px_0_var(--color-brand-500)]"
                            )}
                          >
                            {editable && <GripVertical className="no-print mt-1 size-4 shrink-0 cursor-grab text-muted opacity-40 group-hover:opacity-100" aria-hidden />}
                            {it.place ? (
                              <SmartImage image={it.place.image} alt="" width={330} className="size-16 shrink-0 rounded-xl" />
                            ) : (
                              <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                                <StickyNote className="size-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              {leg != null && leg > 0.05 && (
                                <div className="mb-1 text-[11px] text-muted">
                                  ↳ {leg < 1 ? `${Math.round(leg * 1000)} m` : `${leg.toFixed(1)} km`} from previous stop
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                {editable ? (
                                  <input
                                    type="time"
                                    defaultValue={it.startTime || ""}
                                    onBlur={(e) => e.target.value !== (it.startTime || "") && updateItem(it.id, { startTime: e.target.value || null })}
                                    className="rounded border border-transparent bg-transparent font-semibold text-ink hover:border-line focus:border-line"
                                    aria-label="Start time"
                                  />
                                ) : (
                                  <span className="font-semibold text-ink">{it.startTime || "Anytime"}</span>
                                )}
                                <span>· {formatDuration(it.durationMin)}</span>
                                {it.costUsd > 0 && <span>· ~{formatUsd(it.costUsd)}</span>}
                                {it.place && <span>· {TYPE_LABELS[it.place.type as PlaceType].singular}</span>}
                              </div>
                              {it.place ? (
                                <Link href={`/place/${it.place.slug}`} className="block truncate font-semibold hover:text-brand-700">
                                  {it.title}
                                </Link>
                              ) : editable ? (
                                <input defaultValue={it.title} onBlur={(e) => e.target.value !== it.title && updateItem(it.id, { title: e.target.value })} className="w-full bg-transparent font-semibold outline-none" aria-label="Title" />
                              ) : (
                                <div className="font-semibold">{it.title}</div>
                              )}
                              {editable ? (
                                <textarea
                                  defaultValue={it.note}
                                  onBlur={(e) => e.target.value !== it.note && updateItem(it.id, { note: e.target.value })}
                                  rows={it.note ? 2 : 1}
                                  placeholder="Add a note…"
                                  className="mt-0.5 w-full resize-none rounded bg-transparent text-sm text-ink-2 outline-none placeholder:text-muted/60 focus:bg-surface-2"
                                />
                              ) : (
                                it.note && <p className="mt-0.5 text-sm text-ink-2">{it.note}</p>
                              )}
                            </div>
                            {editable && (
                              <div className="no-print flex shrink-0 flex-col items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <button onClick={() => idx > 0 && moveItem(it.id, day, idx - 1)} className="rounded p-1 hover:bg-surface-2" aria-label="Move up" disabled={idx === 0}>
                                  <ArrowUp className="size-3.5" />
                                </button>
                                <select
                                  value={day}
                                  onChange={(e) => moveItem(it.id, Number(e.target.value), 999)}
                                  className="w-12 rounded border border-line bg-surface text-[10px]"
                                  aria-label="Move to day"
                                  title="Move to another day"
                                >
                                  {Array.from({ length: trip.days }, (_, i) => (
                                    <option key={i} value={i + 1}>
                                      D{i + 1}
                                    </option>
                                  ))}
                                </select>
                                <button onClick={() => idx < list.length - 1 && moveItem(it.id, day, idx + 2)} className="rounded p-1 hover:bg-surface-2" aria-label="Move down" disabled={idx === list.length - 1}>
                                  <ArrowDown className="size-3.5" />
                                </button>
                                <button onClick={() => removeItem(it.id)} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-coral-600" aria-label="Remove">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
            <aside className="hidden xl:block">
              <div className="sticky top-24 space-y-4">
                <LazyMap markers={allMarkers} polylines={polylines} className="h-[420px]" />
                <div className="card p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Estimated total</span>
                    <span className="font-display text-xl font-semibold">{formatUsd(totals.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Lodging + activities + meals in this plan, excluding flights.</p>
                </div>
                {trip.aiSummary && (
                  <div className="ai-border p-4 text-sm">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="size-3.5 text-coral-500" /> AI trip summary
                    </div>
                    <p className="text-ink-2">{trip.aiSummary}</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {tab === "map" && <LazyMap markers={allMarkers} polylines={polylines} className="h-[70vh]" scrollWheelZoom />}

        {tab === "book" && <BookTab trip={trip} bookings={bookings} editable={editable} />}

        {tab === "packing" && <PackingTab trip={trip} editable={editable} onChange={(packing) => setTrip((t) => ({ ...t, packing }))} />}

        {tab === "budget" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <div className="text-sm text-muted">Estimated trip cost</div>
              <div className="font-display text-4xl font-semibold">{formatUsd(totals.total)}</div>
              <div className="text-sm text-muted">
                {formatUsd(Math.round(totals.total / trip.travelers))} per person · {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Lodging ({Math.max(1, trip.days - 1)} nights)</span>
                  <span className="font-semibold">{formatUsd(totals.lodging)}</span>
                </div>
                {totals.byDay.map((d) => (
                  <div key={d.day} className="flex justify-between">
                    <span className="text-muted">Day {d.day} activities & meals</span>
                    <span className="font-semibold">{formatUsd(d.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
            {destination && (
              <div className="card p-5 text-sm">
                <div className="font-semibold">Reality check for {destination.name}</div>
                <p className="mt-1 text-muted">Typical all-in daily spend per person (incl. lodging):</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {(["budget", "midrange", "luxury"] as const).map((b) => (
                    <div key={b} className={cn("rounded-xl p-3", trip.budget === b ? "bg-brand-50 ring-1 ring-brand-400 dark:bg-brand-950" : "bg-surface-2")}>
                      <div className="text-xs capitalize text-muted">{b === "midrange" ? "Mid-range" : b}</div>
                      <div className="font-display text-lg font-semibold">{formatUsd(destination.dailyBudget[b])}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-muted">
                  At your {trip.budget === "midrange" ? "mid-range" : trip.budget} style, a {trip.days}-day trip for {trip.travelers} typically costs around{" "}
                  <strong className="text-ink">{formatUsd(destination.dailyBudget[trip.budget] * trip.days * trip.travelers)}</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "notes" && (
          <div className="card max-w-3xl p-5">
            {editable ? (
              <textarea
                defaultValue={trip.notes}
                onBlur={(e) => e.target.value !== trip.notes && patchTrip({ notes: e.target.value })}
                rows={16}
                placeholder="Flight numbers, confirmation codes, ideas…"
                className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
                aria-label="Trip notes"
              />
            ) : trip.notes ? (
              <Markdown text={trip.notes} className="text-sm" />
            ) : (
              <p className="text-sm text-muted">No notes.</p>
            )}
          </div>
        )}
      </div>

      {adding != null && destination && <AddPlaceModal tripId={trip.id} day={adding} destinationSlug={destination.slug} destinationName={destination.name} onClose={() => setAdding(null)} onAdded={(t) => setTrip(t)} />}
      {adding != null && !destination && <AddNoteModal tripId={trip.id} day={adding} onClose={() => setAdding(null)} onAdded={(t) => setTrip(t)} />}
    </div>
  );
}

function AddPlaceModal({
  tripId,
  day,
  destinationSlug,
  destinationName,
  onClose,
  onAdded,
}: {
  tripId: number;
  day: number;
  destinationSlug: string;
  destinationName: string;
  onClose: () => void;
  onAdded: (t: Trip) => void;
}) {
  const { toast } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState<PlaceType | "">("");
  const [items, setItems] = useState<PlaceCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/places/search?destination=${destinationSlug}${type ? `&type=${type}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}&limit=20`)
        .then((r) => r.json())
        .then((j) => setItems(j.items || []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, type, destinationSlug]);

  const add = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/trips/${tripId}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day, ...body }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Couldn't add", "error");
    onAdded(j.trip);
    toast(`Added to Day ${day}`);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col p-5 animate-fade-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            Add to Day {day} · {destinationName}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sights, restaurants, tours…" className="input pl-9" autoFocus />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["", "attraction", "restaurant", "experience", "hotel"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className="chip text-xs" data-active={type === t}>
              {t ? TYPE_LABELS[t].plural : "All"}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-40 flex-1 overflow-y-auto">
          {loading && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted" />}
          {!loading &&
            items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                <SmartImage image={p.image} alt="" width={330} className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {p.category} · ★ {p.rating.toFixed(1)}
                  </div>
                </div>
                <button onClick={() => add({ placeId: p.id })} className="btn btn-outline btn-sm">
                  <CalendarPlus className="size-3.5" /> Add
                </button>
              </div>
            ))}
        </div>
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="…or add a custom item (e.g. Flight to Rome 14:05)" className="input py-2 text-sm" />
          <button
            onClick={() => {
              if (note.trim()) {
                add({ title: note.trim(), kind: "note", durationMin: 60 });
                setNote("");
              }
            }}
            className="btn btn-dark btn-sm"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ tripId, day, onClose, onAdded }: { tripId: number; day: number; onClose: () => void; onAdded: (t: Trip) => void }) {
  const [title, setTitle] = useState("");
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-semibold">Add to Day {day}</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening?" className="input" autoFocus />
        <button
          onClick={async () => {
            const r = await fetch(`/api/trips/${tripId}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day, title, kind: "note" }) });
            if (r.ok) onAdded((await r.json()).trip);
            onClose();
          }}
          className="btn btn-primary w-full"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function PackingTab({ trip, editable, onChange }: { trip: Trip; editable: boolean; onChange: (p: PackingList) => void }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const list = trip.packing;

  const persist = async (next: PackingList) => {
    onChange(next);
    if (editable) await fetch(`/api/trips/${trip.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ packing: next }) });
  };

  const generate = async () => {
    setBusy(true);
    const r = await fetch("/api/ai/packing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId: trip.id }) });
    setBusy(false);
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Couldn't build a packing list", "error");
    onChange(j.packing);
    toast("Packing list ready — tailored to the weather and your plans");
  };

  if (!list) {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <ListChecks className="size-10 text-brand-600" />
        <h3 className="mt-3 font-display text-2xl font-semibold">Smart packing list</h3>
        <p className="mt-1 max-w-md text-sm text-muted">Built from the destination&apos;s climate for your travel month, trip length, activities, local customs and plug type.</p>
        {editable ? (
          <button onClick={generate} disabled={busy} className="btn btn-primary mt-5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate packing list
          </button>
        ) : (
          <p className="mt-4 text-sm text-muted">The owner hasn&apos;t generated one yet.</p>
        )}
      </div>
    );
  }

  const total = list.categories.reduce((s, c) => s + c.items.length, 0);
  const done = list.categories.reduce((s, c) => s + c.items.filter((i) => i.checked).length, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {done} of {total} packed
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
        {editable && (
          <>
            <div className="flex gap-2">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add an item" className="input py-2 text-sm" />
              <button
                onClick={() => {
                  if (!custom.trim()) return;
                  const next = structuredClone(list);
                  const cat = next.categories.find((c) => c.name === "My items") || (next.categories.push({ name: "My items", items: [] }), next.categories[next.categories.length - 1]);
                  cat.items.push({ name: custom.trim(), checked: false });
                  setCustom("");
                  persist(next);
                }}
                className="btn btn-dark btn-sm"
              >
                Add
              </button>
            </div>
            <button onClick={generate} className="btn btn-outline btn-sm">
              <Sparkles className="size-3.5" /> Regenerate
            </button>
          </>
        )}
      </div>
      <div className="columns-1 gap-5 md:columns-2 lg:columns-3">
        {list.categories.map((c, ci) => (
          <div key={c.name} className="card mb-5 break-inside-avoid p-4">
            <div className="mb-2 font-semibold">{c.name}</div>
            <ul className="space-y-1">
              {c.items.map((i, ii) => (
                <li key={ii}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={i.checked}
                      disabled={!editable}
                      onChange={() => {
                        const next = structuredClone(list);
                        next.categories[ci].items[ii].checked = !i.checked;
                        persist(next);
                      }}
                      className="mt-0.5 size-4 accent-brand-600"
                    />
                    <span className={cn("text-sm", i.checked && "text-muted line-through")}>
                      {i.name}
                      {i.reason && <span className="block text-xs text-muted">{i.reason}</span>}
                    </span>
                    {i.checked && <Check className="ml-auto size-3.5 text-brand-600" />}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Ready to book" checklist: every bookable stop in the plan, with its booking status. */
function BookTab({ trip, bookings, editable }: { trip: Trip; bookings: TripBooking[]; editable: boolean }) {
  const seen = new Set<number>();
  const stops = [...trip.items]
    .sort((a, b) => a.day - b.day || a.position - b.position)
    .filter((i) => i.place && (i.place.type === "hotel" || i.place.type === "experience" || i.place.type === "restaurant" || (i.place.type === "attraction" && i.place.priceUsd > 0)))
    .filter((i) => (seen.has(i.place!.id) ? false : (seen.add(i.place!.id), true)));
  const booked = (placeId: number) => bookings.find((b) => b.placeId === placeId);
  const bookable = stops.filter((s) => s.place!.type !== "hotel");
  const done = bookable.filter((s) => booked(s.place!.id)).length;
  return (
    <div className="max-w-3xl">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Ready to book</div>
            <p className="text-sm text-muted">
              {bookable.length ? `${done} of ${bookable.length} tours, tickets and tables booked.` : "No bookable tours, tickets or tables in this plan yet."} Popular slots sell out — book the
              ones you care about first.
            </p>
          </div>
          {bookable.length > 0 && (
            <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(done / bookable.length) * 100}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {stops.map((s) => {
          const p = s.place!;
          const b = booked(p.id);
          const isHotel = p.type === "hotel";
          return (
            <div key={s.id} className="card flex items-center gap-3 p-3">
              <SmartImage image={p.image} alt={p.name} width={330} className="size-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted">
                  {isHotel ? "Where you're staying" : `Day ${s.day}${s.startTime ? ` · ${s.startTime}` : ""}`} · {p.category}
                </div>
              </div>
              {b ? (
                <Link href={`/bookings/${b.ref}`} className="badge bg-brand-50 px-2.5 py-1.5 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <Check className="size-3.5" /> Booked · {b.ref}
                </Link>
              ) : isHotel ? (
                <Link href={`/place/${p.slug}#prices`} className="btn btn-outline btn-sm">
                  Compare prices
                </Link>
              ) : editable ? (
                <Link href={`/place/${p.slug}#book`} className="btn btn-primary btn-sm">
                  {p.type === "restaurant" ? "Reserve" : "Book"}
                </Link>
              ) : (
                <Link href={`/place/${p.slug}`} className="btn btn-ghost btn-sm">
                  View
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Wayfarer earns a commission from venues and booking partners — it never changes what the planner recommends. <Link href="/how-we-make-money" className="underline">How we make money</Link>
      </p>
    </div>
  );
}
