import { z } from "zod";
import { fail, ok, parseJson } from "@/lib/api";
import { requireBusiness } from "@/lib/business-auth";
import { BusinessError, updateCampaign } from "@/lib/data/business";

const Body = z.object({
  status: z.enum(["active", "paused", "ended"]).optional(),
  dailyBudgetCents: z.number().int().min(100).max(100_000).optional(),
  cpcCents: z.number().int().min(1).max(2_000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;
  const auth = await requireBusiness(id);
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  try {
    return ok({ campaign: updateCampaign(auth.biz.id, Number(cid), parsed.data) });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, 422);
    throw e;
  }
}
