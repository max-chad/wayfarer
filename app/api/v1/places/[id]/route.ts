import { getPlace, getPlaceById } from "@/lib/data/places";
import { apiError, apiPlace, apiRoute } from "@/lib/public-api";

export const GET = apiRoute(async (req, _auth, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const p = /^\d+$/.test(id) ? getPlaceById(Number(id)) : getPlace(id);
  if (!p) return apiError(404, "Place not found");
  return {
    ...apiPlace(p, new URL(req.url).origin),
    description: p.description,
    amenities: p.amenities,
    details: p.details,
    aspect_scores: p.aspectScores,
    gallery: p.gallery.map((i) => ({ url: i.url, author: i.author, license: i.license, source: i.source })),
  };
});
