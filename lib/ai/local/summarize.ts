import type { PlaceType, ReviewSummary, TripType } from "@/lib/types";
import { MONTHS, TRIP_TYPE_LABELS, ratingLabel } from "@/lib/utils";
import { aspectIndex, keywordRe } from "./bank";
import { analyzeSentiment, splitSentences } from "./sentiment";

export interface SummaryInputReview {
  id: number;
  rating: number;
  title: string;
  body: string;
  trip_type: TripType;
  visit_date: string;
  helpful_count: number;
  language: string;
  translation: string | null;
}

// Human phrasing for pros/cons per aspect (positive, negative)
const PHRASES: Record<string, [string, string]> = {
  location: ["Excellent, walkable location", "Location is a little out of the way"],
  cleanliness: ["Spotlessly clean", "Cleanliness could be better"],
  staff: ["Warm, helpful staff", "Service can be hit-and-miss"],
  room: ["Comfortable, well-designed rooms", "Rooms feel small or dated"],
  bed: ["Very comfortable beds", "Beds and pillows get complaints"],
  breakfast: ["Great breakfast spread", "Breakfast is underwhelming"],
  value: ["Good value for money", "Pricey for what you get"],
  noise: ["Quiet, restful nights", "Noise can be an issue at night"],
  amenities: ["Pool, spa & gym are a highlight", "Facilities need an upgrade"],
  checkin: ["Smooth check-in", "Slow check-in / check-out"],
  views: ["Memorable views", "Views don't live up to the hype"],
  wifi: ["Reliable Wi-Fi", "Patchy Wi-Fi"],
  food: ["Outstanding food", "Food quality is inconsistent"],
  service: ["Attentive, friendly service", "Service can be slow"],
  ambience: ["Lovely atmosphere", "Atmosphere falls flat"],
  wait: ["Short waits", "Expect long waits for a table"],
  drinks: ["Great drinks list", "Drinks are overpriced"],
  dessert: ["Desserts worth saving room for", "Desserts are forgettable"],
  portions: ["Generous portions", "Portions are on the small side"],
  menu: ["Varied menu with dietary options", "Limited menu choices"],
  crowds: ["Manageable crowds", "Very crowded at peak times"],
  history: ["Fascinating history & great information", "Little context or signage"],
  accessibility: ["Accessible for most visitors", "Tricky access (stairs, uneven ground)"],
  timing: ["Easy to fit into a day", "Opening hours can be restrictive"],
  facilities: ["Good facilities (toilets, café, shop)", "Facilities are limited"],
  photos: ["Superb photo opportunities", "Hard to get a good photo"],
  kids: ["Great for kids", "Not ideal with young children"],
  queue: ["Queues move quickly", "Long queues — book ahead"],
  guide: ["Knowledgeable, entertaining guides", "Guide quality varies"],
  organization: ["Well organised", "Logistics could be smoother"],
  groupSize: ["Small, relaxed groups", "Groups can feel too big"],
  highlights: ["Unforgettable highlights", "Highlights feel rushed"],
  pace: ["Well-judged pace", "Pace is too rushed"],
  meetingPoint: ["Easy-to-find meeting point", "Meeting point is confusing"],
  safety: ["Felt safe throughout", "Safety briefing felt thin"],
};

