import { fail, ok } from "@/lib/api";
import { getCurrentWeather, getForecast } from "@/lib/services/weather";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("lat/lng required");
  const [days, current] = await Promise.all([getForecast(lat, lng), getCurrentWeather(lat, lng)]);
  if (!days) return fail("Forecast unavailable right now", 503);
  return ok({ days, current });
}
