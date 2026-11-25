import { z } from "zod";
import { fail, ok, parseJson } from "@/lib/api";
import { requireBusiness } from "@/lib/business-auth";
import { BusinessError, updateListing } from "@/lib/data/business";

const httpsUrl = z.string().trim().max(300).regex(/^https:\/\/[^\s/$.?#].[^\s]*$/i, "Use a full https:// link");

const Body = z.object({
  website: httpsUrl.nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(40).nullable().optional(),
  bookingUrl: httpsUrl.nullable().optional().or(z.literal("")),
  announcement: z.string().trim().max(160).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireBusiness(id);
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const norm = (v: string | null | undefined) => (v === undefined ? undefined : v ? v : null);
  try {
    return ok({
      business: updateListing(auth.biz.id, { website: norm(d.website), phone: norm(d.phone), bookingUrl: norm(d.bookingUrl), announcement: norm(d.announcement) }),
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, e.status, e.status === 402 ? { upgrade: true } : undefined);
    throw e;
  }
}
