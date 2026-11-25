import { z } from "zod";
import { fail, ok, parseJson, rateLimit } from "@/lib/api";
import { ownerReply } from "@/lib/ai/features";
import { requireBusiness } from "@/lib/business-auth";
import { db } from "@/lib/db";
import type { PlaceType } from "@/lib/types";

const Body = z.object({
  businessId: z.number().int().positive(),
  reviewId: z.number().int().positive(),
  tone: z.enum(["warm", "formal", "brief"]).default("warm"),
});

/** AI-drafted owner reply (Business Insights and up). The owner always edits and publishes it themselves. */
export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const auth = await requireBusiness(parsed.data.businessId, "insights");
  if ("error" in auth) return auth.error;
  if (!rateLimit(`owner-reply:${auth.user.id}`, 20)) return fail("Too many drafts in a short time — please wait a minute.", 429);
  const r = db()
    .prepare(
      `SELECT r.rating, r.title, r.body, u.display_name AS author, p.name AS place_name, p.type AS place_type FROM reviews r
       JOIN users u ON u.id = r.user_id JOIN places p ON p.id = r.place_id WHERE r.id = ? AND r.place_id = ?`
    )
    .get(parsed.data.reviewId, auth.biz.placeId) as { rating: number; title: string; body: string; author: string; place_name: string; place_type: PlaceType } | undefined;
  if (!r) return fail("Review not found for this listing", 404);
  const { result, provider } = await ownerReply({
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    placeName: r.place_name,
    placeType: r.place_type,
    contactName: auth.biz.contactName,
    contactRole: auth.biz.contactRole || "Owner",
    tone: parsed.data.tone,
  });
  return ok({ draft: result, provider });
}
