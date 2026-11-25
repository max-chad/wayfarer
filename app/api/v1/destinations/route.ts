import { listDestinations } from "@/lib/data/destinations";
import { apiDestinationSummary, apiRoute } from "@/lib/public-api";

export const GET = apiRoute(async (req) => {
  const sp = new URL(req.url).searchParams;
  const month = Number(sp.get("month")) || undefined;
  const list = listDestinations({ continent: sp.get("continent") || undefined, q: sp.get("q") || undefined, month, vibe: sp.get("vibe") || undefined });
  return list.map((d) => apiDestinationSummary(d, new URL(req.url).origin));
});
