import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { canEditTrip, getTrip, removeTripItem, updateTripItem } from "@/lib/data/trips";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const Patch = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(1440).optional(),
  costUsd: z.number().min(0).optional(),
  day: z.number().int().min(1).max(21).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id, itemId } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  const parsed = await parseJson(req, Patch);
  if ("error" in parsed) return parsed.error;
  updateTripItem(trip!.id, Number(itemId), parsed.data);
  return ok({ trip: getTrip(trip!.id) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id, itemId } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  removeTripItem(trip!.id, Number(itemId));
  return ok({ trip: getTrip(trip!.id) });
}
