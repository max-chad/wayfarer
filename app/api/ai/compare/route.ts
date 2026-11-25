import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { comparePlaces } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { getPlaceById, getPlacesByIds } from "@/lib/data/places";

export const maxDuration = 90;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`compare:${clientKey(req, user)}`, 10)) return fail("You're comparing very quickly — please wait a moment.", 429);
  const parsed = await parseJson(req, z.object({ ids: z.array(z.number().int()).min(2).max(4) }));
  if ("error" in parsed) return parsed.error;
  const quota = meter(req, user, "insights");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });
  const cards = getPlacesByIds(parsed.data.ids);
  if (cards.length < 2) return fail("Pick at least two places");
  const full = cards.map((c) => getPlaceById(c.id)!);
  const aspects = Object.fromEntries(full.map((p) => [p.id, p.aspectScores]));
  const { result, provider } = await comparePlaces(
    cards.map((c, i) => ({ ...c, amenities: full[i].amenities })),
    aspects
  );
  return ok({ ...result, provider });
}
