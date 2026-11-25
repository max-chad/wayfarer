import { z } from "zod";
import { fail, ok, parseJson } from "@/lib/api";
import { requireBusiness } from "@/lib/business-auth";
import { BusinessError, campaignsFor, createCampaign } from "@/lib/data/business";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireBusiness(id);
  if ("error" in auth) return auth.error;
  return ok({ campaigns: campaignsFor(auth.biz.id) });
}

const Body = z.object({
  name: z.string().trim().max(80).default("Sponsored listing"),
  dailyBudgetCents: z.number().int().min(100).max(100_000),
  cpcCents: z.number().int().min(1).max(2_000),
  days: z.number().int().min(1).max(365).nullable().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireBusiness(id);
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  try {
    return ok({ campaign: createCampaign(auth.biz.id, parsed.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, 422);
    throw e;
  }
}
