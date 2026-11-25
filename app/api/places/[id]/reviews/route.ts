import { ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listReviews } from "@/lib/data/reviews";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const user = await getCurrentUser();
  const list = (k: string) => sp.get(k)?.split(",").filter(Boolean);
  const data = listReviews(Number(id), {
    rating: list("rating")?.map(Number),
    tripType: list("trip"),
    language: (sp.get("lang") as "en" | "other" | "all") || "all",
    season: (sp.get("season") as "spring" | "summer" | "autumn" | "winter") || undefined,
    q: sp.get("q") || undefined,
    withPhotos: sp.get("photos") === "1",
    sort: (sp.get("sort") as "recent" | "helpful" | "highest" | "lowest") || "recent",
    page: Number(sp.get("page") || 1),
    pageSize: 8,
    viewerId: user?.id,
  });
  return ok(data);
}
