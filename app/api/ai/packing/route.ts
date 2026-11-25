import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { buildPackingList } from "@/lib/ai/local/packing";
import { getDestination, getDestinationById } from "@/lib/data/destinations";
import { canEditTrip, getTrip, updateTrip } from "@/lib/data/trips";

const Body = z.union([
  z.object({ tripId: z.number().int() }),
  z.object({
    destinationSlug: z.string(),
    month: z.number().int().min(1).max(12),
    days: z.number().int().min(1).max(30),
    interests: z.array(z.string()).max(12).default([]),
    tripType: z.string().default("couples"),
  }),
]);

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  if ("tripId" in d) {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const trip = getTrip(d.tripId);
    if (!trip || !canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
    if (!trip.destinationId) return fail("This trip has no destination yet");
    const dest = getDestinationById(trip.destinationId)!;
    const month = trip.startDate ? Number(trip.startDate.slice(5, 7)) : new Date().getMonth() + 1;
    const list = buildPackingList({ destination: dest, month, days: trip.days, interests: trip.interests, tripType: trip.travelers === 1 ? "solo" : "couples", budget: trip.budget });
    updateTrip(trip.id, { packing: list });
    return ok({ packing: list });
  }
  const dest = getDestination(d.destinationSlug);
  if (!dest) return fail("Unknown destination", 404);
  return ok({ packing: buildPackingList({ destination: dest, month: d.month, days: d.days, interests: d.interests, tripType: d.tripType }) });
}
