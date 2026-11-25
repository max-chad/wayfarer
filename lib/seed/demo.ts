import type Database from "better-sqlite3";
import { planItinerary, type PlannerDestination, type PlannerPlace } from "../ai/local/planner";
import { insertTripFromItinerary } from "../data/trip-writer";
import type { PlanRequest } from "../types";
import type { Rng } from "../utils";

type DB = Database.Database;

export function loadPlannerData(conn: DB, slug: string): { dest: PlannerDestination & { id: number }; places: PlannerPlace[] } | null {
  const d = conn.prepare("SELECT id, slug, name, lat, lng, info FROM destinations WHERE slug = ?").get(slug) as
    | { id: number; slug: string; name: string; lat: number; lng: number; info: string }
    | undefined;
  if (!d) return null;
  const rows = conn
    .prepare(
      "SELECT id, name, type, category, lat, lng, rating, review_count, price_level, price_usd, tags, details, neighborhood FROM places WHERE destination_id = ?"
    )
    .all(d.id) as {
    id: number;
    name: string;
    type: PlannerPlace["type"];
    category: string;
    lat: number;
    lng: number;
    rating: number;
    review_count: number;
    price_level: number;
    price_usd: number;
    tags: string;
    details: string;
    neighborhood: string;
  }[];
  return {
    dest: { id: d.id, slug: d.slug, name: d.name, lat: d.lat, lng: d.lng, info: JSON.parse(d.info) },
    places: rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      category: r.category,
      lat: r.lat,
      lng: r.lng,
      rating: r.rating,
      reviewCount: r.review_count,
      priceLevel: r.price_level,
      priceUsd: r.price_usd,
      tags: JSON.parse(r.tags),
      details: JSON.parse(r.details),
      neighborhood: r.neighborhood,
    })),
  };
}

export function seedDemoContent(conn: DB, R: Rng) {
  const demo = conn.prepare("SELECT id FROM users WHERE username = 'demo'").get() as { id: number } | undefined;
  if (!demo) return;

  // Saved places: a few top-rated spots across popular cities
  const saves = conn
    .prepare(
      `SELECT p.id FROM places p JOIN destinations d ON d.id = p.destination_id
       WHERE d.slug IN ('paris','tokyo','lisbon','kyoto','barcelona','rome') AND p.review_count > 0
       ORDER BY p.rating DESC LIMIT 40`
    )
    .all() as { id: number }[];
  const insSave = conn.prepare("INSERT OR IGNORE INTO saves (user_id, place_id, created_at) VALUES (?, ?, datetime('now', ?))");
  for (const s of R.sample(saves, Math.min(9, saves.length))) insSave.run(demo.id, s.id, `-${R.int(1, 60)} days`);

  // Trips built by the local planner
  const today = new Date();
  const inDays = (n: number) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  const plans: { slug: string; req: Omit<PlanRequest, "destinationSlug">; title: string; isPublic?: boolean }[] = [
    {
      slug: "paris",
      title: "Paris long weekend 🥐",
      isPublic: true,
      req: { days: 4, travelers: 2, budget: "midrange", pace: "balanced", interests: ["art", "food", "romantic"], tripType: "couples", startDate: inDays(24) },
    },
    {
      slug: "tokyo",
      title: "Tokyo & neon nights",
      req: { days: 5, travelers: 2, budget: "midrange", pace: "packed", interests: ["food", "culture", "nightlife"], tripType: "friends", startDate: inDays(75) },
    },
    {
      slug: "lisbon",
      title: "Slow days in Lisbon",
      req: { days: 3, travelers: 1, budget: "budget", pace: "relaxed", interests: ["history", "food", "photography"], tripType: "solo", startDate: null },
    },
  ];
  for (const p of plans) {
    const data = loadPlannerData(conn, p.slug);
    if (!data || !data.places.length) continue;
    const req: PlanRequest = { destinationSlug: p.slug, ...p.req };
    const it = planItinerary(req, data.dest, data.places);
    insertTripFromItinerary(conn, demo.id, data.dest.id, req, it, { title: p.title, isPublic: p.isPublic });
  }
}
