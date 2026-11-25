import { getReviewSummary } from "@/lib/ai/features";
import { getPlaceById } from "@/lib/data/places";
import { reviewStats } from "@/lib/data/reviews";
import { apiError, apiRoute } from "@/lib/public-api";

/** AI review insights — Growth plan and above. */
export const GET = apiRoute(async (_req, auth, ctx: { params: Promise<{ id: string }> }) => {
  if (auth.plan === "developer") return apiError(403, "The insights endpoint needs the Growth plan. Upgrade at /developers.");
  const { id } = await ctx.params;
  const p = getPlaceById(Number(id));
  if (!p) return apiError(404, "Place not found");
  const stats = reviewStats(p.id);
  const summary = p.reviewCount ? await getReviewSummary(p) : null;
  return {
    place_id: p.id,
    rating: p.rating,
    review_count: p.reviewCount,
    distribution: stats.distribution,
    trust: { average: stats.trustAvg, held_for_moderation: stats.flagged },
    aspects: summary?.aspects ?? [],
    headline: summary?.headline ?? null,
    pros: summary?.pros ?? [],
    cons: summary?.cons ?? [],
    best_for: summary?.bestFor ?? [],
    engine: summary?.provider ?? null,
  };
});
