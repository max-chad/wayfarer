import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { addAnswer, getQuestion, listQuestions } from "@/lib/data/misc";
import { notify } from "@/lib/data/notifications";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const q = getQuestion(Number(id));
  if (!q) return fail("Question not found", 404);
  const parsed = await parseJson(req, z.object({ body: z.string().trim().min(2).max(2000) }));
  if ("error" in parsed) return parsed.error;
  addAnswer(q.id, auth.user.id, parsed.data.body);
  const asker = db().prepare("SELECT q.user_id, p.slug, p.name FROM questions q JOIN places p ON p.id = q.place_id WHERE q.id = ?").get(q.id) as
    | { user_id: number | null; slug: string; name: string }
    | undefined;
  if (asker?.user_id && asker.user_id !== auth.user.id) {
    notify(asker.user_id, { kind: "answer", title: `${auth.user.displayName} answered your question about ${asker.name}`, body: q.body.slice(0, 140), url: `/place/${asker.slug}#questions` });
  }
  return ok({ questions: listQuestions(q.place_id) });
}
