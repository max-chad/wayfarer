"use client";

import { ArrowLeftRight, Clock, Leaf, Loader2, Luggage, Plane, Plug, Sparkles, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { flightEstimate } from "@/lib/geo";
import type { PackingList } from "@/lib/types";
import { cn, MONTHS } from "@/lib/utils";

interface D {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  currency: { code: string; symbol: string; name: string };
  plug: string;
  voltage: string;
  tipping: string;
}

const TABS = [
  ["currency", "Currency", Wallet],
  ["clock", "World clock", Clock],
  ["packing", "Packing list", Luggage],
  ["carbon", "Flight CO₂", Leaf],
  ["plugs", "Plugs & tipping", Plug],
] as const;

export function TravelTools({ destinations, cities }: { destinations: D[]; cities: { name: string; lat: number; lng: number }[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("currency");
  return (
    <div className="container-page pt-10">
      <h1 className="font-display text-4xl font-semibold">Travel tools</h1>
      <p className="mt-1 text-muted">Handy utilities, wired into live data for all {destinations.length} destinations.</p>
      <div className="scrollbar-none mt-6 flex gap-1.5 overflow-x-auto">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className="chip shrink-0" data-active={tab === k}>
            <Icon className="size-4" /> {l}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "currency" && <CurrencyTool destinations={destinations} />}
        {tab === "clock" && <ClockTool destinations={destinations} />}
        {tab === "packing" && <PackingTool destinations={destinations} />}
        {tab === "carbon" && <CarbonTool destinations={destinations} cities={cities} />}
        {tab === "plugs" && <PlugsTool destinations={destinations} />}
      </div>
    </div>
  );
}

function CurrencyTool({ destinations }: { destinations: D[] }) {
  const codes = useMemo(() => [...new Set(["USD", "EUR", "GBP", ...destinations.map((d) => d.currency.code)])].sort(), [destinations]);
  const [amount, setAmount] = useState(100);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [res, setRes] = useState<{ result: number; rate: number; source: string; updated: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/currency?from=${from}&to=${to}&amount=${amount || 0}`)
        .then((r) => r.json())
        .then(setRes);
    }, 200);
    return () => clearTimeout(t);
  }, [amount, from, to]);
  const quick = [10, 50, 100, 500];
  return (
    <div className="card max-w-2xl p-6">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label className="label">Amount</label>
          <div className="flex gap-2">
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" min={0} />
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input w-28" aria-label="From currency">
              {codes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => (setFrom(to), setTo(from))} className="btn btn-outline btn-icon mb-1 justify-self-center" aria-label="Swap currencies">
          <ArrowLeftRight className="size-4" />
        </button>
        <div>
          <label className="label">Converted</label>
          <div className="flex gap-2">
            <div className="input flex items-center font-semibold">{res ? res.result.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "…"}</div>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="input w-28" aria-label="To currency">
              {codes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {res && (
        <p className="mt-4 text-sm text-muted">
          1 {from} = {res.rate} {to} · {res.source === "live" ? `live rate, updated ${res.updated}` : "offline reference rate"}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {res &&
          quick.map((q) => (
            <span key={q} className="rounded-lg bg-surface-2 px-3 py-1.5">
              {q} {from} = <strong>{(q * res.rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> {to}
            </span>
          ))}
      </div>
    </div>
  );
}

function ClockTool({ destinations }: { destinations: D[] }) {
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<string[]>(["new-york", "london", "tokyo", "sydney"]);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hourOf = (tz: string) => (now ? Number(now.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false })) : 12);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {picked.map((slug) => {
          const d = destinations.find((x) => x.slug === slug);
          if (!d) return null;
          const h = hourOf(d.timezone);
          const day = h >= 7 && h < 19;
          return (
            <div key={slug} className={cn("rounded-2xl p-5 text-white shadow-lift", day ? "bg-gradient-to-br from-sky-400 to-brand-600" : "bg-gradient-to-br from-indigo-900 to-slate-900")}>
              <div className="flex items-center justify-between text-sm opacity-90">
                {d.name}
                <button onClick={() => setPicked((p) => p.filter((x) => x !== slug))} className="text-xs opacity-70 hover:opacity-100" aria-label={`Remove ${d.name}`}>
                  ✕
                </button>
              </div>
              <div className="mt-2 font-display text-4xl font-semibold tabular-nums">{now ? now.toLocaleTimeString("en-GB", { timeZone: d.timezone, hour: "2-digit", minute: "2-digit" }) : "--:--"}</div>
              <div className="text-xs opacity-80">{now ? now.toLocaleDateString("en-GB", { timeZone: d.timezone, weekday: "long", day: "numeric", month: "short" }) : ""}</div>
              <div className="mt-2 text-xs opacity-80">{day ? "☀️ Daytime" : "🌙 Night"} · {h >= 9 && h < 18 ? "good time to call" : "probably asleep or off-work"}</div>
            </div>
          );
        })}
      </div>
      <select
        onChange={(e) => {
          if (e.target.value && !picked.includes(e.target.value)) setPicked((p) => [...p, e.target.value]);
          e.target.value = "";
        }}
        className="input max-w-xs"
        defaultValue=""
        aria-label="Add a city"
      >
        <option value="">+ Add a city…</option>
        {destinations.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function PackingTool({ destinations }: { destinations: D[] }) {
  const [dest, setDest] = useState("reykjavik");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [days, setDays] = useState(5);
  const [interests, setInterests] = useState<string[]>(["nature"]);
  const [list, setList] = useState<PackingList | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const go = async () => {
    setBusy(true);
    const r = await fetch("/api/ai/packing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destinationSlug: dest, month, days, interests, tripType: "couples" }) });
    setList((await r.json()).packing);
    setChecked(new Set());
    setBusy(false);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="card h-fit space-y-4 p-5">
        <div>
          <label className="label">Destination</label>
          <select value={dest} onChange={(e) => setDest(e.target.value)} className="input">
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Days</label>
            <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className="input" />
          </div>
        </div>
        <div>
          <div className="label">Activities</div>
          <div className="flex flex-wrap gap-1.5">
            {["beach", "hiking", "nature", "nightlife", "food", "photography", "wellness", "adventure"].map((i) => (
              <button key={i} onClick={() => setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))} className="chip text-xs capitalize" data-active={interests.includes(i)}>
                {i}
              </button>
            ))}
          </div>
        </div>
        <button onClick={go} disabled={busy} className="btn btn-primary w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Build my list
        </button>
      </div>
      <div>
        {!list ? (
          <div className="card grid h-60 place-items-center text-sm text-muted">Your climate-aware packing list will appear here.</div>
        ) : (
          <div className="columns-1 gap-4 md:columns-2">
            {list.categories.map((c) => (
              <div key={c.name} className="card mb-4 break-inside-avoid p-4">
                <div className="mb-2 font-semibold">{c.name}</div>
                {c.items.map((i) => {
                  const k = `${c.name}:${i.name}`;
                  return (
                    <label key={k} className="flex cursor-pointer items-start gap-2 rounded-lg p-1 text-sm hover:bg-surface-2">
                      <input type="checkbox" checked={checked.has(k)} onChange={() => setChecked((s) => (s.has(k) ? (s.delete(k), new Set(s)) : new Set(s.add(k))))} className="mt-0.5 accent-brand-600" />
                      <span className={checked.has(k) ? "text-muted line-through" : ""}>
                        {i.name}
                        {i.reason && <span className="block text-xs text-muted">{i.reason}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CarbonTool({ destinations, cities }: { destinations: D[]; cities: { name: string; lat: number; lng: number }[] }) {
  const [from, setFrom] = useState(cities[0].name);
  const [to, setTo] = useState("tokyo");
  const [pax, setPax] = useState(1);
  const [ret, setRet] = useState(true);
  const a = cities.find((c) => c.name === from)!;
  const b = destinations.find((d) => d.slug === to)!;
  const f = flightEstimate(a, b);
  const mult = pax * (ret ? 2 : 1);
  const kg = f.co2Kg * mult;
  const comparisons = [
    ["🚗", "km driven in an average car", Math.round(kg / 0.17)],
    ["🥩", "beef burgers", Math.round(kg / 3)],
    ["💡", "days of an average EU home's electricity", Math.round(kg / 6)],
  ];
  return (
    <div className="card max-w-3xl p-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="input">
            {cities.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="input">
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Travelers</label>
          <input type="number" min={1} max={12} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value)))} className="input" />
        </div>
        <label className="flex items-end gap-2 pb-3 text-sm">
          <input type="checkbox" checked={ret} onChange={(e) => setRet(e.target.checked)} className="accent-brand-600" /> Return trip
        </label>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-2 p-4">
          <Plane className="size-5 text-brand-600" />
          <div className="mt-1 font-display text-2xl font-semibold">{(f.km * (ret ? 2 : 1)).toLocaleString("en-US")} km</div>
          <div className="text-xs text-muted">≈ {f.hours} h each way</div>
        </div>
        <div className="rounded-2xl bg-green-50 p-4 dark:bg-green-950/40">
          <Leaf className="size-5 text-green-600" />
          <div className="mt-1 font-display text-2xl font-semibold">{kg.toLocaleString("en-US")} kg CO₂</div>
          <div className="text-xs text-muted">economy, excl. non-CO₂ effects</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <span className="text-xl">🌳</span>
          <div className="mt-1 font-display text-2xl font-semibold">{f.treesToOffset * mult} trees</div>
          <div className="text-xs text-muted">absorbing CO₂ for a year</div>
        </div>
      </div>
      <div className="mt-4 text-sm text-muted">
        That&apos;s about the same as{" "}
        {comparisons.map(([e, l, n], i) => (
          <span key={l as string}>
            {e} <strong className="text-ink">{(n as number).toLocaleString("en-US")}</strong> {l}
            {i < comparisons.length - 1 ? ", " : "."}
          </span>
        ))}
        {f.trainViable && " Under 800 km each way — the train is usually the lowest-carbon option."}
      </div>
    </div>
  );
}

function PlugsTool({ destinations }: { destinations: D[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Plug</th>
            <th className="px-4 py-3">Voltage</th>
            <th className="px-4 py-3">Currency</th>
            <th className="px-4 py-3">Tipping</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((d) => (
            <tr key={d.slug} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-semibold">
                {d.name} <span className="font-normal text-muted">{d.country}</span>
              </td>
              <td className="px-4 py-3">{d.plug}</td>
              <td className="px-4 py-3">{d.voltage}</td>
              <td className="px-4 py-3">
                {d.currency.symbol} {d.currency.code}
              </td>
              <td className="px-4 py-3 text-muted">{d.tipping}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
