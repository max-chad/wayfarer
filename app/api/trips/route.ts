import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { getDestination } from "@/lib/data/destinations";
import { createTrip, listTrips } from "@/lib/data/trips";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return ok({ trips: listTrips(auth.user.id) });
}

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  destinationSlug: z.string().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  days: z.number().int().min(1).max(21).default(3),
  travelers: z.number().int().min(1).max(12).default(2),
  budget: z.enum(["budget", "midrange", "luxury"]).default("midrange"),
  pace: z.enum(["relaxed", "balanced", "packed"]).default("balanced"),
  interests: z.array(z.string()).max(12).default([]),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const dest = d.destinationSlug ? getDestination(d.destinationSlug) : null;
  if (d.destinationSlug && !dest) return fail("Unknown destination", 404);
  const id = createTrip(auth.user.id, { ...d, destinationId: dest?.id ?? null });
  return ok({ id });
}
