import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { getPlan } from "@/lib/data/billing";
import { BookingError, deletePriceAlert, upsertPriceAlert, validateStay } from "@/lib/data/commerce";

const Body = z.object({
  placeId: z.number().int().positive(),
  checkIn: z.string(),
  nights: z.number().int(),
  guests: z.number().int(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  if (getPlan(auth.user.id) !== "plus") return fail("Price-drop alerts are a Wayfarer Plus feature.", 402, { upgrade: true, feature: "price_alerts" });
  const { placeId, checkIn, nights, guests } = parsed.data;
  const invalid = validateStay(checkIn, nights, guests);
  if (invalid) return fail(invalid, 422);
  try {
    return ok({ priceCents: upsertPriceAlert(auth.user.id, placeId, { checkIn, nights, guests }) });
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message, 422);
    throw e;
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const placeId = Number(new URL(req.url).searchParams.get("placeId"));
  return ok({ removed: deletePriceAlert(auth.user.id, placeId) });
}
