import { clientKey, fail, ok, rateLimit } from "@/lib/api";
import { getReviewSummary } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { getPlaceById } from "@/lib/data/places";

export const maxDuration = 120;

export async function GET(req: Request, ctx: { params: Promise<{ placeId: string }> }) {
  const user = await getCurrentUser();
  if (!rateLimit(`summary:${clientKey(req, user)}`, 30)) return fail("Too many summaries — please wait a minute.", 429);
  const { placeId } = await ctx.params;
  const place = getPlaceById(Number(placeId));
  if (!place) return fail("Place not found", 404);
  const quota = meter(req, user, "insights");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });
  const summary = await getReviewSummary(place);
  return ok({ summary });
}
