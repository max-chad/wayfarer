// AI feature layer: each feature has a Claude implementation (structured outputs) and a local fallback.
import { z } from "zod";
import { allDestinationNames } from "../data/destinations";
import { cacheGet, cacheSet } from "../data/misc";
import { reviewsForAnalysis } from "../data/reviews";
import type { Destination, Itinerary, ItineraryDay, Place, PlaceCardData, PlanRequest, ReviewSummary } from "../types";
import { MONTHS, formatUsd, priceSymbols, TRIP_TYPE_LABELS } from "../utils";
import { claudeJson, claudeText, withAi } from "./claude";
import { keywordRe } from "./local/bank";
import { parseTravelQuery, type ParsedQuery } from "./local/nlu";
import { computeCosts, hhmm, planItinerary, stopCost, toMinutes, type DayWeather, type PlannerDestination, type PlannerPlace } from "./local/planner";
import { analyzeSentiment, splitSentences, tokenize } from "./local/sentiment";
import { summarizeReviewsLocal } from "./local/summarize";
import { draftOwnerReply, type OwnerReplyInput } from "./local/owner";
import { draftFromNotes, polishText, suggestTitles } from "./local/writer";

// ─────────────────────────────────────────────────────────────── review summary

const SummarySchema = z.object({
  headline: z.string().describe("One punchy line, max 90 characters"),
  summary: z.string().describe("3-4 sentence neutral synthesis of what reviewers say"),
  pros: z.array(z.string()).describe("3-4 short pros, each under 45 characters"),
  cons: z.array(z.string()).describe("1-3 short cons, each under 45 characters"),
  quotes: z.array(z.object({ reviewId: z.number().int(), text: z.string() })).describe("2-3 short verbatim sentences copied from the reviews"),
});

export async function getReviewSummary(place: Pick<Place, "id" | "name" | "type" | "rating" | "reviewCount" | "category" | "destinationName">) {
  const key = `summary:v2:${place.id}:${place.reviewCount}`;
  const cached = cacheGet<ReviewSummary>(key);
  if (cached) return cached.value;
  const reviews = reviewsForAnalysis(place.id);
  if (!reviews.length) return null;
  const local = summarizeReviewsLocal(place, reviews);

  const { result } = await withAi<ReviewSummary>(
    "review-summary",
    async () => {
      const sample = reviews.slice(0, 70);
      const text = sample
        .map((r) => {
          const body = r.language !== "en" && r.translation ? (JSON.parse(r.translation) as { body: string }).body : r.body;
          return `[#${r.id}] ${r.rating}★ (${r.trip_type}, ${r.visit_date}) ${r.title} — ${body.replace(/\s+/g, " ").slice(0, 420)}`;
        })
        .join("\n");
      const out = await claudeJson({
        feature: "review-summary",
        system:
          "You summarise traveler reviews for a travel website. Be balanced and specific, never invent facts that aren't in the reviews, and write in plain, friendly English.",
        prompt: `Place: ${place.name} (${place.category}, ${place.destinationName}). Average rating ${place.rating}/5 from ${place.reviewCount} reviews.\nDetected aspect scores: ${local.aspects
          .map((a) => `${a.label} ${a.score}/5 (${a.mentions} mentions)`)
          .join("; ")}\n\nReviews:\n${text}`,
        schema: SummarySchema,
      });
      const ids = new Set(sample.map((r) => r.id));
      return {
        ...local,
        headline: out.headline,
        summary: out.summary,
        pros: out.pros.slice(0, 4),
        cons: out.cons.slice(0, 3),
        quotes: out.quotes.filter((q) => ids.has(q.reviewId)).map((q) => ({ ...q, rating: sample.find((r) => r.id === q.reviewId)!.rating })),
        provider: "claude",
      };
    },
    () => local
  );
  cacheSet(key, result, result.provider);
  return result;
}

// ─────────────────────────────────────────────────────────────── trip planner

