import { db } from "../db";
import { haversineKm } from "../geo";
import type { Place, PlaceCardData, PlaceType } from "../types";
import { PLACE_SELECT, toCard, toPlace, type PlaceRow } from "./mappers";

export function getPlace(slug: string): Place | null {
  const row = db().prepare(`${PLACE_SELECT} WHERE p.slug = ?`).get(slug) as PlaceRow | undefined;
  return row ? toPlace(row) : null;
}

export function getPlaceById(id: number): Place | null {
  const row = db().prepare(`${PLACE_SELECT} WHERE p.id = ?`).get(id) as PlaceRow | undefined;
  return row ? toPlace(row) : null;
}

export function getPlacesByIds(ids: number[]): PlaceCardData[] {
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!clean.length) return [];
  const rows = db().prepare(`${PLACE_SELECT} WHERE p.id IN (${clean.map(() => "?").join(",")})`).all(...clean) as PlaceRow[];
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return clean.map((id) => byId.get(id)).filter(Boolean) as PlaceCardData[];
}

export interface PlaceFilter {
  destinationId?: number;
  destinationSlug?: string;
  type?: PlaceType;
  types?: PlaceType[];
  minRating?: number;
  priceLevels?: number[];
  tags?: string[];
  amenities?: string[];
  category?: string;
  q?: string;
  award?: string;
  sort?: "ranking" | "rating" | "reviews" | "price_asc" | "price_desc" | "name" | "distance" | "relevance";
  near?: { lat: number; lng: number };
  maxKm?: number;
  limit?: number;
  offset?: number;
}

/** Converts free text into an FTS5 prefix query. */
export function ftsQuery(q: string) {
  const terms = q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .slice(0, 8);
  return terms.map((t) => `"${t}"*`).join(" ");
}

const STOP = new Set(["the", "and", "for", "with", "in", "of", "a", "an", "to", "at", "on", "near", "best", "top", "good", "great", "place", "places"]);

