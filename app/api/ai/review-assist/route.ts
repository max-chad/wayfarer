import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { reviewAssist } from "@/lib/ai/features";
import { reviewCoach } from "@/lib/ai/local/writer";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { getPlaceById } from "@/lib/data/places";

export const maxDuration = 90;

const Body = z.object({
  action: z.enum(["draft", "polish", "titles", "coach"]),
  placeId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  notes: z.string().max(3000).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(8000).optional(),
  tripType: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`assist:${clientKey(req, user)}`, 20)) return fail("Slow down a little — try again in a moment.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const place = getPlaceById(d.placeId);
  if (!place) return fail("Place not found", 404);
  if (d.action === "coach") return ok({ coach: reviewCoach({ title: d.title || "", body: d.body || "", rating: d.rating, placeType: place.type }) });
  if (d.action === "draft" && !d.notes?.trim()) return fail("Add a few notes first");
  if (d.action !== "draft" && !d.body?.trim()) return fail("Write something first");
  const quota = meter(req, user, "insights");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });
  const { result, provider } = await reviewAssist(d.action, { ...d, placeName: place.name, placeType: place.type });
  return ok({ result, provider });
}
