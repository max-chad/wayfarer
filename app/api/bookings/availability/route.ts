import { fail, ok } from "@/lib/api";
import { availability } from "@/lib/data/commerce";
import { nowAt } from "@/lib/time";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const placeId = Number(sp.get("placeId"));
  const date = sp.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date", 422);
  const a = availability(placeId, date);
  if (!a) return fail("This place can't be booked online", 404);
  if (date < nowAt(a.timezone).date) return fail("Pick a date from today onwards", 422);
  return ok(a, { headers: { "cache-control": "no-store" } });
}
