import { fail, ok, requireUser } from "@/lib/api";
import { BookingError, cancelBooking } from "@/lib/data/commerce";

export async function DELETE(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { ref } = await ctx.params;
  try {
    return ok({ booking: cancelBooking(auth.user.id, ref) });
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message, 409);
    throw e;
  }
}
