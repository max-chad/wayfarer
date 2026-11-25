import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { notify } from "@/lib/data/notifications";
import { setOwnerResponse, setReviewStatus } from "@/lib/data/reviews";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "admin") return fail("Admins only", 403);
  const { id } = await ctx.params;
  const parsed = await parseJson(req, z.object({ status: z.enum(["published", "removed", "flagged"]).optional(), ownerResponse: z.string().max(2000).optional() }));
  if ("error" in parsed) return parsed.error;
  // Reporters are captured before the status change, which marks their reports resolved.
  const reporters = (db().prepare("SELECT DISTINCT user_id FROM review_reports WHERE review_id = ? AND resolved = 0 AND user_id IS NOT NULL").all(Number(id)) as { user_id: number }[]).map((r) => r.user_id);
  if (parsed.data.status && !setReviewStatus(Number(id), parsed.data.status)) return fail("Review not found", 404);
  if (parsed.data.status && parsed.data.status !== "flagged") {
    // Statement of reasons: tell the author and anyone who reported it what was decided.
    const r = db().prepare("SELECT r.user_id, r.title, p.slug, p.name FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.id = ?").get(Number(id)) as
      | { user_id: number; title: string; slug: string; name: string }
      | undefined;
    if (r) {
      const published = parsed.data.status === "published";
      notify(r.user_id, {
        kind: "review",
        title: published ? `Your review of ${r.name} is live` : `Your review of ${r.name} was removed`,
        body: published
          ? `“${r.title}” passed moderation and now counts towards the rating.`
          : `“${r.title}” didn't meet our review guidelines. You can ask for a second review by replying to support.`,
        url: published ? `/place/${r.slug}#reviews` : "/legal/guidelines#moderation",
      });
      for (const uid of reporters.filter((u) => u !== r.user_id)) {
        notify(uid, { kind: "review", title: `Update on your report about ${r.name}`, body: published ? "We reviewed it and it stays up — it meets our guidelines." : "Thanks — we removed the review.", url: `/place/${r.slug}#reviews` });
      }
    }
  }
  if (parsed.data.ownerResponse !== undefined) setOwnerResponse(Number(id), parsed.data.ownerResponse);
  return ok({ ok: true });
}