export function summarizeReviewsLocal(place: { name: string; type: PlaceType; rating: number }, reviews: SummaryInputReview[]): ReviewSummary {
  const idx = aspectIndex(place.type);
  const agg = new Map<string, { label: string; pos: number; neg: number; n: number; sum: number; best?: { text: string; id: number; rating: number; score: number } }>();
  for (const a of idx) agg.set(a.key, { label: a.label, pos: 0, neg: 0, n: 0, sum: 0 });

  const monthly = new Map<number, { n: number; sum: number }>();
  const tripPositive = new Map<TripType, number>();
  const tripTotal = new Map<TripType, number>();

  for (const r of reviews) {
    const text = r.language !== "en" && r.translation ? (JSON.parse(r.translation) as { body: string }).body : r.body;
    const m = Number(r.visit_date.slice(5, 7));
    const mm = monthly.get(m) || { n: 0, sum: 0 };
    mm.n++;
    mm.sum += r.rating;
    monthly.set(m, mm);
    tripTotal.set(r.trip_type, (tripTotal.get(r.trip_type) || 0) + 1);
    if (r.rating >= 4) tripPositive.set(r.trip_type, (tripPositive.get(r.trip_type) || 0) + 1);

    for (const sentence of splitSentences(text)) {
      if (/^tip:/i.test(sentence)) continue;
      const lower = sentence.toLowerCase();
      const matched = idx.filter((a) => a.keywords.some((k) => keywordRe(k).test(lower)));
      if (!matched.length) continue;
      const s = analyzeSentiment(sentence);
      // blend sentence sentiment with the review's star rating for robustness
      const score = s.score * 0.7 + ((r.rating - 3) / 2) * 0.3;
      for (const a of matched) {
        const g = agg.get(a.key)!;
        g.n++;
        g.sum += score;
        if (score > 0.15) g.pos++;
        else if (score < -0.15) g.neg++;
        const quality = Math.abs(score) + r.helpful_count * 0.02 - Math.abs(sentence.length - 110) / 400;
        if (sentence.length >= 40 && sentence.length <= 190 && (!g.best || quality > g.best.score)) {
          g.best = { text: sentence, id: r.id, rating: r.rating, score: quality };
        }
      }
    }
  }

  const aspects = [...agg.entries()]
    .filter(([, g]) => g.n >= 2)
    .map(([key, g]) => {
      const avg = g.sum / g.n;
      const score = Math.max(1, Math.min(5, Math.round((3 + avg * 2.2) * 10) / 10));
      const sentiment: "positive" | "mixed" | "negative" = avg > 0.22 ? "positive" : avg < -0.12 ? "negative" : "mixed";
      return { key, label: g.label, score, mentions: g.n, sentiment, best: g.best, pos: g.pos, neg: g.neg };
    })
    .sort((a, b) => b.mentions - a.mentions);

  const pros = aspects
    .filter((a) => a.sentiment === "positive" && a.mentions >= 3)
    .sort((a, b) => b.score * Math.log(1 + b.mentions) - a.score * Math.log(1 + a.mentions))
    .slice(0, 4);
  const cons = aspects
    .filter((a) => (a.sentiment === "negative" || (a.sentiment === "mixed" && a.neg >= 2)) && a.mentions >= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const total = reviews.length;
  const bestFor = [...tripTotal.entries()]
    .map(([tripType, n]) => ({ tripType, share: Math.round(((tripPositive.get(tripType) || 0) / Math.max(1, total)) * 100), n }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3)
    .map(({ tripType, share }) => ({ tripType, share }));

  const bestMonths = [...monthly.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([m, v]) => ({ m, avg: v.sum / v.n }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 2)
    .map((x) => MONTHS[x.m - 1]);

  const proLabel = (a: (typeof aspects)[number]) => (PHRASES[a.key]?.[0] || `${a.label} is a highlight`).toLowerCase();
  const conLabel = (a: (typeof aspects)[number]) => (PHRASES[a.key]?.[1] || `${a.label} gets mixed feedback`).toLowerCase();

  const verdict = ratingLabel(place.rating).toLowerCase();
  const typeWord = { hotel: "guests", restaurant: "diners", attraction: "visitors", experience: "travelers" }[place.type];
  let summary = `Across ${total} reviews, ${typeWord} rate ${place.name} ${place.rating.toFixed(1)}/5 — ${verdict} overall.`;
  if (pros.length) summary += ` The most consistent praise is for ${joinList(pros.slice(0, 3).map(proLabel))}.`;
  if (cons.length) summary += ` On the flip side, some mention that ${conLabel(cons[0]).replace(/^(\w)/, (c) => c.toLowerCase())}${cons[1] ? ` and ${conLabel(cons[1])}` : ""}.`;
  if (bestFor.length) summary += ` It's especially popular with ${TRIP_TYPE_LABELS[bestFor[0].tripType].toLowerCase()} travelers`;
  if (bestMonths.length) summary += `${bestFor.length ? ", and" : " Visitors were"} happiest in ${joinList(bestMonths)}`;
  if (bestFor.length || bestMonths.length) summary += ".";

  const headline = pros.length
    ? `${capitalize(PHRASES[pros[0].key]?.[0] || pros[0].label)}${cons.length ? `, but ${conLabel(cons[0])}` : ""}`
    : place.rating >= 4
      ? `${ratingLabel(place.rating)} and well-loved by ${typeWord}`
      : `Mixed feedback from ${typeWord}`;

  const quotes = [...pros, ...cons]
    .map((a) => a.best)
    .filter(Boolean)
    .slice(0, 4)
    .map((b) => ({ text: b!.text, reviewId: b!.id, rating: b!.rating }));

  return {
    headline,
    summary,
    pros: pros.map((a) => PHRASES[a.key]?.[0] || `${a.label} is a highlight`),
    cons: cons.map((a) => PHRASES[a.key]?.[1] || `${a.label} gets mixed feedback`),
    bestFor,
    aspects: aspects.slice(0, 8).map(({ key, label, score, mentions, sentiment }) => ({ key, label, score, mentions, sentiment })),
    quotes,
    provider: "local",
    basedOn: total,
  };
}

function joinList(xs: string[]) {
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
