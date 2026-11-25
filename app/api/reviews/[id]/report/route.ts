import { z } from "zod";
import { fail, ok, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getReview, reportReview } from "@/lib/data/reviews";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseJson(req, z.object({ reason: z.string().trim().min(3).max(500) }));
  if ("error" in parsed) return parsed.error;
  const review = getReview(Number(id));
  if (!review) return fail("Review not found", 404);
  const user = await getCurrentUser();
  reportReview(review.id, user?.id ?? null, parsed.data.reason);
  return ok({ ok: true });
}