const ItinerarySchema = z.object({
  title: z.string(),
  summary: z.string().describe("2-3 sentences describing the shape of the trip"),
  hotelPlaceId: z.number().int().nullable(),
  days: z.array(
    z.object({
      day: z.number().int(),
      title: z.string().describe("Evocative day title, max 50 chars"),
      theme: z.string(),
      stops: z.array(
        z.object({
          placeId: z.number().int().nullable().describe("id from the candidate list, or null for a free-form activity"),
          title: z.string(),
          kind: z.string().describe('One of "place", "meal", "note", "transport"'),
          startTime: z.string().describe("HH:MM 24h"),
          durationMin: z.number().int(),
          note: z.string().describe("One helpful sentence: why, what to order/see, a tip"),
        })
      ),
    })
  ),
  tips: z.array(z.string()).describe("3-5 practical tips for this specific trip"),
});

export async function planTrip(req: PlanRequest, dest: PlannerDestination, places: PlannerPlace[], weather: DayWeather[] = []): Promise<Itinerary> {
  const local = planItinerary(req, dest, places, weather);
  const { result } = await withAi<Itinerary>(
    "planner",
    async () => {
      const byId = new Map(places.map((p) => [p.id, p]));
      const line = (p: PlannerPlace) =>
        `${p.id} | ${p.type} | ${p.name} | ${p.category} | ${p.neighborhood || "-"} | ${p.lat.toFixed(4)},${p.lng.toFixed(4)} | ★${p.rating} (${p.reviewCount}) | ${
          p.type === "hotel" ? `$${p.priceUsd}/night` : p.type === "restaurant" ? priceSymbols(p.priceLevel) + " " + (p.details.meals || []).join("/") : p.priceUsd ? `$${p.priceUsd}` : "free"
        } | ${p.details.bestTime || "-"} | ${p.details.durationMin ? p.details.durationMin + "min" : "-"} | ${p.tags.slice(0, 5).join(",")}`;
      const draft = local.days
        .map((d) => `Day ${d.day}: ${d.stops.map((s) => `${s.startTime} ${s.title}${s.placeId ? ` (#${s.placeId})` : ""}`).join(" → ")}`)
        .join("\n");
      const out = await claudeJson({
        feature: "planner",
        effort: "medium",
        system:
          "You are an expert travel planner. Build realistic, geographically sensible day-by-day itineraries using ONLY the candidate places provided (reference them by id). Respect opening-hour common sense, travel time, the traveler's pace and budget, and meal times (breakfast optional, lunch ~12:30-14:00, dinner ~19:00-21:00). Group nearby places on the same day. Include one lunch and one dinner per day from the restaurant candidates, never repeating a restaurant.",
        prompt: `Trip request:
- Destination: ${dest.name}
- Days: ${req.days}${req.startDate ? ` starting ${req.startDate}` : ""}
- Travelers: ${req.travelers} (${req.tripType})
- Budget: ${req.budget}; pace: ${req.pace}
- Interests: ${req.interests.join(", ") || "general sightseeing"}
${req.dietary?.length ? `- Dietary: ${req.dietary.join(", ")}\n` : ""}${req.notes ? `- Notes from traveler: ${req.notes}\n` : ""}${req.mustSee?.length ? `- Must-see place ids: ${req.mustSee.join(", ")}\n` : ""}${
          weather.length ? `- Weather by day: ${weather.map((w, i) => `D${i + 1} ${w.summary} ${w.tmax}°C rain ${w.precipProb}%`).join("; ")}\n` : ""
        }
Candidate places (id | type | name | category | neighbourhood | lat,lng | rating | price | best time | typical duration | tags):
${[...places].filter((p) => p.type !== "hotel").sort((a, b) => b.rating * Math.log(2 + b.reviewCount) - a.rating * Math.log(2 + a.reviewCount)).slice(0, 70).map(line).join("\n")}

Hotels:
${places.filter((p) => p.type === "hotel").map(line).join("\n")}

A draft produced by our routing engine (you may improve it):
${draft}

Return exactly ${req.days} days.`,
        schema: ItinerarySchema,
        maxTokens: 20000,
      });

      const days: ItineraryDay[] = out.days.slice(0, req.days).map((d, i) => ({
        day: i + 1,
        title: d.title,
        theme: d.theme,
        stops: d.stops
          .map((s) => {
            const p = s.placeId ? byId.get(s.placeId) : undefined;
            const rawKind = (["place", "meal", "note", "transport"].includes(s.kind) ? s.kind : "place") as ItineraryDay["stops"][number]["kind"];
            const kind = p ? (p.type === "restaurant" ? "meal" : rawKind === "note" ? "place" : rawKind) : s.placeId ? "note" : rawKind === "place" ? "note" : rawKind;
            const start = toMinutes(s.startTime);
            return {
              placeId: p ? p.id : null,
              title: p ? p.name : s.title,
              kind,
              startTime: start != null ? hhmm(start) : "10:00",
              durationMin: Math.max(15, Math.min(600, s.durationMin || 60)),
              note: s.note,
              costUsd: p ? stopCost(p, kind, req) : 0,
            } as ItineraryDay["stops"][number];
          })
          .sort((a, b) => (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0)),
      }));
      if (days.length < req.days) days.push(...local.days.slice(days.length));
      const hotel = out.hotelPlaceId && byId.get(out.hotelPlaceId)?.type === "hotel" ? byId.get(out.hotelPlaceId)! : places.find((p) => p.id === local.hotelPlaceId) || null;
      return {
        destinationSlug: dest.slug,
        title: out.title,
        summary: out.summary,
        days,
        hotelPlaceId: hotel?.id ?? null,
        estimatedCostUsd: computeCosts(days, hotel, dest, req),
        tips: out.tips.slice(0, 5),
        provider: "claude",
      };
    },
    () => local
  );
  return result;
}

