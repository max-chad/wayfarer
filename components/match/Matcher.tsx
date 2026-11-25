"use client";

import { ArrowLeft, ArrowRight, Compass, Leaf, Loader2, Plane, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { DestinationSummary } from "@/lib/types";
import { cn, formatUsd, MONTHS, VIBE_EMOJI } from "@/lib/utils";

interface Result {
  slug: string;
  score: number;
  reasons: string[];
  warnings: string[];
  flightHours?: number;
  co2Kg?: number;
  estTotalUsd: number;
  destination: DestinationSummary;
}

const VIBES = ["beach", "food", "culture", "history", "nature", "adventure", "nightlife", "romantic", "art", "shopping", "relaxation", "wellness", "hiking", "wine", "architecture", "photography"];

export function Matcher({ cities, defaultCity }: { cities: string[]; defaultCity: string | null }) {
  const [step, setStep] = useState(0);
  const [month, setMonth] = useState(((new Date().getMonth() + 1) % 12) + 1);
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState<"budget" | "midrange" | "luxury">("midrange");
  const [climate, setClimate] = useState<"hot" | "warm" | "mild" | "cool" | "any">("warm");
  const [vibes, setVibes] = useState<string[]>([]);
  const [home, setHome] = useState(defaultCity || "London, UK");
  const [maxFlight, setMaxFlight] = useState<number | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);

  const steps = ["When", "Budget", "Climate", "Vibe", "From", "Deal-breakers"];
  const run = async () => {
    setBusy(true);
    const r = await fetch("/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month, budget, climate, vibes, days, homeCity: home, maxFlightHours: maxFlight, avoid }),
    });
    const j = await r.json();
    setResults(j.results);
    setBusy(false);
  };

  if (results) {
    return (
      <div className="container-page pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
              <Sparkles className="size-4" /> Your matches
            </div>
            <h1 className="mt-1 font-display text-4xl font-semibold">
              {results[0]?.destination.name} is your #1 match for {MONTHS[month - 1]}
            </h1>
            <p className="mt-1 text-muted">
              {days} days · {budget === "midrange" ? "mid-range" : budget} · {climate} weather · from {home}
            </p>
          </div>
          <button onClick={() => (setResults(null), setStep(0))} className="btn btn-outline">
            <RotateCcw className="size-4" /> Start over
          </button>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {results.map((r, i) => (
            <div key={r.slug} className={cn("card flex overflow-hidden", i === 0 && "ai-border lg:col-span-2")}>
              <SmartImage image={r.destination.image} alt={r.destination.name} width={i === 0 ? 960 : 500} className={cn("shrink-0", i === 0 ? "w-2/5 min-h-72" : "w-40 sm:w-52")}>
                <div className="absolute left-3 top-3 grid size-14 place-items-center rounded-full bg-white/95 text-center shadow-lg dark:bg-black/80">
                  <div>
                    <div className="font-display text-lg font-semibold leading-none">{r.score}%</div>
                    <div className="text-[9px] uppercase text-muted">match</div>
                  </div>
                </div>
              </SmartImage>
              <div className="flex min-w-0 flex-1 flex-col p-5">
                <div className="text-xs uppercase tracking-wider text-muted">
                  #{i + 1} · {r.destination.country}
                </div>
                <h2 className="font-display text-2xl font-semibold">{r.destination.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{r.destination.tagline}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {r.reasons.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-brand-600">✓</span>
                      {x}
                    </li>
                  ))}
                  {r.warnings.map((x) => (
                    <li key={x} className="flex gap-2 text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted">
                  <span>≈ {formatUsd(r.estTotalUsd)} pp for {days} days</span>
                  {r.flightHours != null && (
                    <span className="flex items-center gap-1">
                      <Plane className="size-3.5" /> {r.flightHours} h
                    </span>
                  )}
                  {r.co2Kg != null && (
                    <span className="flex items-center gap-1">
                      <Leaf className="size-3.5" /> {r.co2Kg} kg CO₂
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/plan?destination=${r.slug}&days=${Math.min(14, days)}&budget=${budget}&interests=${vibes.join(",")}&autostart=1`} className="btn btn-primary btn-sm">
                    <Sparkles className="size-3.5" /> Plan this trip
                  </Link>
                  <Link href={`/destinations/${r.slug}`} className="btn btn-outline btn-sm">
                    Explore
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl pt-10">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
        <Compass className="size-4" /> Destination matcher
      </div>
      <h1 className="mt-1 font-display text-4xl font-semibold">Find where you should go next</h1>
      <div className="mt-6 flex gap-1.5">
        {steps.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-brand-500" : "bg-surface-3")} aria-label={`Step ${i + 1}: ${s}`} />
        ))}
      </div>
      <div className="card mt-6 min-h-80 p-6 animate-fade-up" key={step}>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          Step {step + 1} of {steps.length}
        </div>
        {step === 0 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">When are you travelling?</h2>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setMonth(i + 1)} className="chip justify-center" data-active={month === i + 1}>
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <div className="label">For how long? {days} days</div>
              <input type="range" min={2} max={21} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full accent-brand-600" aria-label="Trip length" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">What&apos;s your travel style?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["budget", "💸", "Budget", "Hostels, street food, free sights"],
                  ["midrange", "🧳", "Mid-range", "Comfortable hotels, good restaurants"],
                  ["luxury", "💎", "Luxury", "The best stays and tasting menus"],
                ] as const
              ).map(([v, e, l, d]) => (
                <button key={v} onClick={() => setBudget(v)} className={cn("rounded-2xl border p-4 text-left transition-colors", budget === v ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-line-strong")}>
                  <div className="text-2xl">{e}</div>
                  <div className="mt-1 font-semibold">{l}</div>
                  <div className="text-xs text-muted">{d}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">What weather are you after?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              {(
                [
                  ["hot", "🔥", "Hot", "29°C+"],
                  ["warm", "☀️", "Warm", "23–30°C"],
                  ["mild", "🌤️", "Mild", "16–24°C"],
                  ["cool", "🧥", "Cool", "5–17°C"],
                  ["any", "🤷", "Don't mind", ""],
                ] as const
              ).map(([v, e, l, d]) => (
                <button key={v} onClick={() => setClimate(v)} className={cn("rounded-2xl border p-4 text-center transition-colors", climate === v ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-line-strong")}>
                  <div className="text-2xl">{e}</div>
                  <div className="mt-1 font-semibold">{l}</div>
                  <div className="text-xs text-muted">{d}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">What gets you excited? (pick up to 4)</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v}
                  onClick={() => setVibes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : cur.length < 4 ? [...cur, v] : cur))}
                  className="chip px-4 py-2.5 capitalize"
                  data-active={vibes.includes(v)}
                >
                  {VIBE_EMOJI[v]} {v}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">Where are you flying from?</h2>
            <select value={home} onChange={(e) => setHome(e.target.value)} className="input mt-5">
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="mt-6">
              <div className="label">Maximum flight time</div>
              <div className="flex flex-wrap gap-2">
                {[null, 4, 8, 12].map((h) => (
                  <button key={String(h)} onClick={() => setMaxFlight(h)} className="chip" data-active={maxFlight === h}>
                    {h ? `Up to ${h} h` : "Any distance"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h2 className="mt-1 font-display text-2xl font-semibold">Any deal-breakers?</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                ["rain", "🌧 Rainy season"],
                ["crowds", "👥 Big crowds"],
              ].map(([v, l]) => (
                <button key={v} onClick={() => setAvoid((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]))} className="chip px-4 py-2.5" data-active={avoid.includes(v)}>
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted">We&apos;ll score all destinations on season, climate normals, budget, vibe and flight time — then explain every match.</p>
          </>
        )}
      </div>
      <div className="mt-5 flex justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-ghost">
          <ArrowLeft className="size-4" /> Back
        </button>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="btn btn-dark">
            Next <ArrowRight className="size-4" />
          </button>
        ) : (
          <button onClick={run} disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Show my matches
          </button>
        )}
      </div>
    </div>
  );
}
