import { fail, ok, requireUser } from "@/lib/api";
import { duplicateTrip, getTrip } from "@/lib/data/trips";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!trip || (!trip.isPublic && trip.userId !== auth.user.id)) return fail("Trip not found", 404);
  const newId = duplicateTrip(trip.id, auth.user.id);
  return ok({ id: newId });
}
