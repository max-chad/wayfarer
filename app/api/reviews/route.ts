import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { createReview } from "@/lib/data/reviews";

const Body = z.object({
  placeId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(4, "Add a short title").max(120),
  body: z.string().trim().min(80, "Reviews need at least 80 characters — add a bit more detail").max(6000),
  tripType: z.enum(["couples", "family", "friends", "solo", "business"]),
  visitDate: z.string().regex(/^\d{4}-\d{2}$/, "Pick when you visited"),
  subRatings: z.record(z.string(), z.number().int().min(1).max(5)).default({}),
  photos: z.array(z.string().regex(/^\/api\/uploads\/[a-f0-9]{24}$/)).max(6).default([]),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`review:${clientKey(req, auth.user)}`, 6)) return fail("You're posting reviews very quickly — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const [y, m] = d.visitDate.split("-").map(Number);
  const now = new Date();
  if (y * 12 + m > now.getFullYear() * 12 + now.getMonth() + 1) return fail("Visit date can't be in the future");
  const dupe = db().prepare("SELECT 1 FROM reviews WHERE user_id = ? AND place_id = ? AND created_at >= datetime('now','-1 day')").get(auth.user.id, d.placeId);
  if (dupe) return fail("You've already reviewed this place today.", 409);
  try {
    const res = createReview({ ...d, userId: auth.user.id });
    return ok(res);
  } catch (e) {
    return fail((e as Error).message, 400);
  }
}
