import { z } from "zod";
import { ok, parseJson } from "@/lib/api";
import { matchDestinations } from "@/lib/ai/local/matcher";
import { getCurrentUser } from "@/lib/auth";
import { listDestinations } from "@/lib/data/destinations";
import { HOME_CITIES } from "@/lib/seed/people";

const Body = z.object({
  month: z.number().int().min(1).max(12),
  budget: z.enum(["budget", "midrange", "luxury"]),
  vibes: z.array(z.string()).max(10),
  climate: z.enum(["hot", "warm", "mild", "cool", "any"]),
  days: z.number().int().min(1).max(30),
  maxFlightHours: z.number().nullable().optional(),
  homeCity: z.string().optional(),
  avoid: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const user = await getCurrentUser();
  const city = HOME_CITIES.find((c) => c.name === parsed.data.homeCity);
  const home = city ? { lat: city.lat, lng: city.lng } : user?.homeLat != null ? { lat: user.homeLat!, lng: user.homeLng! } : null;
  const dests = listDestinations();
  const results = matchDestinations(dests, { ...parsed.data, home }).slice(0, 8);
  return ok({ results: results.map((r) => ({ ...r, destination: dests.find((d) => d.slug === r.slug) })) });
}
