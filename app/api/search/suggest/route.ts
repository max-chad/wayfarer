import { ok } from "@/lib/api";
import { searchSuggestions } from "@/lib/data/places";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  return ok(searchSuggestions(q.slice(0, 100)));
}
