import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { savedPlaceIds, toggleSave } from "@/lib/data/misc";
import { getPlaceById } from "@/lib/data/places";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return ok({ ids: savedPlaceIds(auth.user.id) });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ placeId: z.number().int().positive() }));
  if ("error" in parsed) return parsed.error;
  if (!getPlaceById(parsed.data.placeId)) return fail("Place not found", 404);
  return ok({ saved: toggleSave(auth.user.id, parsed.data.placeId) });
}
