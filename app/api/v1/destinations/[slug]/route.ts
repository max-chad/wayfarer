import { getDestination } from "@/lib/data/destinations";
import { apiDestination, apiError, apiRoute } from "@/lib/public-api";

export const GET = apiRoute(async (req, _auth, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const d = getDestination(slug);
  if (!d) return apiError(404, `Unknown destination "${slug}"`);
  return apiDestination(d, new URL(req.url).origin);
});
