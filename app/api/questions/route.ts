import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { addQuestion, listQuestions } from "@/lib/data/misc";
import { getPlaceById } from "@/lib/data/places";

export async function GET(req: Request) {
  const placeId = Number(new URL(req.url).searchParams.get("placeId"));
  return ok({ questions: listQuestions(placeId) });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ placeId: z.number().int(), body: z.string().trim().min(5).max(500) }));
  if ("error" in parsed) return parsed.error;
  if (!getPlaceById(parsed.data.placeId)) return fail("Place not found", 404);
  addQuestion(parsed.data.placeId, auth.user.id, parsed.data.body);
  return ok({ questions: listQuestions(parsed.data.placeId) });
}
