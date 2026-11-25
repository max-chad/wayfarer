import { z } from "zod";
import { clientKey, fail, parseJson, rateLimit } from "@/lib/api";
import { aiProvider } from "@/lib/ai/claude";
import { planTrip } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { db } from "@/lib/db";
import { getDestination } from "@/lib/data/destinations";
import { getPlacesByIds } from "@/lib/data/places";
import { loadPlannerData } from "@/lib/seed/demo";
import { weatherForTrip } from "@/lib/services/weather";
import type { PlanRequest } from "@/lib/types";

export const maxDuration = 180;

const Body = z.object({
  destinationSlug: z.string().min(1),
  days: z.number().int().min(1).max(14),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  travelers: z.number().int().min(1).max(12),
  budget: z.enum(["budget", "midrange", "luxury"]),
  pace: z.enum(["relaxed", "balanced", "packed"]),
  interests: z.array(z.string().max(30)).max(12),
  tripType: z.enum(["couples", "family", "friends", "solo", "business"]),
  mustSee: z.array(z.number().int()).max(20).optional(),
  dietary: z.array(z.string().max(20)).max(5).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`plan:${clientKey(req, user)}`, 10)) return fail("Too many plans in a short time — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const r = parsed.data as PlanRequest;
  const dest = getDestination(r.destinationSlug);
  if (!dest) return fail("Unknown destination", 404);
  const quota = meter(req, user, "plan");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        const data = loadPlannerData(db(), dest.slug)!;
        send({ type: "status", step: 1, text: `Reading ${data.places.length} places and ${dest.reviewCount.toLocaleString("en-US")} reviews in ${dest.name}` });
        const weather = r.startDate ? await weatherForTrip(dest.lat, dest.lng, dest.climate, r.startDate, r.days) : [];
        send({ type: "status", step: 2, text: weather.length ? `Checking the weather for your dates (${weather.filter((w) => w.source === "forecast").length ? "live forecast" : "climate averages"})` : "Matching places to your interests" });
        await new Promise((res) => setTimeout(res, 250));
        send({ type: "status", step: 3, text: "Clustering sights by neighbourhood and optimising walking routes" });
        if (aiProvider() === "claude") send({ type: "status", step: 4, text: "Claude is crafting your day-by-day itinerary" });
        const itinerary = await planTrip(
          r,
          data.dest,
          data.places,
          weather.map((w) => ({ date: w.date, tmax: w.tmax, tmin: w.tmin, precipProb: w.precipProb, summary: w.summary }))
        );
        send({ type: "status", step: 5, text: "Estimating costs and adding local tips" });
        const ids = [...itinerary.days.flatMap((d) => d.stops.map((s) => s.placeId)), itinerary.hotelPlaceId].filter((x): x is number => !!x);
        send({ type: "result", itinerary, places: getPlacesByIds(ids), weather, destination: { slug: dest.slug, name: dest.name, lat: dest.lat, lng: dest.lng, currency: dest.info.currency } });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
