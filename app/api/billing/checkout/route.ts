import { z } from "zod";
import { fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { BillingError, PAYMENTS_MODE, subscribe } from "@/lib/data/billing";
import { getBusinessByPlace } from "@/lib/data/business";

const Body = z.object({
  product: z.enum(["plus", "business_insights", "business_pro", "api_growth"]),
  interval: z.enum(["month", "year"]).default("month"),
  placeId: z.number().int().positive().nullable().optional(),
});

/** Demo checkout: activates the plan immediately. With PAYMENTS_MODE=live this becomes a payment-provider session plus webhook. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`checkout:${auth.user.id}`, 10)) return fail("Too many attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  if (PAYMENTS_MODE === "live") return fail("Live payments aren't configured on this server.", 501);
  const { product, interval, placeId } = parsed.data;
  try {
    const res = subscribe(auth.user.id, product, interval, placeId ?? null);
    const biz = placeId ? getBusinessByPlace(placeId) : null;
    const redirect =
      product === "plus" ? "/account/billing?welcome=plus" : product === "api_growth" ? "/developers?upgraded=1" : biz ? `/business/${biz.id}?upgraded=1` : "/business/dashboard";
    return ok({ ok: true, subscriptionId: res.id, resumed: res.resumed, redirect });
  } catch (e) {
    if (e instanceof BillingError) return fail(e.message, 409);
    throw e;
  }
}
