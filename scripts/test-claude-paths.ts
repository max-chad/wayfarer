// Exercises every Claude code path against the mock API (scripts/mock-anthropic.mjs) or the real API.
// Usage: ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 npx tsx scripts/test-claude-paths.ts
// Runs against a temporary copy of the database so cached AI output never leaks into the real one.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDb = path.join(os.tmpdir(), `wayfarer-ai-test-${Date.now()}.db`);
fs.copyFileSync(path.join(process.cwd(), "data", "wayfarer.db"), tmpDb);
process.env.DATABASE_PATH = tmpDb;

async function main() {
  const { aiProvider } = await import("../lib/ai/claude");
  const { runConcierge } = await import("../lib/ai/concierge");
  const { answerPlaceQuestion, comparePlaces, destinationBrief, getReviewSummary, interpretQuery, ownerReply, planTrip, reviewAssist } = await import("../lib/ai/features");
  const { db } = await import("../lib/db");
  const { getDestination } = await import("../lib/data/destinations");
  const { getPlace, getPlacesByIds, listPlaces } = await import("../lib/data/places");
  const { loadPlannerData } = await import("../lib/seed/demo");
  console.log("provider:", aiProvider(), "| db:", tmpDb);
  const place = getPlace("eiffel-tower-paris")!;

  // 1. concierge (streaming + tool loop)
  let text = "";
  const kinds: string[] = [];
  for await (const ev of runConcierge([{ role: "user", content: "romantic dinner in Paris" }], {})) {
    kinds.push(ev.type);
    if (ev.type === "text") text += ev.delta;
  }
  console.log("concierge events:", [...new Set(kinds)].join(","), "| text:", text.slice(0, 120));

  // 2. review summary (structured output)
  db().prepare("DELETE FROM ai_cache").run();
  const s = await getReviewSummary(place);
  console.log("summary:", s?.provider, "|", s?.headline, "| pros", s?.pros.length, "| quotes", s?.quotes.length);

  // 3. planner
  const pd = loadPlannerData(db(), "paris")!;
  const it = await planTrip({ destinationSlug: "paris", days: 2, travelers: 2, budget: "midrange", pace: "balanced", interests: ["art"], tripType: "couples" }, pd.dest, pd.places);
  console.log("planner:", it.provider, "| days", it.days.length, "| stops", it.days.map((d) => d.stops.length).join("/"), "| total $", it.estimatedCostUsd.total);

  // 4. search interpretation
  const q = await interpretQuery("quiet boutique hotel with a view in Lisbon");
  console.log("interpret:", q.provider, "|", q.interpretation, "| type", q.type);

  // 5. Q&A
  const qa = await answerPlaceQuestion(place, "Is it good for kids?");
  console.log("qa:", qa.provider, "|", String(qa.result).slice(0, 80));

  // 6. review assistant
  const d = await reviewAssist("draft", { notes: "great views, long queue", rating: 4, placeName: place.name, placeType: place.type });
  console.log("draft:", d.provider, "|", JSON.stringify(d.result).slice(0, 80));
  const t = await reviewAssist("titles", { body: "Great views but a long queue", rating: 4, placeName: place.name, placeType: place.type });
  console.log("titles:", t.provider, "|", JSON.stringify(t.result).slice(0, 80));

  // 7. compare
  const cards = getPlacesByIds(listPlaces({ destinationSlug: "paris", type: "hotel", limit: 2 }).items.map((i) => i.id));
  const c = await comparePlaces(cards, {});
  console.log("compare:", c.provider, "|", JSON.stringify(c.result).slice(0, 80));

  // 8. destination brief
  const dest = getDestination("paris")!;
  db().prepare("DELETE FROM ai_cache").run();
  const b = await destinationBrief(dest, ["Eiffel Tower", "Louvre"]);
  console.log("brief:", b.provider, "|", b.overview.slice(0, 60));

  // 9. owner reply (Wayfarer for Business)
  const o = await ownerReply({ author: "Camila R.", rating: 2, title: "Noisy room", body: "The staff were lovely but the room was noisy and the breakfast was cold.", placeName: "Hotel Test", placeType: "hotel", contactName: "Ana", contactRole: "General Manager" });
  console.log("owner-reply:", o.provider, "|", o.result.slice(0, 60).replace(/\s+/g, " "));
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.rmSync(tmpDb, { force: true });
    } catch {}
  });
