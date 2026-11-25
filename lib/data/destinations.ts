import { db } from "../db";
import type { Destination, DestinationSummary } from "../types";
import { toDestination, toDestinationSummary, type DestinationRow } from "./mappers";

const DEST_SELECT = `
  SELECT d.*,
    (SELECT ROUND(SUM(p.rating * p.review_count) * 1.0 / NULLIF(SUM(p.review_count),0), 2) FROM places p WHERE p.destination_id = d.id) AS avg_rating,
    (SELECT COALESCE(SUM(p.review_count),0) FROM places p WHERE p.destination_id = d.id) AS review_count,
    (SELECT COUNT(*) FROM places p WHERE p.destination_id = d.id) AS place_count
  FROM destinations d`;

export interface DestinationFilter {
  continent?: string;
  vibe?: string;
  month?: number;
  budget?: "budget" | "midrange" | "luxury";
  q?: string;
  sort?: "popular" | "rating" | "name" | "budget" | "warm";
}

export function listDestinations(filter: DestinationFilter = {}): DestinationSummary[] {
  let rows = (db().prepare(`${DEST_SELECT} ORDER BY d.popularity DESC`).all() as DestinationRow[]).map(toDestinationSummary);
  if (filter.continent) rows = rows.filter((d) => d.continent.toLowerCase() === filter.continent!.toLowerCase());
  if (filter.vibe) rows = rows.filter((d) => d.vibes.includes(filter.vibe!));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    rows = rows.filter((d) => `${d.name} ${d.country} ${d.tagline}`.toLowerCase().includes(q));
  }
  if (filter.month) rows = rows.filter((d) => d.bestMonths.includes(filter.month!));
  if (filter.budget) {
    const limit = filter.budget === "budget" ? 110 : filter.budget === "midrange" ? 260 : Infinity;
    rows = rows.filter((d) => d.dailyBudgetUSD.midrange <= limit || filter.budget === "luxury");
  }
  switch (filter.sort) {
    case "rating":
      rows.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "budget":
      rows.sort((a, b) => a.dailyBudgetUSD.midrange - b.dailyBudgetUSD.midrange);
      break;
    case "warm": {
      const m = (filter.month || new Date().getMonth() + 1) - 1;
      rows.sort((a, b) => (b.climate[m]?.tmax ?? 0) - (a.climate[m]?.tmax ?? 0));
      break;
    }
  }
  return rows;
}

export function getDestination(slug: string): Destination | null {
  const row = db().prepare(`${DEST_SELECT} WHERE d.slug = ?`).get(slug) as DestinationRow | undefined;
  return row ? toDestination(row) : null;
}

export function getDestinationById(id: number): Destination | null {
  const row = db().prepare(`${DEST_SELECT} WHERE d.id = ?`).get(id) as DestinationRow | undefined;
  return row ? toDestination(row) : null;
}

export function allDestinationNames() {
  return db().prepare("SELECT id, slug, name, country, lat, lng FROM destinations ORDER BY name").all() as {
    id: number;
    slug: string;
    name: string;
    country: string;
    lat: number;
    lng: number;
  }[];
}

/** Vibe-overlap similarity (Jaccard) with a small continent bonus. */
export function similarDestinations(dest: Pick<Destination, "id" | "vibes" | "continent">, n = 4): DestinationSummary[] {
  const all = listDestinations();
  const v = new Set(dest.vibes);
  return all
    .filter((d) => d.id !== dest.id)
    .map((d) => {
      const inter = d.vibes.filter((x) => v.has(x)).length;
      const union = new Set([...d.vibes, ...dest.vibes]).size || 1;
      return { d, s: inter / union + (d.continent === dest.continent ? 0.08 : 0) };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.d);
}

/** Ranks destinations for a given month using best-months + a comfort score from climate normals. */
export function destinationsForMonth(month: number, n = 8): (DestinationSummary & { monthScore: number; tmax: number; rainyDays: number })[] {
  return listDestinations()
    .map((d) => {
      const c = d.climate[month - 1];
      const tmax = c?.tmax ?? 20;
      const comfort = 1 - Math.min(1, Math.abs(tmax - 25) / 15);
      const dry = 1 - Math.min(1, (c?.rainyDays ?? 8) / 20);
      const best = d.bestMonths.includes(month) ? 1 : 0;
      return { ...d, monthScore: best * 1.4 + comfort + dry * 0.6, tmax, rainyDays: c?.rainyDays ?? 0 };
    })
    .sort((a, b) => b.monthScore - a.monthScore)
    .slice(0, n);
}

export function continents() {
  return (db().prepare("SELECT continent, COUNT(*) n FROM destinations GROUP BY continent ORDER BY n DESC").all() as { continent: string; n: number }[]);
}