// ─────────────────────────────────────────────────────────────── search interpretation

const QuerySchema = z.object({
  destination: z.string().nullable().describe("Exact destination name from the list, or null"),
  type: z.string().nullable().describe('One of "hotel", "restaurant", "attraction", "experience", or null'),
  tags: z.array(z.string()).describe("From: romantic, family-friendly, views, sunset, rooftop, quiet, lively, hidden-gem, local-favorite, free, rainy-day, vegetarian-friendly, pool, spa, wine, street-food, nightlife, pet-friendly, accessible, eco-friendly, instagrammable, history, art, workspace, live-music, waterfront, fine-dining, iconic, coffee, luxury, budget"),
  priceLevels: z.array(z.number().int().min(1).max(4)),
  minRating: z.number().nullable(),
  keywords: z.string().describe("Short keywords for full-text search such as a cuisine or category, or empty"),
  interpretation: z.string().describe("Short human-readable description of the search, e.g. 'Romantic restaurants in Paris with a view'"),
});

export async function interpretQuery(q: string): Promise<ParsedQuery & { provider: "claude" | "local" }> {
  const dests = allDestinationNames();
  const local = parseTravelQuery(q, dests);
  const wordCount = q.trim().split(/\s+/).length;
  if (wordCount < 4) return { ...local, provider: "local" };
  const key = `query:v1:${q.trim().toLowerCase()}`;
  const cached = cacheGet<ParsedQuery>(key, 24 * 7);
  if (cached) return { ...cached.value, provider: cached.provider as "claude" | "local" };
  const { result, provider } = await withAi<ParsedQuery>(
    "search-interpret",
    async () => {
      const out = await claudeJson({
        feature: "search-interpret",
        system: "You convert a traveler's natural-language search into structured filters for a travel database. Only use tags from the allowed list. Leave filters empty when not implied.",
        prompt: `Available destinations: ${dests.map((d) => d.name).join(", ")}\n\nSearch: "${q}"`,
        schema: QuerySchema,
      });
      const d = out.destination ? dests.find((x) => x.name.toLowerCase() === out.destination!.toLowerCase()) : undefined;
      return {
        ...local,
        destinationSlug: d?.slug ?? local.destinationSlug,
        destinationName: d?.name ?? local.destinationName,
        type: (["hotel", "restaurant", "attraction", "experience"].includes(out.type || "") ? (out.type as ParsedQuery["type"]) : undefined) ?? local.type,
        tags: out.tags,
        priceLevels: out.priceLevels.length ? out.priceLevels : undefined,
        minRating: out.minRating ?? undefined,
        keywords: out.keywords,
        interpretation: out.interpretation,
        intent: "search",
      };
    },
    () => local
  );
  cacheSet(key, result, provider);
  return { ...result, provider };
}

