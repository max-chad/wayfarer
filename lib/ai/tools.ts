// Travel tools shared by the Claude concierge (tool use) and the local concierge engine.
import { z } from "zod";
import { allDestinationNames, destinationsForMonth, getDestination, listDestinations } from "../data/destinations";
import { getPlace, listPlaces } from "../data/places";
import { loadPlannerData } from "../seed/demo";
import { db } from "../db";
import { haversineKm } from "../geo";
import { getForecast, describeClimateMonth, type WeatherIcon } from "../services/weather";
import { convertCurrency } from "../services/currency";
import type { DestinationSummary, PlaceCardData, PlaceType } from "../types";
import { MONTHS, priceSymbols } from "../utils";
import { planItinerary } from "./local/planner";

export type ChatCard =
  | { kind: "place"; place: PlaceCardData }
  | { kind: "destination"; destination: DestinationSummary }
  | { kind: "plan"; destinationSlug: string; destinationName: string; days: number; title: string; summary: string; highlights: string[]; query: string }
  | { kind: "weather"; destinationName: string; days: { date: string; tmax: number; tmin: number; precipProb: number; summary: string; icon: WeatherIcon }[] };

export interface ToolOutput {
  /** compact data handed back to the model */
  data: unknown;
  /** rich cards rendered in the chat UI */
  cards: ChatCard[];
}

function resolveDestination(name?: string | null) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  const all = allDestinationNames();
  const hit =
    all.find((d) => d.slug === n || d.name.toLowerCase() === n) ||
    all.find((d) => n.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(n)) ||
    all.find((d) => d.country.toLowerCase() === n);
  return hit ? getDestination(hit.slug) : null;
}

const compactPlace = (p: PlaceCardData) => ({
  slug: p.slug,
  name: p.name,
  type: p.type,
  category: p.category,
  city: p.destinationName,
  neighborhood: p.neighborhood || undefined,
  rating: p.rating,
  reviews: p.reviewCount,
  price: p.type === "hotel" ? `$${p.priceUsd}/night` : p.type === "restaurant" ? priceSymbols(p.priceLevel) : p.priceUsd ? `$${p.priceUsd}` : "free",
  tags: p.tags.slice(0, 5),
  awards: p.awards,
  blurb: p.description.slice(0, 180),
  url: `/place/${p.slug}`,
});

// ── tool schemas ──────────────────────────────────────────────────────────────

