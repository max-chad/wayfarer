import { ok } from "@/lib/api";
import { listPlaces } from "@/lib/data/places";
import type { PlaceType } from "@/lib/types";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") as PlaceType | null;
  const q = sp.get("q")?.trim() || undefined;
  const { items, total } = listPlaces({
    destinationSlug: sp.get("destination") || undefined,
    type: type || undefined,
    q,
    sort: q ? "relevance" : (sp.get("sort") as "rating") || "rating",
    limit: Math.min(50, Number(sp.get("limit") || 12)),
  });
  return ok({ items, total });
}
