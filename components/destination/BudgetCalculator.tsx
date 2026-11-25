"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { DestinationInfo } from "@/lib/types";
import { cn, formatUsd } from "@/lib/utils";

export function BudgetCalculator({ info, name }: { info: DestinationInfo; name: string }) {
  const [days, setDays] = useState(5);
  const [people, setPeople] = useState(2);
  const [style, setStyle] = useState<"budget" | "midrange" | "luxury">("midrange");
  const [rate, setRate] = useState<number | null>(null);
  const cur = info.currency;

  useEffect(() => {
    if (cur.code === "USD") return setRate(1);
    fetch(`/api/currency?from=USD&to=${cur.code}&amount=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setRate(j.result))
      .catch(() => {});
  }, [cur.code]);

  const perDay = info.dailyBudgetUSD[style];
  const total = perDay * days * people;
  // rough split of a daily budget
  const split = [
    { label: "Stay", pct: style === "luxury" ? 0.5 : 0.42, color: "bg-violet-500" },
    { label: "Food & drink", pct: 0.28, color: "bg-coral-500" },
    { label: "Activities", pct: style === "budget" ? 0.14 : 0.18, color: "bg-brand-500" },
    { label: "Transport", pct: 0.1, color: "bg-sky-500" },
  ];
  const sum = split.reduce((s, x) => s + x.pct, 0);

  const Stepper = ({ value, set, min, max, label }: { value: number; set: (n: number) => void; min: number; max: number; label: string }) => (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-2">
        <button className="btn btn-outline btn-icon" onClick={() => set(Math.max(min, value - 1))} aria-label={`Fewer ${label}`}>
          <Minus className="size-4" />
        </button>
        <span className="w-8 text-center text-lg font-semibold">{value}</span>
        <button className="btn btn-outline btn-icon" onClick={() => set(Math.min(max, value + 1))} aria-label={`More ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap gap-6">
        <Stepper value={days} set={setDays} min={1} max={30} label="Days" />
        <Stepper value={people} set={setPeople} min={1} max={10} label="Travelers" />
        <div>
          <div className="label">Style</div>
          <div className="flex gap-1.5">
            {(["budget", "midrange", "luxury"] as const).map((s) => (
              <button key={s} onClick={() => setStyle(s)} className="chip capitalize" data-active={style === s}>
                {s === "midrange" ? "Mid-range" : s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">Estimated total for {name}</div>
          <div className="font-display text-4xl font-semibold">{formatUsd(total)}</div>
          {rate && cur.code !== "USD" && (
            <div className="text-sm text-muted">
              ≈ {cur.symbol}
              {Math.round(total * rate).toLocaleString("en-US")} {cur.code}
            </div>
          )}
        </div>
        <div className="text-right text-sm text-muted">
          {formatUsd(perDay)} per person / day
          <br />
          excl. flights
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full">
        {split.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.pct / sum) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {split.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", s.color)} />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto font-semibold">{formatUsd((total * s.pct) / sum)}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center text-sm sm:grid-cols-6">
        {[
          ["☕", "Coffee", info.costs.coffee],
          ["🍽️", "Casual meal", info.costs.meal],
          ["🥂", "Fine dining", info.costs.fineDining],
          ["🍺", "Beer", info.costs.beer],
          ["🚇", "Transit", info.costs.transitTicket],
          ["🏛️", "Museum", info.costs.museum],
        ].map(([e, l, v]) => (
          <div key={l as string} className="rounded-xl bg-surface-2 px-2 py-2.5">
            <div className="text-lg">{e}</div>
            <div className="text-xs text-muted">{l}</div>
            <div className="font-semibold">{formatUsd(v as number)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
