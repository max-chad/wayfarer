import { listPlaces } from "@/lib/data/places";
import { apiError, apiPlace, apiRoute } from "@/lib/public-api";
import type { PlaceType } from "@/lib/types";

const TYPES = ["hotel", "restaurant", "attraction", "experience"];

export const GET = apiRoute(async (req) => {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const type = sp.get("type");
  if (type && !TYPES.includes(type)) return apiError(422, `type must be one of ${TYPES.join(", ")}`);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const q = sp.get("q") || undefined;
  const { items, total } = listPlaces({
    destinationSlug: sp.get("destination") || undefined,
    type: (type as PlaceType) || undefined,
    minRating: sp.get("min_rating") ? Number(sp.get("min_rating")) : undefined,
    q,
    sort: q ? "relevance" : "ranking",
    limit,
    offset,
  });
  return { total, limit, offset, items: items.map((p) => apiPlace(p, url.origin)) };
});
