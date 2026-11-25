import { z } from "zod";
import { fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { BusinessError, verifyListing } from "@/lib/data/business";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`verify:${auth.user.id}`, 8)) return fail("Too many attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }));
  if ("error" in parsed) return parsed.error;
  const { id } = await ctx.params;
  try {
    return ok({ business: verifyListing(Number(id), auth.user.id, parsed.data.code) });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, 422);
    throw e;
  }
}
