import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { answerPlaceQuestion } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { addAnswer, addQuestion, listQuestions } from "@/lib/data/misc";
import { getPlaceById } from "@/lib/data/places";

export const maxDuration = 90;

const Body = z.object({ placeId: z.number().int(), question: z.string().trim().min(5, "Ask a full question").max(500), post: z.boolean().optional() });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`qa:${clientKey(req, user)}`, 15)) return fail("Too many questions — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const quota = meter(req, user, "insights");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });
  const place = getPlaceById(parsed.data.placeId);
  if (!place) return fail("Place not found", 404);
  const { result, provider } = await answerPlaceQuestion(place, parsed.data.question);
  // Signed-in users can publish the question (with the AI answer) to the community Q&A
  if (parsed.data.post && user) {
    const qid = addQuestion(place.id, user.id, parsed.data.question);
    addAnswer(qid, null, result, { provider });
    return ok({ answer: result, provider, posted: true, questions: listQuestions(place.id) });
  }
  return ok({ answer: result, provider, posted: false });
}
