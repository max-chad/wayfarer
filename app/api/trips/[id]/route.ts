import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { canEditTrip, deleteTrip, getTrip, updateTrip } from "@/lib/data/trips";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const trip = getTrip(Number(id));
  if (!trip || (!trip.isPublic && trip.userId !== user?.id)) return fail("Trip not found", 404);
  return ok({ trip });
}

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  days: z.number().int().min(1).max(21).optional(),
  travelers: z.number().int().min(1).max(12).optional(),
  budget: z.enum(["budget", "midrange", "luxury"]).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  notes: z.string().max(5000).optional(),
  isPublic: z.boolean().optional(),
  packing: z
    .object({
      generatedAt: z.string(),
      categories: z.array(z.object({ name: z.string(), items: z.array(z.object({ name: z.string().max(200), checked: z.boolean(), reason: z.string().optional() })) })),
    })
    .nullable()
    .optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  const parsed = await parseJson(req, Patch);
  if ("error" in parsed) return parsed.error;
  updateTrip(trip!.id, parsed.data);
  return ok({ trip: getTrip(trip!.id) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const trip = getTrip(Number(id));
  if (!canEditTrip(trip, auth.user.id)) return fail("Trip not found", 404);
  deleteTrip(trip!.id);
  return ok({ ok: true });
}