// ─────────────────────────────────────────────────────────────── Q&A

export async function answerPlaceQuestion(place: Place, question: string) {
  const reviews = reviewsForAnalysis(place.id, 300);
  const qTokens = new Set(tokenize(question).filter((t) => t.length > 3));
  const scored: { text: string; score: number; id: number; rating: number }[] = [];
  for (const r of reviews) {
    const body = r.language !== "en" && r.translation ? (JSON.parse(r.translation) as { body: string }).body : r.body;
    for (const s of splitSentences(body)) {
      const toks = tokenize(s);
      const overlap = toks.filter((t) => qTokens.has(t) || [...qTokens].some((q) => t.startsWith(q.slice(0, 5)) && q.length > 5)).length;
      if (overlap) scored.push({ text: s, score: overlap + r.helpful_count * 0.01, id: r.id, rating: r.rating });
    }
  }
  const evidence = scored.sort((a, b) => b.score - a.score).slice(0, 10);
  const facts = placeFacts(place);

  return withAi(
    "place-qa",
    async () =>
      claudeText({
        feature: "place-qa",
        system:
          "You answer travelers' questions about a specific place using ONLY the facts and review excerpts provided. Answer in 1-3 friendly sentences (max 80 words). If the information isn't available, say so honestly and suggest how to find out. Don't use markdown headings.",
        prompt: `Place facts:\n${facts}\n\nRelevant review excerpts:\n${evidence.map((e) => `- (${e.rating}★) ${e.text}`).join("\n") || "(none)"}\n\nQuestion: ${question}`,
        maxTokens: 2000,
      }),
    () => localAnswer(place, question, evidence)
  );
}

