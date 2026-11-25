import { clientKey, fail, ok, rateLimit } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { hasPriceAlert, hotelOffers, validateStay } from "@/lib/data/commerce";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`offers:${clientKey(req, user)}`, 60)) return fail("Too many requests", 429);
  const sp = new URL(req.url).searchParams;
  const placeId = Number(sp.get("placeId"));
  const checkIn = sp.get("checkIn") || "";
  const nights = Number(sp.get("nights") || 2);
  const guests = Number(sp.get("guests") || 2);
  const invalid = validateStay(checkIn, nights, guests);
  if (invalid) return fail(invalid, 422);
  const result = hotelOffers(placeId, { checkIn, nights, guests });
  if (!result) return fail("Prices are only available for hotels", 404);
  return ok({ ...result, watching: user ? hasPriceAlert(user.id, placeId) : false }, { headers: { "cache-control": "no-store" } });
}
