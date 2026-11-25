import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { apiPlanFor, createApiKey, listApiKeys, monthlyApiUsage } from "@/lib/data/apikeys";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return ok({ keys: listApiKeys(auth.user.id), plan: apiPlanFor(auth.user.id), used: monthlyApiUsage(auth.user.id) });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ name: z.string().trim().max(60).default("") }));
  if ("error" in parsed) return parsed.error;
  try {
    const { key } = createApiKey(auth.user.id, parsed.data.name);
    return ok({ key, keys: listApiKeys(auth.user.id) }, { status: 201 });
  } catch (e) {
    return fail((e as Error).message, 409);
  }
}
