import { z } from "zod";
import { fail, ok, parseJson } from "@/lib/api";
import { requireBusiness } from "@/lib/business-auth";
import { BusinessError, respondToReview } from "@/lib/data/business";

/** Publishes (or clears, with empty text) the owner's public reply to a review. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireBusiness(id);
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ reviewId: z.number().int().positive(), text: z.string().max(2000) }));
  if ("error" in parsed) return parsed.error;
  try {
    respondToReview(auth.biz.id, parsed.data.reviewId, parsed.data.text);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, 422);
    throw e;
  }
}
