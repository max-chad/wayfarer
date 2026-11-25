"use client";

import { Leaf, Plane, TrainFront } from "lucide-react";
import { useEffect, useState } from "react";
import { flightEstimate } from "@/lib/geo";

export function GettingThere({
  dest,
  cities,
  defaultCity,
  airport,
}: {
  dest: { name: string; lat: number; lng: number };
  cities: { name: string; lat: number; lng: number }[];
  defaultCity?: string | null;
  airport: { code: string; name: string };
}) {
  const [city, setCity] = useState(defaultCity && cities.some((c) => c.name === defaultCity) ? defaultCity : "London, UK");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wf-home-city");
      if (!defaultCity && saved && cities.some((c) => c.name === saved)) setCity(saved);
    } catch {}
  }, [cities, defaultCity]);
  const from = cities.find((c) => c.name === city) || cities[0];
  const f = flightEstimate(from, dest);
  return (
    <div className="card p-5">
      <label className="label" htmlFor="home-city">
        Flying from
      </label>
      <select
        id="home-city"
        className="input"
        value={city || ""}
        onChange={(e) => {
          setCity(e.target.value);
          try {
            localStorage.setItem("wf-home-city", e.target.value);
          } catch {}
        }}
      >
        {cities.map((c) => (
          <option key={c.name}>{c.name}</option>
        ))}
      </select>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <Plane className="mx-auto size-5 text-brand-600" />
          <div className="mt-1 font-display text-xl font-semibold">{f.hours} h</div>
          <div className="text-xs text-muted">{f.km.toLocaleString("en-US")} km</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <Leaf className="mx-auto size-5 text-green-600" />
          <div className="mt-1 font-display text-xl font-semibold">{f.co2Kg} kg</div>
          <div className="text-xs text-muted">CO₂ one-way</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <span className="text-xl">🌳</span>
          <div className="mt-0.5 font-display text-xl font-semibold">{f.treesToOffset}</div>
          <div className="text-xs text-muted">trees / yr to offset</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        Main airport: <strong className="text-ink">{airport.name}</strong> ({airport.code}).{" "}
        {f.trainViable && (
          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
            <TrainFront className="size-3.5" /> Under 800 km — consider the train for ~80% less CO₂.
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted">Great-circle estimate, economy class, excluding radiative forcing.</p>
    </div>
  );
}
