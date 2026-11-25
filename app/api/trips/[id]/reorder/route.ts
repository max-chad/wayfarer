import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { canEditTrip, getTrip, reorderTripItems } from "@/lib/data/trips";

const Body = z.object({
  order: z
    .array(z.object({ id: z.number().int(), day: z.number().int().min(1).max(21), position: z.number().int().min(-1).max(500), startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional() }))
    .max(400),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const owned = new Set(trip!.items.map((i) => i.id));
  reorderTripItems(
    trip!.id,
    parsed.data.order.filter((o) => owned.has(o.id) && o.day <= trip!.days)
  );
  return ok({ trip: getTrip(trip!.id) });
}
