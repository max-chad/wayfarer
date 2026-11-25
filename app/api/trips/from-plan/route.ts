import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getDestination } from "@/lib/data/destinations";
import { insertTripFromItinerary } from "@/lib/data/trip-writer";
import type { Itinerary, PlanRequest } from "@/lib/types";

const Stop = z.object({
  placeId: z.number().int().nullable(),
  title: z.string().max(200),
  kind: z.enum(["place", "meal", "note", "transport"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(5).max(1440),
  note: z.string().max(1000),
  costUsd: z.number().min(0).max(100000),
});

const Body = z.object({
  title: z.string().max(120).optional(),
  request: z.object({
    destinationSlug: z.string(),
    days: z.number().int().min(1).max(14),
    startDate: z.string().nullable().optional(),
    travelers: z.number().int().min(1).max(12),
    budget: z.enum(["budget", "midrange", "luxury"]),
    pace: z.enum(["relaxed", "balanced", "packed"]),
    interests: z.array(z.string()),
    tripType: z.enum(["couples", "family", "friends", "solo", "business"]),
  }),
  itinerary: z.object({
    title: z.string().max(200),
    summary: z.string().max(3000),
    hotelPlaceId: z.number().int().nullable(),
    tips: z.array(z.string().max(500)).max(10),
    days: z.array(z.object({ day: z.number().int(), title: z.string().max(200), theme: z.string().max(200), stops: z.array(Stop).max(20) })).max(14),
  }),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { request, itinerary, title } = parsed.data;
  const dest = getDestination(request.destinationSlug);
  if (!dest) return fail("Unknown destination", 404);
  // only keep place references that belong to this destination
  const valid = new Set(
    (db().prepare("SELECT id FROM places WHERE destination_id = ?").all(dest.id) as { id: number }[]).map((r) => r.id)
  );
  const clean: Itinerary = {
    ...itinerary,
    destinationSlug: dest.slug,
    hotelPlaceId: itinerary.hotelPlaceId && valid.has(itinerary.hotelPlaceId) ? itinerary.hotelPlaceId : null,
    days: itinerary.days.map((d) => ({ ...d, stops: d.stops.map((s) => ({ ...s, placeId: s.placeId && valid.has(s.placeId) ? s.placeId : null })) })),
    estimatedCostUsd: { lodging: 0, food: 0, activities: 0, transport: 0, total: 0, perPerson: 0 },
    provider: "local",
  };
  const id = insertTripFromItinerary(db(), auth.user.id, dest.id, request as PlanRequest, clean, { title: title || itinerary.title });
  return ok({ id });
}
