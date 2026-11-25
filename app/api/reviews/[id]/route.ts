import { fail, ok, requireUser } from "@/lib/api";
import { deleteReview } from "@/lib/data/reviews";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const done = deleteReview(Number(id), auth.user.id, auth.user.role === "admin");
  return done ? ok({ ok: true }) : fail("Not allowed", 403);
}
