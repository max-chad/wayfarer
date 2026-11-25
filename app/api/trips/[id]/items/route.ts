import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { getPlaceById } from "@/lib/data/places";
import { addTripItem, canEditTrip, getTrip } from "@/lib/data/trips";

const Body = z.object({
  day: z.number().int().min(1).max(21),
  placeId: z.number().int().nullable().optional(),
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(1440).optional(),
  kind: z.enum(["place", "meal", "note", "transport"]).optional(),
  costUsd: z.number().min(0).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  if (d.day > trip!.days) return fail("That day is outside the trip");
  let kind = d.kind;
  if (d.placeId) {
    const p = getPlaceById(d.placeId);
    if (!p) return fail("Place not found", 404);
    kind = kind || (p.type === "restaurant" ? "meal" : "place");
  }
  if (!d.placeId && !d.title?.trim()) return fail("Give the item a title");
  addTripItem(trip!.id, { ...d, kind });
  return ok({ trip: getTrip(trip!.id) });
}
