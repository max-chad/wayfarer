import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { listSubscriptions, setCancelAtPeriodEnd } from "@/lib/data/billing";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ action: z.enum(["cancel", "resume"]) }));
  if ("error" in parsed) return parsed.error;
  const { id } = await ctx.params;
  const done = setCancelAtPeriodEnd(auth.user.id, Number(id), parsed.data.action === "cancel");
  if (!done) return fail("Subscription not found", 404);
  return ok({ subscription: listSubscriptions(auth.user.id).find((s) => s.id === Number(id)) });
}
