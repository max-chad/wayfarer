import { fail, ok, requireUser } from "@/lib/api";
import { getReview, toggleHelpful } from "@/lib/data/reviews";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const review = getReview(Number(id));
  if (!review) return fail("Review not found", 404);
  if (review.userId === auth.user.id) return fail("You can't vote on your own review", 400);
  return ok(toggleHelpful(review.id, auth.user.id));
}
