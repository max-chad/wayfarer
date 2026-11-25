import { NextResponse } from "next/server";
import { authenticateApiRequest, type ApiAuth } from "./data/apikeys";
import { destinationToSummary } from "./data/mappers";
import type { Destination, DestinationSummary, ImageRef, PlaceCardData } from "./types";

type OkAuth = Extract<ApiAuth, { ok: true }>;

const ATTRIBUTION =
  "Wayfarer demo data. Landmark descriptions: Wikipedia (CC BY-SA 4.0). Photos: Wikimedia Commons — see each image's author and licence. Weather: Open-Meteo (CC BY 4.0).";

function headers(a: { limit?: number; used?: number }) {
  const h: Record<string, string> = { "cache-control": "no-store" }; // CORS headers come from next.config.ts
  if (a.limit != null) h["x-ratelimit-limit"] = String(a.limit);
  if (a.limit != null && a.used != null) h["x-ratelimit-remaining"] = String(Math.max(0, a.limit - a.used));
  return h;
}

/** Wraps a v1 handler with API-key auth, metering, a consistent envelope and CORS. */
export function apiRoute<C>(fn: (req: Request, auth: OkAuth, ctx: C) => unknown | Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    const auth = authenticateApiRequest(req);
    if (!auth.ok) return NextResponse.json({ error: { status: auth.status, message: auth.error } }, { status: auth.status, headers: headers(auth) });
    try {
      const data = await fn(req, auth, ctx);
      if (data instanceof Response) return data;
      return NextResponse.json({ data, meta: { plan: auth.plan, attribution: ATTRIBUTION } }, { headers: headers(auth) });
    } catch (e) {
      return NextResponse.json({ error: { status: 500, message: (e as Error).message } }, { status: 500, headers: headers(auth) });
    }
  };
}

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

const image = (i: ImageRef | null) => (i ? { url: i.url, author: i.author, license: i.license, source: i.source } : null);

export function apiPlace(p: PlaceCardData, origin: string) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    category: p.category,
    destination: p.destinationSlug,
    neighborhood: p.neighborhood || null,
    location: { lat: p.lat, lng: p.lng },
    rating: p.rating,
    review_count: p.reviewCount,
    ranking: p.ranking ? { position: p.ranking, of: p.rankingTotal } : null,
    price_level: p.priceLevel,
    price_from_usd: p.priceUsd || null,
    tags: p.tags,
    awards: p.awards,
    image: image(p.image),
    url: `${origin}/place/${p.slug}`,
  };
}

export function apiDestinationSummary(d: DestinationSummary, origin: string) {
  return {
    slug: d.slug,
    name: d.name,
    country: d.country,
    country_code: d.countryCode,
    continent: d.continent,
    location: { lat: d.lat, lng: d.lng },
    tagline: d.tagline,
    vibes: d.vibes,
    rating: d.avgRating,
    review_count: d.reviewCount,
    place_count: d.placeCount,
    best_months: d.bestMonths,
    daily_budget_usd: d.dailyBudgetUSD,
    image: image(d.image),
    url: `${origin}/destinations/${d.slug}`,
  };
}

export function apiDestination(d: Destination, origin: string) {
  return {
    ...apiDestinationSummary(destinationToSummary(d), origin),
    description: d.description,
    currency: d.info.currency,
    languages: d.info.languages,
    timezone: d.info.timezone,
    airport: d.info.airport,
    safety: d.info.safety,
    plug_type: d.info.plugType,
    tipping: d.info.tipping,
    neighborhoods: d.info.neighborhoods.map((n) => ({ name: n.name, summary: n.blurb, best_for: n.bestFor })),
    climate: d.climate.map((c) => ({ month: c.month, high_c: c.tmax, low_c: c.tmin, precip_mm: c.precip, rainy_days: c.rainyDays })),
  };
}