export function listPlaces(filter: PlaceFilter = {}): { items: PlaceCardData[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.destinationId) {
    where.push("p.destination_id = ?");
    params.push(filter.destinationId);
  }
  if (filter.destinationSlug) {
    where.push("d.slug = ?");
    params.push(filter.destinationSlug);
  }
  if (filter.type) {
    where.push("p.type = ?");
    params.push(filter.type);
  }
  if (filter.types?.length) {
    where.push(`p.type IN (${filter.types.map(() => "?").join(",")})`);
    params.push(...filter.types);
  }
  if (filter.minRating) {
    where.push("p.rating >= ?");
    params.push(filter.minRating);
  }
  if (filter.priceLevels?.length) {
    where.push(`p.price_level IN (${filter.priceLevels.map(() => "?").join(",")})`);
    params.push(...filter.priceLevels);
  }
  for (const t of filter.tags || []) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.tags) WHERE value = ?)");
    params.push(t);
  }
  for (const a of filter.amenities || []) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.amenities) WHERE value = ?)");
    params.push(a);
  }
  if (filter.category) {
    where.push("p.category LIKE ?");
    params.push(`%${filter.category}%`);
  }
  if (filter.award) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.awards) WHERE value = ?)");
    params.push(filter.award);
  }
  if (filter.q?.trim()) {
    const fts = ftsQuery(filter.q);
    if (fts) {
      where.push("p.id IN (SELECT rowid FROM places_fts WHERE places_fts MATCH ?)");
      params.push(fts);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order =
    {
      ranking: "p.ranking ASC, p.rating DESC",
      rating: "p.rating DESC, p.review_count DESC",
      reviews: "p.review_count DESC",
      price_asc: "p.price_usd ASC, p.price_level ASC",
      price_desc: "p.price_usd DESC",
      name: "p.name ASC",
      distance: "p.id",
      relevance: "p.rating DESC",
    }[filter.sort || "rating"] || "p.rating DESC";

  // Relevance and distance ranking must finish in JS over the full match set, so only the plain
  // filter paths can window in SQL.
  const windowed = !filter.near && filter.sort !== "relevance";
  const limit = filter.limit ?? 200;
  const offset = filter.offset || 0;
  if (windowed) {
    const total = (db().prepare(`SELECT COUNT(*) n FROM places p JOIN destinations d ON d.id = p.destination_id ${whereSql}`).get(...params) as { n: number }).n;
    const rows = db()
      .prepare(`${PLACE_SELECT} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as PlaceRow[];
    return { items: rows.map(toCard), total };
  }

  let rows = db().prepare(`${PLACE_SELECT} ${whereSql} ORDER BY ${order}`).all(...params) as PlaceRow[];
  if (filter.sort === "relevance" && filter.q?.trim()) {
    // exact/prefix name matches first, then BM25 text relevance
    const fts = ftsQuery(filter.q);
    const rank = new Map(
      fts ? (db().prepare("SELECT rowid AS id, bm25(places_fts, 10.0, 3.0, 1.0, 2.0, 1.0, 2.0) AS r FROM places_fts WHERE places_fts MATCH ?").all(fts) as { id: number; r: number }[]).map((x) => [x.id, x.r]) : []
    );
    const q = filter.q.trim().toLowerCase();
    const nameScore = (n: string) => (n.toLowerCase() === q ? 0 : n.toLowerCase().startsWith(q) ? 1 : n.toLowerCase().includes(q) ? 2 : 3);
    rows.sort((a, b) => nameScore(a.name) - nameScore(b.name) || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || b.review_count - a.review_count);
  }
  if (filter.near) {
    rows = rows.map((r) => ({ ...r, distance_km: haversineKm(filter.near!, r) }));
    if (filter.maxKm) rows = rows.filter((r) => (r.distance_km ?? 0) <= filter.maxKm!);
    if (filter.sort === "distance") rows.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  }
  const total = rows.length;
  return { items: rows.slice(offset, offset + limit).map(toCard), total };
}

export function nearbyPlaces(place: { id: number; lat: number; lng: number; destinationId: number }, opts: { type?: PlaceType; limit?: number } = {}) {
  const { items } = listPlaces({ destinationId: place.destinationId, type: opts.type, near: place, sort: "distance" });
  return items.filter((p) => p.id !== place.id).slice(0, opts.limit ?? 6);
}

export function similarPlaces(place: Place, n = 4): PlaceCardData[] {
  const { items } = listPlaces({ destinationId: place.destinationId, type: place.type });
  const tags = new Set(place.tags);
  return items
    .filter((p) => p.id !== place.id)
    .map((p) => ({ p, s: p.tags.filter((t) => tags.has(t)).length + (p.category === place.category ? 1.5 : 0) + p.rating / 5 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.p);
}

export function topPlaces(opts: { type?: PlaceType; award?: string; limit?: number; minReviews?: number; tag?: string } = {}) {
  const { items } = listPlaces({ type: opts.type, award: opts.award, tags: opts.tag ? [opts.tag] : undefined, sort: "rating" });
  return items.filter((p) => p.reviewCount >= (opts.minReviews ?? 5)).slice(0, opts.limit ?? 8);
}

export function mapPoints(filter: { destinationId?: number; types?: PlaceType[] } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.destinationId) {
    where.push("p.destination_id = ?");
    params.push(filter.destinationId);
  }
  if (filter.types?.length) {
    where.push(`p.type IN (${filter.types.map(() => "?").join(",")})`);
    params.push(...filter.types);
  }
  return db()
    .prepare(
      `SELECT p.id, p.slug, p.name, p.type, p.category, p.lat, p.lng, p.rating, p.review_count AS reviewCount, p.price_level AS priceLevel, p.image, d.slug AS destinationSlug, d.name AS destinationName
       FROM places p JOIN destinations d ON d.id = p.destination_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`
    )
    .all(...params) as {
    id: number;
    slug: string;
    name: string;
    type: PlaceType;
    category: string;
    lat: number;
    lng: number;
    rating: number;
    reviewCount: number;
    priceLevel: number;
    image: string | null;
    destinationSlug: string;
    destinationName: string;
  }[];
}

export function placeFacets(destinationId: number, type: PlaceType) {
  const rows = db().prepare("SELECT tags, amenities, category, price_level FROM places WHERE destination_id = ? AND type = ?").all(destinationId, type) as {
    tags: string;
    amenities: string;
    category: string;
    price_level: number;
  }[];
  const count = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
  };
  return {
    tags: count(rows.flatMap((r) => JSON.parse(r.tags) as string[])),
    amenities: count(rows.flatMap((r) => JSON.parse(r.amenities) as string[])),
    categories: count(rows.map((r) => r.category)),
  };
}

export function searchSuggestions(q: string, limit = 8) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return { destinations: [], places: [] };
  const destinations = (
    db()
      .prepare("SELECT slug, name, country, image FROM destinations WHERE lower(name) LIKE ? OR lower(country) LIKE ? ORDER BY popularity DESC LIMIT 5")
      .all(`%${term}%`, `%${term}%`) as { slug: string; name: string; country: string; image: string | null }[]
  ).map((d) => ({ ...d, image: d.image ? (JSON.parse(d.image) as { url: string }).url : null }));
  const fts = ftsQuery(q);
  const places = fts
    ? (
        db()
          .prepare(
            `SELECT p.slug, p.name, p.type, p.category, p.rating, p.image, d.name AS destination
             FROM places p JOIN destinations d ON d.id = p.destination_id
             WHERE p.id IN (SELECT rowid FROM places_fts WHERE places_fts MATCH ? LIMIT 60)
             ORDER BY (lower(p.name) LIKE ?) DESC, p.review_count DESC LIMIT ?`
          )
          .all(fts, `${term}%`, limit) as { slug: string; name: string; type: PlaceType; category: string; rating: number; image: string | null; destination: string }[]
      ).map((p) => ({ ...p, image: p.image ? (JSON.parse(p.image) as { url: string }).url : null }))
    : [];
  return { destinations, places };
}

export function placeCount() {
  return (db().prepare("SELECT COUNT(*) n FROM places").get() as { n: number }).n;
}