export const TOOL_SCHEMAS = {
  search_places: z.object({
    destination: z.string().describe("City name, e.g. 'Lisbon'. Omit to search every city.").optional(),
    type: z.enum(["hotel", "restaurant", "attraction", "experience"]).optional(),
    query: z.string().describe("Free-text keywords, e.g. 'rooftop bar', 'sushi', 'museum'").optional(),
    tags: z.array(z.string()).describe("Tags such as romantic, family-friendly, views, quiet, free, hidden-gem, rooftop, vegetarian-friendly").optional(),
    price_levels: z.array(z.number().int().min(1).max(4)).describe("1=$ ... 4=$$$$").optional(),
    min_rating: z.number().min(1).max(5).optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  get_destination_info: z.object({ destination: z.string() }),
  get_weather: z.object({ destination: z.string(), month: z.number().int().min(1).max(12).describe("Month for climate averages; omit for the live 7-day forecast").optional() }),
  plan_trip: z.object({
    destination: z.string(),
    days: z.number().int().min(1).max(14),
    interests: z.array(z.string()).optional(),
    budget: z.enum(["budget", "midrange", "luxury"]).optional(),
    pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
    travelers: z.number().int().min(1).max(12).optional(),
  }),
  recommend_destinations: z.object({
    month: z.number().int().min(1).max(12).optional(),
    vibes: z.array(z.string()).describe("e.g. beach, food, culture, nightlife, nature, romantic").optional(),
    budget: z.enum(["budget", "midrange", "luxury"]).optional(),
    continent: z.string().optional(),
    climate: z.enum(["warm", "cool"]).describe("Prefer warm/sunny or cool destinations in that month").optional(),
    limit: z.number().int().min(1).max(6).optional(),
  }),
  get_place_details: z.object({ place: z.string().describe("Place slug from search results, or its exact name") }),
  convert_currency: z.object({ amount: z.number(), from: z.string().length(3), to: z.string().length(3) }),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_places:
    "Search Wayfarer's database of hotels, restaurants, attractions and experiences with ratings from traveler reviews. Use whenever the user wants recommendations of specific places. Results are shown to the user as cards.",
  get_destination_info:
    "Get practical facts about a destination: best months, daily budget, currency, language, safety, tipping, getting around, neighbourhoods, local dishes, events and insider tips.",
  get_weather: "Get the live 7-day weather forecast for a destination, or monthly climate averages when a month is given.",
  plan_trip:
    "Generate a day-by-day itinerary for a destination using the Wayfarer planner. Returns a summary and highlights; the user can open the full editable plan from the card.",
  recommend_destinations: "Recommend destinations matching a month, vibes, budget or continent. Use for 'where should I go' style questions.",
  get_place_details: "Get full details and review highlights for one place (hours, price, amenities, rating, tips).",
  convert_currency: "Convert an amount between currencies using current exchange rates (ISO codes like USD, EUR, JPY).",
};

// ── implementations ───────────────────────────────────────────────────────────

export async function runTool(name: ToolName, rawInput: unknown): Promise<ToolOutput> {
  const schema = TOOL_SCHEMAS[name];
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return { data: { error: `Invalid input: ${parsed.error.issues[0]?.message}` }, cards: [] };
  const input = parsed.data as Record<string, unknown>;

  switch (name) {
    case "search_places": {
      const i = input as z.infer<typeof TOOL_SCHEMAS.search_places>;
      const dest = resolveDestination(i.destination);
      if (i.destination && !dest) return { data: { error: `Unknown destination "${i.destination}". Available: ${allDestinationNames().map((d) => d.name).join(", ")}` }, cards: [] };
      // hotel "tags" like pool/spa are really amenities
      const AMENITY_TAGS: Record<string, string> = { pool: "Pool", spa: "Spa", parking: "Parking", breakfast: "Breakfast included", gym: "Fitness center", "pet-friendly": "Pet friendly" };
      const allTags = (i.tags || []).filter(Boolean);
      const amenities = i.type === "hotel" ? allTags.filter((t) => AMENITY_TAGS[t]).map((t) => AMENITY_TAGS[t]) : [];
      const tags = i.type === "hotel" ? allTags.filter((t) => !AMENITY_TAGS[t]) : allTags;
      const run = (withQuery: boolean, useTags: string[], useAmenities: string[]) =>
        listPlaces({
          destinationId: dest?.id,
          type: i.type as PlaceType | undefined,
          q: withQuery ? i.query : undefined,
          tags: useTags,
          amenities: useAmenities,
          priceLevels: i.price_levels,
          minRating: i.min_rating,
          sort: "rating",
          limit: i.limit ?? 5,
        }).items;
      let items = run(true, tags, amenities);
      let relaxed = false;
      // relax gradually: drop the keyword query, then one tag at a time, then amenities
      if (!items.length && i.query) ((items = run(false, tags, amenities)), (relaxed = true));
      for (let drop = tags.length - 1; !items.length && drop >= 0; drop--) {
        items = run(false, tags.filter((_, k) => k !== drop), amenities);
        relaxed = true;
      }
      if (!items.length && tags.length) items = run(false, [], amenities);
      if (!items.length && amenities.length) items = run(false, [], []);
      return {
        data: { destination: dest?.name ?? "all cities", results: items.map(compactPlace), note: relaxed ? "No exact match; filters were relaxed." : undefined },
        cards: items.map((place) => ({ kind: "place", place })),
      };
    }
    case "get_destination_info": {
      const dest = resolveDestination(input.destination as string);
      if (!dest) return { data: { error: "Unknown destination" }, cards: [] };
      const i = dest.info;
      return {
        data: {
          name: dest.name,
          country: dest.country,
          tagline: dest.tagline,
          vibes: dest.vibes,
          bestMonths: i.bestMonths.map((m) => MONTHS[m - 1]),
          avoidMonths: (i.avoidMonths || []).map((m) => MONTHS[m - 1]),
          dailyBudgetUSD: i.dailyBudgetUSD,
          typicalCostsUSD: i.costs,
          currency: i.currency,
          languages: i.languages,
          timezone: i.timezone,
          airport: i.airport,
          safety: i.safety,
          plug: `${i.plugType} (${i.voltage})`,
          tipping: i.tipping,
          gettingAround: i.gettingAround,
          neighborhoods: i.neighborhoods?.map((n) => `${n.name}: ${n.blurb}`),
          dishes: i.dishes?.map((d) => d.name),
          events: i.events?.map((e) => `${MONTHS[e.month - 1]}: ${e.name}`),
          tips: i.tips,
          etiquette: i.etiquette,
          url: `/destinations/${dest.slug}`,
        },
        cards: [{ kind: "destination", destination: listDestinations().find((d) => d.slug === dest.slug)! }],
      };
    }
    case "get_weather": {
      const dest = resolveDestination(input.destination as string);
      if (!dest) return { data: { error: "Unknown destination" }, cards: [] };
      if (input.month) {
        const m = input.month as number;
        return { data: { destination: dest.name, month: MONTHS[m - 1], ...describeClimateMonth(dest.climate[m - 1]) }, cards: [] };
      }
      const fc = await getForecast(dest.lat, dest.lng, dest.info.timezone);
      if (!fc) return { data: { destination: dest.name, note: "Live forecast unavailable; climate average for this month follows.", ...describeClimateMonth(dest.climate[new Date().getMonth()]) }, cards: [] };
      const days = fc.slice(0, 7);
      return {
        data: { destination: dest.name, forecast: days.map((d) => ({ date: d.date, high: d.tmax, low: d.tmin, rainChance: d.precipProb, summary: d.summary })) },
        cards: [{ kind: "weather", destinationName: dest.name, days }],
      };
    }
    case "plan_trip": {
      const i = input as z.infer<typeof TOOL_SCHEMAS.plan_trip>;
      const dest = resolveDestination(i.destination);
      if (!dest) return { data: { error: "Unknown destination" }, cards: [] };
      const pd = loadPlannerData(db(), dest.slug)!;
      const req = {
        destinationSlug: dest.slug,
        days: i.days,
        travelers: i.travelers ?? 2,
        budget: i.budget ?? "midrange",
        pace: i.pace ?? "balanced",
        interests: i.interests ?? [],
        tripType: (i.travelers ?? 2) === 1 ? "solo" : "couples",
      } as const;
      const it = planItinerary({ ...req, interests: [...req.interests] }, pd.dest, pd.places);
      const query = new URLSearchParams({
        destination: dest.slug,
        days: String(i.days),
        budget: req.budget,
        pace: req.pace,
        travelers: String(req.travelers),
        interests: req.interests.join(","),
        autostart: "1",
      }).toString();
      return {
        data: {
          title: it.title,
          summary: it.summary,
          days: it.days.map((d) => ({ day: d.day, title: d.title, stops: d.stops.map((s) => `${s.startTime} ${s.title}`) })),
          estimatedCostUsd: it.estimatedCostUsd,
          openInPlanner: `/plan?${query}`,
        },
        cards: [
          {
            kind: "plan",
            destinationSlug: dest.slug,
            destinationName: dest.name,
            days: i.days,
            title: it.title,
            summary: it.summary,
            highlights: it.days.map((d) => `Day ${d.day}: ${d.title}`),
            query,
          },
        ],
      };
    }
    case "recommend_destinations": {
      const i = input as z.infer<typeof TOOL_SCHEMAS.recommend_destinations>;
      let list = i.month ? destinationsForMonth(i.month, 32) : listDestinations();
      if (i.continent) list = list.filter((d) => d.continent.toLowerCase().includes(i.continent!.toLowerCase()));
      if (i.budget === "budget") list = list.filter((d) => d.dailyBudgetUSD.midrange <= 150);
      if (i.vibes?.length) {
        const v = i.vibes.map((x) => x.toLowerCase());
        list = [...list].sort((a, b) => b.vibes.filter((x) => v.includes(x)).length - a.vibes.filter((x) => v.includes(x)).length);
      }
      if (i.climate) {
        const m = (i.month || new Date().getMonth() + 1) - 1;
        const warmth = (d: (typeof list)[number]) => (d.climate[m]?.tmax ?? 20) - (d.climate[m]?.rainyDays ?? 8) * 0.4;
        list = [...list].sort((a, b) => (i.climate === "warm" ? warmth(b) - warmth(a) : warmth(a) - warmth(b)));
      }
      const top = list.slice(0, i.limit ?? 4);
      return {
        data: top.map((d) => ({
          name: d.name,
          country: d.country,
          vibes: d.vibes,
          bestMonths: d.bestMonths.map((m) => MONTHS[m - 1].slice(0, 3)),
          midrangeDailyUsd: d.dailyBudgetUSD.midrange,
          climate: i.month ? describeClimateMonth(d.climate[i.month - 1]) : undefined,
          url: `/destinations/${d.slug}`,
        })),
        cards: top.map((destination) => ({ kind: "destination", destination })),
      };
    }
    case "get_place_details": {
      const key = String(input.place);
      const p =
        getPlace(key) ||
        (() => {
          const hit = listPlaces({ q: key, limit: 1, sort: "reviews" }).items[0];
          return hit ? getPlace(hit.slug) : null;
        })();
      if (!p) return { data: { error: "Place not found" }, cards: [] };
      const card = listPlaces({ destinationId: p.destinationId, near: p, sort: "distance", limit: 1 }).items.find((x) => x.id === p.id);
      return {
        data: {
          ...compactPlace({ ...p, description: p.description, details: p.details } as PlaceCardData),
          description: p.description,
          details: p.details,
          amenities: p.amenities,
          ranking: `#${p.ranking} of ${p.rankingTotal} in ${p.destinationName}`,
          subRatings: p.aspectScores,
        },
        cards: card ? [{ kind: "place", place: card }] : [],
      };
    }
    case "convert_currency": {
      const i = input as z.infer<typeof TOOL_SCHEMAS.convert_currency>;
      const r = await convertCurrency(i.amount, i.from.toUpperCase(), i.to.toUpperCase());
      return { data: r ?? { error: "Unsupported currency" }, cards: [] };
    }
  }
}

export function distanceBetween(a: string, b: string) {
  const A = resolveDestination(a);
  const B = resolveDestination(b);
  return A && B ? Math.round(haversineKm(A, B)) : null;
}
