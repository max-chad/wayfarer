import { z } from "zod";
import { fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { BookingError, createBooking, userBookings } from "@/lib/data/commerce";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return ok({ bookings: userBookings(auth.user.id) });
}

const Body = z.object({
  placeId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1).max(15),
  contactName: z.string().trim().min(2).max(80),
  notes: z.string().max(400).optional(),
  tripId: z.number().int().positive().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`booking:${auth.user.id}`, 8)) return fail("Too many bookings in a short time — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  try {
    return ok({ booking: createBooking(auth.user.id, parsed.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message, 409);
    throw e;
  }
}
