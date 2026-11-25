import { fail, ok, requireUser } from "@/lib/api";
import { listApiKeys, revokeApiKey } from "@/lib/data/apikeys";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!revokeApiKey(auth.user.id, Number(id))) return fail("Key not found", 404);
  return ok({ keys: listApiKeys(auth.user.id) });
}
