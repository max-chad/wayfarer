"use client";

import { Check, ChevronDown, Dice5, Loader2, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import type { Itinerary, PlaceCardData, PlanRequest, TripType } from "@/lib/types";
import { cn, MONTHS_SHORT, VIBE_EMOJI } from "@/lib/utils";
import { ItineraryView, type PlanWeather } from "./ItineraryView";

interface DestOpt {
  slug: string;
  name: string;
  country: string;
  image: string | null;
  bestMonths: number[];
  vibes: string[];
}

const INTERESTS = ["culture", "history", "art", "food", "nightlife", "nature", "beach", "adventure", "shopping", "architecture", "romantic", "photography", "relaxation", "wellness", "family", "hiking", "wine"];
const TRIP_TYPES: { v: TripType; label: string; emoji: string }[] = [
  { v: "couples", label: "Couple", emoji: "💑" },
  { v: "solo", label: "Solo", emoji: "🎒" },
  { v: "friends", label: "Friends", emoji: "🧑‍🤝‍🧑" },
  { v: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { v: "business", label: "Business", emoji: "💼" },
];
const DIETARY = ["vegetarian", "vegan", "gluten-free", "halal", "kosher"];

export interface PlanResult {
  itinerary: Itinerary;
  places: PlaceCardData[];
  weather: PlanWeather[];
  destination: { slug: string; name: string; lat: number; lng: number; currency: { code: string; symbol: string } };
}

export function Planner({
  destinations,
  initial,
  signedIn,
}: {
  destinations: DestOpt[];
  initial: { destinationSlug: string; days: number; travelers: number; budget: PlanRequest["budget"]; pace: PlanRequest["pace"]; interests: string[]; mustSee: number[]; autostart: boolean };
  signedIn: boolean;
}) {
  const { toast, upgrade, isPlus } = useApp();
  const [quota, setQuota] = useState<{ used: number; limit: number; per: "day" | "month"; plan: string } | null>(null);
  const refreshQuota = useCallback(() => {
    fetch("/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setQuota({ ...j.quotas.plan, plan: j.plan }))
      .catch(() => {});
  }, []);
  useEffect(refreshQuota, [refreshQuota]);
  const [dest, setDest] = useState(initial.destinationSlug);
  const [destOpen, setDestOpen] = useState(!initial.destinationSlug);
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(initial.days);
  const [travelers, setTravelers] = useState(initial.travelers);
  const [tripType, setTripType] = useState<TripType>(initial.travelers === 1 ? "solo" : "couples");
  const [budget, setBudget] = useState(initial.budget);
  const [pace, setPace] = useState(initial.pace);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [mustSee, setMustSee] = useState<number[]>(initial.mustSee);
  const [dietary, setDietary] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [sights, setSights] = useState<PlaceCardData[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [lastReq, setLastReq] = useState<PlanRequest | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const autostarted = useRef(false);

  const selected = destinations.find((d) => d.slug === dest);

  useEffect(() => {
    if (!dest) return setSights([]);
    fetch(`/api/places/search?destination=${dest}&type=attraction&limit=10&sort=ranking`)
      .then((r) => r.json())
      .then((j) => setSights(j.items || []));
  }, [dest]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const generate = useCallback(async () => {
    if (!dest) {
      setDestOpen(true);
      return toast("Pick a destination first", "info");
    }
    const req: PlanRequest = { destinationSlug: dest, days, startDate: startDate || null, travelers, budget, pace, interests, tripType, mustSee, dietary, notes: notes || undefined };
    setBusy(true);
    setResult(null);
    setSteps([]);
    setLastReq(req);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const res = await fetch("/api/ai/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
      if (res.status === 402) {
        const j = await res.json().catch(() => ({}));
        upgrade("plan", j.error);
        return;
      }
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Planner failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l);
          if (ev.type === "status") setSteps((s) => [...s, ev.text]);
          if (ev.type === "result") setResult({ itinerary: ev.itinerary, places: ev.places, weather: ev.weather, destination: ev.destination });
          if (ev.type === "error") throw new Error(ev.message);
        }
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      refreshQuota();
    }
  }, [dest, days, startDate, travelers, budget, pace, interests, tripType, mustSee, dietary, notes, toast, upgrade, refreshQuota]);

  useEffect(() => {
    if (initial.autostart && initial.destinationSlug && !autostarted.current) {
      autostarted.current = true;
      // Drop ?autostart from the URL so a refresh or back-navigation doesn't spend another plan from the quota.
      const url = new URL(window.location.href);
      url.searchParams.delete("autostart");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
      generate();
    }
  }, [initial.autostart, initial.destinationSlug, generate]);

  const surprise = () => {
    const month = startDate ? Number(startDate.slice(5, 7)) : new Date().getMonth() + 1;
    const pool = destinations.filter((d) => d.bestMonths.includes(month));
    const pick = (pool.length ? pool : destinations)[Math.floor(Math.random() * (pool.length || destinations.length))];
    setDest(pick.slug);
    setDestOpen(false);
    toast(`How about ${pick.name}? It's lovely in ${MONTHS_SHORT[month - 1]} ✨`, "info");
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="container-page py-10">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
            <Wand2 className="size-4" /> AI trip planner
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your perfect trip, drafted in seconds</h1>
          <p className="mt-2 max-w-2xl text-muted">Tell us the shape of your trip. We&apos;ll cluster sights by neighbourhood, route each day, book-end it with great meals and check the weather.</p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              {/* destination */}
              <div>
                <div className="label">Where to?</div>
                <button onClick={() => setDestOpen((o) => !o)} className="card flex w-full items-center gap-3 p-3 text-left hover:border-line-strong">
                  {selected?.image ? <img src={selected.image} alt="" className="size-12 rounded-xl object-cover" referrerPolicy="no-referrer" /> : <div className="img-fallback size-12 rounded-xl" />}
                  <div className="flex-1">
                    <div className="font-semibold">{selected ? selected.name : "Choose a destination"}</div>
                    <div className="text-xs text-muted">{selected ? `${selected.country} · best ${selected.bestMonths.map((m) => MONTHS_SHORT[m - 1]).join(", ")}` : `${destinations.length} destinations`}</div>
                  </div>
                  <ChevronDown className={cn("size-5 text-muted transition-transform", destOpen && "rotate-180")} />
                </button>
                {destOpen && (
                  <div className="card mt-2 grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto p-2 sm:grid-cols-3">
                    {destinations.map((d) => (
                      <button
                        key={d.slug}
                        onClick={() => {
                          setDest(d.slug);
                          setDestOpen(false);
                        }}
                        className={cn("flex items-center gap-2 rounded-xl p-1.5 text-left text-sm hover:bg-surface-2", d.slug === dest && "bg-brand-50 ring-1 ring-brand-400 dark:bg-brand-950")}
                      >
                        {d.image ? <img src={d.image} alt="" className="size-9 rounded-lg object-cover" referrerPolicy="no-referrer" /> : <div className="img-fallback size-9 rounded-lg" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{d.name}</span>
                          <span className="block truncate text-[11px] text-muted">{d.country}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={surprise} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
                  <Dice5 className="size-3.5" /> Surprise me with a destination in season
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="start">
                    Start date <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input id="start" type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
                </div>
                <div>
                  <div className="label">Days: {days}</div>
                  <input type="range" min={1} max={14} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-3 w-full accent-brand-600" aria-label="Number of days" />
                </div>
                <div>
                  <div className="label">Travelers</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setTravelers((t) => Math.max(1, t - 1))} className="btn btn-outline btn-icon" aria-label="Fewer travelers">
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center font-semibold">{travelers}</span>
                    <button onClick={() => setTravelers((t) => Math.min(12, t + 1))} className="btn btn-outline btn-icon" aria-label="More travelers">
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="label">Who&apos;s going?</div>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_TYPES.map((t) => (
                    <button key={t.v} onClick={() => setTripType(t.v)} className="chip" data-active={tripType === t.v}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="label">Budget</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["budget", "💸", "Budget"],
                        ["midrange", "🧳", "Mid-range"],
                        ["luxury", "💎", "Luxury"],
                      ] as const
                    ).map(([v, e, l]) => (
                      <button key={v} onClick={() => setBudget(v)} className={cn("rounded-xl border p-2.5 text-center text-xs font-semibold transition-colors", budget === v ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-line-strong")}>
                        <div className="text-lg">{e}</div>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label">Pace</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["relaxed", "🐢", "Relaxed"],
                        ["balanced", "🚶", "Balanced"],
                        ["packed", "⚡", "Packed"],
                      ] as const
                    ).map(([v, e, l]) => (
                      <button key={v} onClick={() => setPace(v)} className={cn("rounded-xl border p-2.5 text-center text-xs font-semibold transition-colors", pace === v ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-line-strong")}>
                        <div className="text-lg">{e}</div>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="label">Interests</div>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS.map((i) => (
                    <button key={i} onClick={() => toggle(interests, i, setInterests)} className="chip capitalize" data-active={interests.includes(i)}>
                      {VIBE_EMOJI[i] || "✨"} {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-5">
                <div className="label">Must-see {selected ? `in ${selected.name}` : ""}</div>
                {!sights.length ? (
                  <p className="text-sm text-muted">Pick a destination to choose must-see sights.</p>
                ) : (
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {sights.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2">
                        <input type="checkbox" checked={mustSee.includes(s.id)} onChange={() => setMustSee((m) => (m.includes(s.id) ? m.filter((x) => x !== s.id) : [...m, s.id]))} className="size-4 accent-brand-600" />
                        {s.image ? <img src={s.image.url.replace("/1280px-", "/330px-")} alt="" className="size-9 rounded-lg object-cover" referrerPolicy="no-referrer" /> : <div className="img-fallback size-9 rounded-lg" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-muted">
                            {s.category} · ★ {s.rating.toFixed(1)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="label">Dietary needs</div>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY.map((d) => (
                    <button key={d} onClick={() => toggle(dietary, d, setDietary)} className="chip text-xs capitalize" data-active={dietary.includes(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="notes">
                  Anything else? <span className="font-normal text-muted">(the AI reads this)</span>
                </label>
                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="e.g. We land at noon on day 1, love jazz bars, want one splurge dinner…" className="input resize-none" />
              </div>
              <button onClick={generate} disabled={busy} className="btn btn-primary btn-lg w-full shadow-lift">
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
                {busy ? "Planning your trip…" : result ? "Regenerate plan" : "Generate my itinerary"}
              </button>
              {quota && !isPlus && quota.plan !== "plus" && (
                <p className="mt-2 text-center text-xs text-muted">
                  {Math.max(0, quota.limit - quota.used)} of {quota.limit} free AI plans left {quota.per === "day" ? "today" : "this month"} ·{" "}
                  <button type="button" onClick={() => upgrade("plan")} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
                    Unlimited with Plus
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div ref={resultRef} className="scroll-mt-20">
        {busy && (
          <div className="container-page py-14">
            <div className="ai-border mx-auto max-w-xl p-6">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-5 animate-pulse text-coral-500" /> Building your {days}-day trip to {selected?.name}
              </div>
              <ol className="mt-4 space-y-2.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm animate-fade-up">
                    {i === steps.length - 1 ? <Loader2 className="size-4 animate-spin text-brand-600" /> : <Check className="size-4 text-brand-600" />}
                    <span className={i === steps.length - 1 ? "" : "text-muted"}>{s}</span>
                  </li>
                ))}
                {!steps.length && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <Loader2 className="size-4 animate-spin text-brand-600" /> Warming up…
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
        {result && lastReq && <ItineraryView result={result} request={lastReq} signedIn={signedIn} onRegenerate={generate} />}
      </div>
    </div>
  );
}
