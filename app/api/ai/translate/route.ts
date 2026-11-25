import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { translateReview } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { getReview, saveReviewTranslation } from "@/lib/data/reviews";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`translate:${clientKey(req, user)}`, 20)) return fail("Translating very quickly — please wait a moment.", 429);
  const parsed = await parseJson(req, z.object({ reviewId: z.number().int() }));
  if ("error" in parsed) return parsed.error;
  const quota = meter(req, user, "insights");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });
  const review = getReview(parsed.data.reviewId);
  if (!review) return fail("Review not found", 404);
  const { result, provider } = await translateReview(review);
  if (!result) return fail("Translation needs the Claude API (set ANTHROPIC_API_KEY).", 503);
  if (provider === "claude") saveReviewTranslation(review.id, result);
  return ok({ translation: result, provider });
}
