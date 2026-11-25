import { z } from "zod";
import { fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { DEMO_MODE } from "@/lib/data/billing";
import { BusinessError, claimListing } from "@/lib/data/business";

const Body = z.object({
  placeId: z.number().int().positive(),
  contactName: z.string().trim().min(2).max(80),
  contactRole: z.string().trim().min(2).max(60),
  website: z.string().url().max(200).startsWith("https://").optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`claim:${auth.user.id}`, 6)) return fail("Too many claim attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  try {
    const res = claimListing(auth.user.id, { ...parsed.data, website: parsed.data.website || undefined });
    // Demo mode shows the code on screen so the flow works without SMS/email delivery.
    // With DEMO_MODE=false the code must be delivered out of band (not wired up in this prototype).
    return ok({ businessId: res.businessId, alreadyVerified: res.alreadyVerified, demoCode: DEMO_MODE ? res.code : null });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, 409);
    throw e;
  }
}