function placeFacts(p: Place) {
  const d = p.details;
  return [
    `${p.name} — ${p.category} in ${p.neighborhood ? p.neighborhood + ", " : ""}${p.destinationName}. Rated ${p.rating}/5 from ${p.reviewCount} reviews.`,
    p.description,
    d.hours ? `Hours: ${d.hours}` : "",
    p.type === "hotel" ? `From ${formatUsd(p.priceUsd)} per night. ${d.stars ? d.stars + "-star" : ""} ${d.style || ""}.` : p.priceUsd ? `Price: ${formatUsd(p.priceUsd)}` : p.type === "attraction" ? "Free entry." : "",
    p.amenities.length ? `Amenities: ${p.amenities.join(", ")}` : "",
    d.durationMin ? `Typical visit: ${d.durationMin} minutes` : "",
    d.bookingTip ? `Booking tip: ${d.bookingTip}` : "",
    d.accessibility ? `Accessibility: ${d.accessibility}` : "",
    d.signatureDish ? `Signature dish: ${d.signatureDish}` : "",
    d.meals?.length ? `Serves: ${d.meals.join(", ")}` : "",
    d.dietary?.length ? `Dietary options: ${d.dietary.join(", ")}` : "",
    d.includes?.length ? `Includes: ${d.includes.join(", ")}` : "",
    p.tags.length ? `Tags: ${p.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function localAnswer(p: Place, question: string, evidence: { text: string; rating: number }[]) {
  const q = question.toLowerCase();
  const d = p.details;
  const parts: string[] = [];
  if (/hour|open|close|time/.test(q) && d.hours) parts.push(`Opening hours are ${d.hours}.`);
  if (/book|reserv|ticket|queue|line/.test(q) && d.bookingTip) parts.push(d.bookingTip);
  if (/wheelchair|accessib|stairs|mobility/.test(q) && d.accessibility)
    parts.push(`Accessibility is rated "${d.accessibility}"${d.accessibility === "limited" ? " — expect stairs or uneven ground" : ""}.`);
  if (/long|how much time|duration/.test(q) && d.durationMin) parts.push(`Most visitors spend about ${Math.round(d.durationMin / 60 * 10) / 10} hours here.`);
  if (/price|cost|expensive|cheap|how much/.test(q)) parts.push(p.type === "hotel" ? `Rooms start from about ${formatUsd(p.priceUsd)} per night.` : p.priceUsd ? `Expect around ${formatUsd(p.priceUsd)}.` : "It's free to visit.");
  if (/veg|vegan|gluten|halal|kosher|diet/.test(q)) parts.push(d.dietary?.length ? `They cater for ${d.dietary.join(", ")} diets.` : "No specific dietary options are listed — best to ask ahead.");
  if (/breakfast/.test(q) && p.type === "hotel") parts.push(p.amenities.includes("Breakfast included") ? "Breakfast is included in the rate." : "Breakfast isn't listed as included.");
  if (/pool|spa|gym|parking|wifi|wi-fi|shuttle|pet/.test(q) && p.type === "hotel") {
    const hits = p.amenities.filter((a) => q.split(/\W+/).some((w) => w.length > 2 && a.toLowerCase().includes(w)));
    parts.push(hits.length ? `Yes — amenities include ${hits.join(", ")}.` : "That amenity isn't listed for this hotel.");
  }
  if (/kid|child|family/.test(q)) parts.push(p.tags.includes("family-friendly") || p.tags.includes("kid-friendly") ? "It's considered family-friendly." : "It isn't specifically tagged as family-friendly.");
  const quote = evidence.find((e) => analyzeSentiment(e.text).label !== "neutral");
  if (quote) parts.push(`One traveler wrote: "${quote.text}"`);
  if (!parts.length) parts.push(`I couldn't find a definite answer in the listing or ${p.reviewCount} reviews — the community may be able to help below.`);
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────── review writing assistant

const DraftSchema = z.object({ title: z.string(), body: z.string() });
const TitlesSchema = z.object({ titles: z.array(z.string()) });

export async function reviewAssist(
  action: "draft" | "polish" | "titles",
  input: { notes?: string; body?: string; title?: string; rating: number; placeName: string; placeType: Place["type"]; tripType?: string }
) {
  const system =
    "You help travelers write honest, specific, readable reviews in their own voice. Never invent experiences the traveler didn't mention; keep their meaning and sentiment; no marketing tone; no emojis; first person.";
  if (action === "draft") {
    return withAi(
      "review-draft",
      () =>
        claudeJson({
          feature: "review-draft",
          system,
          prompt: `Turn these rough notes into a review of ${input.placeName} (${input.placeType}). Star rating: ${input.rating}/5. Trip type: ${input.tripType || "unspecified"}. 90-170 words, 2 short paragraphs, plus a catchy but honest title.\n\nNotes:\n${input.notes}`,
          schema: DraftSchema,
        }),
      () => draftFromNotes({ notes: input.notes || "", rating: input.rating, placeName: input.placeName, placeType: input.placeType, tripType: input.tripType })
    );
  }
  if (action === "polish") {
    return withAi(
      "review-polish",
      () =>
        claudeJson({
          feature: "review-polish",
          system,
          prompt: `Polish this ${input.rating}-star review of ${input.placeName}: fix grammar, spelling and flow, keep it the same length or shorter, keep every fact and the author's voice.\n\nTitle: ${input.title || ""}\nReview:\n${input.body}`,
          schema: DraftSchema,
        }),
      () => ({ title: polishText(input.title || "").replace(/\.$/, ""), body: polishText(input.body || "") })
    );
  }
  return withAi(
    "review-titles",
    async () =>
      (
        await claudeJson({
          feature: "review-titles",
          system,
          prompt: `Suggest 4 short, specific review titles (max 60 chars) for this ${input.rating}-star review of ${input.placeName}:\n\n${input.body}`,
          schema: TitlesSchema,
        })
      ).titles,
    () => suggestTitles({ body: input.body || "", rating: input.rating, placeType: input.placeType })
  );
}

// ─────────────────────────────────────────────────────────────── compare

const CompareSchema = z.object({
  verdict: z.string().describe("2-3 sentence overall recommendation"),
  picks: z.array(z.object({ placeId: z.number().int(), bestFor: z.string().describe("who/what this option is best for, max 60 chars") })),
});

export async function comparePlaces(places: (PlaceCardData & { amenities?: string[] })[], aspects: Record<number, Record<string, number>>) {
  const local = () => {
    const byRating = [...places].sort((a, b) => b.rating - a.rating);
    const cheapest = [...places].sort((a, b) => a.priceUsd - b.priceUsd || a.priceLevel - b.priceLevel)[0];
    const mostReviewed = [...places].sort((a, b) => b.reviewCount - a.reviewCount)[0];
    const picks = places.map((p) => {
      const sub = aspects[p.id] || {};
      const bestAspect = Object.entries(sub).sort((a, b) => b[1] - a[1])[0];
      const bestFor =
        p.id === cheapest.id && places.length > 1
          ? "Best value"
          : p.id === byRating[0].id
            ? "Highest rated overall"
            : bestAspect
              ? `Strongest on ${bestAspect[0].toLowerCase()}`
              : p.tags[0]
                ? `Great if you want ${p.tags[0].replace(/-/g, " ")}`
                : "A solid all-rounder";
      return { placeId: p.id, bestFor };
    });
    const verdict = `${byRating[0].name} edges it on ratings (${byRating[0].rating.toFixed(1)}★)${
      cheapest.id !== byRating[0].id ? `, while ${cheapest.name} is the budget-friendly pick` : " and is also the best value"
    }. ${mostReviewed.name} has the most traveler feedback (${mostReviewed.reviewCount} reviews), so it's the safest bet if you want predictability.`;
    return { verdict, picks };
  };
  return withAi(
    "compare",
    () =>
      claudeJson({
        feature: "compare",
        system: "You compare travel options for a traveler and give a crisp, fair recommendation based only on the data provided.",
        prompt: places
          .map(
            (p) =>
              `#${p.id} ${p.name} (${p.category}, ${p.destinationName}) — ★${p.rating} from ${p.reviewCount} reviews; price ${p.type === "hotel" ? formatUsd(p.priceUsd) + "/night" : priceSymbols(p.priceLevel)}; tags: ${p.tags.join(", ")}; sub-ratings: ${Object.entries(aspects[p.id] || {})
                .map(([k, v]) => `${k} ${v}`)
                .join(", ")}${p.amenities?.length ? `; amenities: ${p.amenities.join(", ")}` : ""}`
          )
          .join("\n"),
        schema: CompareSchema,
      }),
    local
  );
}

// ─────────────────────────────────────────────────────────────── translation

export async function translateReview(review: { title: string; body: string; language: string; translation: { title: string; body: string } | null }, target = "English") {
  if (review.translation && target === "English") return { result: review.translation, provider: "cache" as const };
  const { result, provider } = await withAi<{ title: string; body: string } | null>(
    "translate",
    () =>
      claudeJson({
        feature: "translate",
        system: "You translate traveler reviews faithfully and naturally, preserving tone. Return only the translation.",
        prompt: `Translate this review into ${target}.\n\nTitle: ${review.title}\n\nReview: ${review.body}`,
        schema: DraftSchema,
      }),
    () => null
  );
  return { result, provider };
}

// ─────────────────────────────────────────────────────────────── destination brief

export interface DestinationBrief {
  overview: string;
  perfectFor: string[];
  highlights: string[];
  heads_up: string;
  provider: "claude" | "local";
}

const BriefSchema = z.object({
  overview: z.string().describe("3 sentences: vibe, what makes it special, who it suits"),
  perfectFor: z.array(z.string()).describe("3 short traveler types"),
  highlights: z.array(z.string()).describe("4 short must-do highlights, each under 60 chars"),
  heads_up: z.string().describe("One honest caveat or practical warning"),
});

export async function destinationBrief(d: Destination, topNames: string[]): Promise<DestinationBrief> {
  const key = `brief:v1:${d.slug}`;
  const cached = cacheGet<DestinationBrief>(key, 24 * 60);
  if (cached) return cached.value;
  const best = d.info.bestMonths.map((m) => MONTHS[m - 1]);
  const local: DestinationBrief = {
    overview: `${d.name} is ${d.tagline.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())}. It shines for ${d.vibes.slice(0, 3).join(", ")}, with ${
      topNames.length ? topNames.slice(0, 2).join(" and ") : "its iconic sights"
    } topping most travelers' lists. Plan around ${best.slice(0, 3).join(", ")} for the best weather, and budget roughly ${formatUsd(d.info.dailyBudgetUSD.midrange)} a day for a comfortable mid-range trip.`,
    perfectFor: d.vibes.slice(0, 3).map((v) => `${v.charAt(0).toUpperCase() + v.slice(1)} lovers`),
    highlights: topNames.slice(0, 4),
    heads_up: d.info.safety?.notes || d.info.tips?.[0] || "",
    provider: "local",
  };
  const { result } = await withAi<DestinationBrief>(
    "destination-brief",
    async () => ({
      ...(await claudeJson({
        feature: "destination-brief",
        system: "You are a seasoned travel editor writing concise, vivid, genuinely useful destination briefs. No clichés like 'hidden gem' or 'something for everyone'.",
        prompt: `Destination: ${d.name}, ${d.country}. Tagline: ${d.tagline}. Vibes: ${d.vibes.join(", ")}. Best months: ${best.join(", ")}. Mid-range budget ${formatUsd(d.info.dailyBudgetUSD.midrange)}/day. Top-rated sights: ${topNames.join(", ")}. Safety: ${d.info.safety.notes}. Local tips: ${d.info.tips.join(" ")}`,
        schema: BriefSchema,
      })),
      provider: "claude" as const,
    }),
    () => local
  );
  cacheSet(key, result, result.provider);
  return result;
}

// ─────────────────────────────────────────────────────────────── owner replies (Wayfarer for Business)

export async function ownerReply(input: OwnerReplyInput) {
  const tone = input.tone || "warm";
  return withAi(
    "owner-reply",
    () =>
      claudeText({
        feature: "owner-reply",
        system:
          "You draft public replies from a business owner to a traveler's review. Be gracious, specific to what the reviewer actually wrote, and never defensive. Don't offer refunds, discounts or compensation, don't invent facts or promises, don't mention the review platform, and never ask the guest to change their review. Plain text, no emojis, no subject line.",
        prompt: `Business: ${input.placeName} (${input.placeType}). Reply as ${input.contactName}, ${input.contactRole}. Tone: ${tone}${tone === "brief" ? " (max 60 words)" : " (60-130 words)"}.
Greet the reviewer by first name and sign off with the name and role on separate lines.

Review by ${input.author} — ${input.rating}/5 — "${input.title}"
${input.body}`,
        effort: "low",
        maxTokens: 1200,
      }),
    () => draftOwnerReply(input)
  );
}

// ─────────────────────────────────────────────────────────────── helpers for UI

export function tripTypeLabel(t: string) {
  return TRIP_TYPE_LABELS[t] || t;
}

export function sentenceMentions(text: string, keywords: string[]) {
  return splitSentences(text).filter((s) => keywords.some((k) => keywordRe(k).test(s)));
}
