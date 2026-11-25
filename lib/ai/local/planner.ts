import { centroid, haversineKm, kmeans, orderRoute, routeLengthKm, travelMinutes, travelMode, type LatLng } from "@/lib/geo";
import type { BudgetStyle, DestinationInfo, Itinerary, ItineraryDay, ItineraryStop, PlaceDetails, PlaceType, PlanRequest } from "@/lib/types";
import { clamp, formatDuration, hashString } from "@/lib/utils";

export interface PlannerPlace {
  id: number;
  name: string;
  type: PlaceType;
  category: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  priceUsd: number;
  tags: string[];
  details: PlaceDetails;
  neighborhood: string;
}

export interface PlannerDestination {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  info: DestinationInfo;
}

export interface DayWeather {
  date: string;
  tmax: number;
  tmin: number;
  precipProb: number;
  summary: string;
}

const INTERESTS: Record<string, { cats: RegExp; tags: string[] }> = {
  art: { cats: /museum|gallery/i, tags: ["art"] },
  history: { cats: /historic|religious|landmark|museum|architecture/i, tags: ["history"] },
  culture: { cats: /museum|religious|historic|neighborhood|market|entertainment|class/i, tags: ["history", "art", "local-favorite"] },
  food: { cats: /market|food tour|class/i, tags: ["foodie", "street-food", "wine", "coffee"] },
  nightlife: { cats: /nightlife|entertainment/i, tags: ["nightlife", "live-music", "late-night", "lively"] },
  nature: { cats: /park|nature|beach|viewpoint|zoo|adventure/i, tags: ["nature", "outdoor", "eco-friendly"] },
  beach: { cats: /beach|cruise/i, tags: ["beach", "waterfront"] },
  adventure: { cats: /adventure|nature|day trip/i, tags: ["outdoor", "nature"] },
  shopping: { cats: /market|neighborhood/i, tags: ["shopping"] },
  family: { cats: /zoo|theme park|park|aquarium/i, tags: ["family-friendly", "kid-friendly"] },
  relaxation: { cats: /park|beach|wellness/i, tags: ["quiet", "spa"] },
  architecture: { cats: /architecture|landmark|religious|historic/i, tags: ["architecture"] },
  wellness: { cats: /wellness/i, tags: ["spa", "quiet"] },
  romantic: { cats: /viewpoint|cruise/i, tags: ["romantic", "sunset", "views"] },
  photography: { cats: /viewpoint|landmark/i, tags: ["instagrammable", "views", "sunset"] },
  hiking: { cats: /nature|park|adventure/i, tags: ["outdoor", "nature", "views"] },
  wine: { cats: /wine/i, tags: ["wine"] },
  budget: { cats: /^$/, tags: ["free", "budget"] },
  luxury: { cats: /^$/, tags: ["luxury", "fine-dining"] },
  festivals: { cats: /entertainment/i, tags: ["lively", "live-music"] },
};

const DEFAULT_DURATION: [RegExp, number][] = [
  [/museum/i, 150],
  [/gallery/i, 100],
  [/theme park/i, 300],
  [/zoo|aquarium/i, 180],
  [/beach/i, 180],
  [/nature/i, 180],
  [/park/i, 90],
  [/neighborhood/i, 120],
  [/market/i, 80],
  [/religious/i, 60],
  [/viewpoint/i, 60],
  [/architecture/i, 60],
  [/entertainment/i, 120],
];

const PER_DAY: Record<string, number> = { relaxed: 2, balanced: 3, packed: 4 };
const START_MIN: Record<string, number> = { relaxed: 600, balanced: 570, packed: 510 };
const PRICE_LEVELS: Record<BudgetStyle, number[]> = { budget: [1, 2], midrange: [2, 3], luxury: [3, 4] };

export function hhmm(min: number) {
  const m = Math.max(0, Math.round(min / 5) * 5);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function toMinutes(t: string | null | undefined) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationOf(p: PlannerPlace) {
  if (p.details.durationMin) return clamp(p.details.durationMin, 30, p.type === "experience" ? 600 : 360);
  for (const [re, d] of DEFAULT_DURATION) if (re.test(p.category)) return d;
  return 90;
}

function bayes(p: PlannerPlace) {
  return (8 * 4.2 + p.rating * p.reviewCount) / (8 + p.reviewCount);
}

function interestScore(p: PlannerPlace, interests: string[]) {
  let s = 0;
  for (const i of interests) {
    const rule = INTERESTS[i];
    if (!rule) continue;
    if (rule.cats.test(p.category)) s += 1.1;
    if (rule.tags.some((t) => p.tags.includes(t))) s += 0.9;
  }
  return s;
}

function scorePlace(p: PlannerPlace, req: PlanRequest, center: LatLng) {
  let s = (bayes(p) - 3.5) * 2.2 + interestScore(p, req.interests);
  if (p.tags.includes("iconic")) s += 1.2;
  if (req.mustSee?.includes(p.id)) s += 100;
  if (req.tripType === "family" && (p.tags.includes("family-friendly") || p.tags.includes("kid-friendly"))) s += 0.8;
  if (req.tripType === "couples" && p.tags.includes("romantic")) s += 0.7;
  if (req.budget === "budget" && p.priceUsd > 45) s -= 0.8;
  if (req.budget === "budget" && p.priceUsd === 0) s += 0.4;
  const far = haversineKm(center, p) > 25;
  if (far && req.days < 3) s -= 3;
  s += (hashString(`${p.id}:${req.destinationSlug}`) % 100) / 400; // tiny deterministic jitter
  return s;
}

export function planItinerary(
  req: PlanRequest,
  dest: PlannerDestination,
  places: PlannerPlace[],
  weather: DayWeather[] = []
): Itinerary {
  const days = clamp(Math.round(req.days) || 3, 1, 14);
  const travelers = clamp(req.travelers || 2, 1, 12);
  const center: LatLng = { lat: dest.lat, lng: dest.lng };
  const perDay = PER_DAY[req.pace] ?? 3;

  const activities = places.filter((p) => p.type === "attraction" || p.type === "experience");
  const restaurants = places.filter((p) => p.type === "restaurant");
  const hotels = places.filter((p) => p.type === "hotel");

  // ── selection with diversity penalty
  const scored = activities.map((p) => ({ p, s: scorePlace(p, req, center) })).sort((a, b) => b.s - a.s);
  const target = Math.min(activities.length, days * perDay);
  const maxExperiences = Math.max(1, Math.ceil(days / 2));
  const chosen: PlannerPlace[] = [];
  const catCount = new Map<string, number>();
  const pool = [...scored];
  while (chosen.length < target && pool.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    pool.forEach((x, i) => {
      const expCount = chosen.filter((c) => c.type === "experience").length;
      if (x.p.type === "experience" && expCount >= maxExperiences && !req.mustSee?.includes(x.p.id)) return;
      const penalty = (catCount.get(x.p.category) || 0) * 0.7;
      const v = x.s - penalty;
      if (v > bestScore) {
        bestScore = v;
        bestIdx = i;
      }
    });
    if (bestScore === -Infinity) break;
    const [pick] = pool.splice(bestIdx, 1);
    chosen.push(pick.p);
    catCount.set(pick.p.category, (catCount.get(pick.p.category) || 0) + 1);
  }

  // ── hotel
  const levels = PRICE_LEVELS[req.budget] || [2, 3];
  const actCenter = chosen.length ? centroid(chosen.filter((c) => haversineKm(center, c) < 25)) : center;
  const hotelCands = hotels.filter((h) => levels.includes(h.priceLevel));
  const hotel =
    (hotelCands.length ? hotelCands : hotels)
      .map((h) => ({ h, s: bayes(h) * 1.5 - haversineKm(actCenter, h) * 0.35 + (req.budget === "luxury" ? h.priceLevel * 0.2 : 0) }))
      .sort((a, b) => b.s - a.s)[0]?.h || null;
  const base: LatLng = hotel || actCenter;

  // ── day groups: far-away sights become dedicated day trips
  const dayTrips = chosen.filter((c) => haversineKm(center, c) > 25 && days >= 3).slice(0, Math.max(0, days - 1));
  const local = chosen.filter((c) => !dayTrips.includes(c));
  const localDays = Math.max(1, days - dayTrips.length);
  const groups = balancedClusters(local, localDays);
  while (groups.length < localDays) groups.push([]);

  // order groups: start with the one holding the best sight, then nearest-next
  const orderedGroups: PlannerPlace[][] = [];
  const remaining = [...groups];
  const firstIdx = remaining.findIndex((g) => g.includes(local[0]));
  orderedGroups.push(...remaining.splice(Math.max(0, firstIdx), 1));
  while (remaining.length) {
    const last = orderedGroups[orderedGroups.length - 1];
    const c = last.length ? centroid(last) : base;
    remaining.sort((a, b) => (a.length ? haversineKm(c, centroid(a)) : 99) - (b.length ? haversineKm(c, centroid(b)) : 99));
    orderedGroups.push(remaining.shift()!);
  }
  // insert day trips in the middle of the trip (never on the first day)
  const allGroups: { items: PlannerPlace[]; dayTrip: boolean }[] = orderedGroups.map((g) => ({ items: g, dayTrip: false }));
  dayTrips.forEach((dt, i) => allGroups.splice(Math.min(allGroups.length, 1 + i * 2), 0, { items: [dt], dayTrip: true }));

  // weather-aware: put the most indoor-heavy groups on the rainiest days
  if (weather.length >= allGroups.length) {
    const rainy = weather.slice(0, allGroups.length).map((w, i) => ({ i, p: w.precipProb }));
    const indoorShare = (g: PlannerPlace[]) => (g.length ? g.filter((x) => x.details.indoor).length / g.length : 0);
    const movable = allGroups.map((g, i) => ({ g, i })).filter((x) => !x.g.dayTrip);
    const wetDays = rainy.filter((r) => r.p >= 60 && !allGroups[r.i].dayTrip).sort((a, b) => b.p - a.p);
    for (const wd of wetDays) {
      const best = movable.filter((m) => m.i !== wd.i).sort((a, b) => indoorShare(b.g.items) - indoorShare(a.g.items))[0];
      if (best && indoorShare(best.g.items) > indoorShare(allGroups[wd.i].items) + 0.2) {
        const tmp = allGroups[wd.i];
        allGroups[wd.i] = allGroups[best.i];
        allGroups[best.i] = tmp;
      }
    }
  }

  // ── schedule each day
  const usedRestaurants = new Set<number>();
  const pickRestaurant = (near: LatLng, meal: "lunch" | "dinner" | "breakfast") => {
    const byMeal = restaurants.filter((r) => !usedRestaurants.has(r.id) && (r.details.meals || []).includes(meal));
    const byPrice = byMeal.filter((r) => levels.includes(r.priceLevel) || (req.budget === "budget" && r.priceLevel === 1));
    const cands = byPrice.length ? byPrice : byMeal.length ? byMeal : restaurants.filter((r) => !usedRestaurants.has(r.id));
    const dietary = req.dietary || [];
    const best = cands
      .map((r) => {
        let s = bayes(r) * 1.4 - haversineKm(near, r) * 0.6;
        if (dietary.some((d) => (r.details.dietary || []).includes(d))) s += 1;
        if (req.interests.includes("food") && (r.tags.includes("foodie") || r.tags.includes("local-favorite"))) s += 0.5;
        if (meal === "dinner" && req.tripType === "couples" && r.tags.includes("romantic")) s += 0.5;
        if (meal === "breakfast" && (r.tags.includes("coffee") || /caf|bakery|brunch/i.test(r.category))) s += 1.2;
        return { r, s };
      })
      .sort((a, b) => b.s - a.s)[0]?.r;
    if (best) usedRestaurants.add(best.id);
    return best || null;
  };

  const extraEvening = activities.filter(
    (a) => !chosen.includes(a) && (a.details.bestTime === "evening" || a.tags.includes("nightlife") || a.tags.includes("sunset"))
  );
  const wantsEvening = req.interests.some((i) => ["nightlife", "romantic", "festivals"].includes(i)) || req.pace === "packed";

  const outDays: ItineraryDay[] = [];
  let totalKm = 0;
  allGroups.slice(0, days).forEach((group, idx) => {
    const stops: ItineraryStop[] = [];
    let t = START_MIN[req.pace] ?? 570;
    let prev: LatLng = base;
    const ordered = orderByTimeOfDay(orderRoute(group.items, base));
    const w = weather[idx];

    if (req.pace === "relaxed" || idx === 0) {
      const cafe = pickRestaurant(ordered[0] || base, "breakfast");
      if (cafe) {
        const dist = haversineKm(prev, cafe);
        stops.push(mkStop(cafe, "meal", t - 60 + 0, 45, `Breakfast & coffee${cafe.details.signatureDish ? ` — try the ${cafe.details.signatureDish.toLowerCase()}` : ""}.`, costFor(cafe, req.budget) * 0.35));
        t = Math.max(t, t - 60 + 45 + travelMinutes(dist));
        prev = cafe;
      }
    }

    let lunched = false;
    for (const p of ordered) {
      const dist = haversineKm(prev, p);
      const tm = travelMinutes(dist);
      if (!lunched && t + tm >= 12 * 60 + 15) {
        const r = pickRestaurant(prev, "lunch");
        if (r) {
          const d2 = haversineKm(prev, r);
          t += travelMinutes(d2);
          t = Math.max(t, 12 * 60 + 15);
          stops.push(mkStop(r, "meal", t, req.pace === "relaxed" ? 90 : 70, lunchNote(r), costFor(r, req.budget) * 0.8));
          t += req.pace === "relaxed" ? 90 : 70;
          totalKm += d2;
          prev = r;
        }
        lunched = true;
      }
      const d = haversineKm(prev, p);
      t += travelMinutes(d);
      totalKm += d;
      if (p.details.bestTime === "evening" && t < 17 * 60) t = Math.max(t, 17 * 60 + 30);
      const dur = group.dayTrip ? Math.max(durationOf(p), 360) : durationOf(p);
      const note = stopNote(p, d, stops.length === 0 ? "your hotel" : "the previous stop");
      stops.push(mkStop(p, "place", t, dur, note, p.priceUsd * travelers));
      // a food tour / cooking class spanning midday replaces lunch
      if (!lunched && /food|class|market/i.test(p.category) && t <= 13 * 60 && t + dur >= 12 * 60 + 30) lunched = true;
      t += dur;
      prev = p;
    }
    if (!lunched && stops.some((s) => s.kind === "place")) {
      const r = pickRestaurant(prev, "lunch");
      if (r && t < 16 * 60) {
        t += travelMinutes(haversineKm(prev, r));
        stops.push(mkStop(r, "meal", Math.max(t, 12 * 60 + 30), 70, lunchNote(r), costFor(r, req.budget) * 0.8));
        t = Math.max(t, 12 * 60 + 30) + 70;
        prev = r;
      }
    }

    // dinner & optional evening activity
    const dinner = pickRestaurant(prev, "dinner");
    const dinnerAt = Math.max(t + 30, req.pace === "packed" ? 19 * 60 + 30 : 19 * 60);
    if (dinner) {
      stops.push(mkStop(dinner, "meal", dinnerAt, 100, dinnerNote(dinner, req), costFor(dinner, req.budget)));
      prev = dinner;
    }
    if (wantsEvening && extraEvening.length && idx % 2 === 0) {
      const ev = extraEvening.sort((a, b) => haversineKm(prev, a) - haversineKm(prev, b)).shift()!;
      stops.push(mkStop(ev, "place", dinnerAt + 110, Math.min(durationOf(ev), 150), `Evening plan: ${firstSentence(ev.details.bookingTip || "") || "a great way to end the day."}`, ev.priceUsd * travelers));
    }

    const places = group.items;
    const theme = themeFor(places, group.dayTrip);
    const hood = mostCommon(places.map((p) => p.neighborhood).filter(Boolean));
    const anchor = places[0]?.name;
    outDays.push({
      day: idx + 1,
      title: group.dayTrip ? `Day trip: ${anchor}` : places.length ? `${theme}${hood ? ` in ${hood}` : anchor ? ` around ${anchor}` : ""}` : "Free day to wander",
      theme: w ? `${theme} · ${w.summary}, ${Math.round(w.tmax)}°C` : theme,
      stops: stops.sort((a, b) => (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0)),
    });
  });

  // pad days if there weren't enough sights
  while (outDays.length < days) {
    const d = outDays.length + 1;
    const hood = dest.info.neighborhoods?.[d % Math.max(1, dest.info.neighborhoods.length)];
    const lunch = pickRestaurant(base, "lunch");
    const dinner = pickRestaurant(base, "dinner");
    const stops: ItineraryStop[] = [
      {
        placeId: null,
        title: hood ? `Wander ${hood.name}` : "Slow morning & neighbourhood stroll",
        kind: "note",
        startTime: "10:00",
        durationMin: 150,
        note: hood?.blurb || "Leave room for serendipity — follow your nose to cafés, bookshops and side streets.",
        costUsd: 0,
      },
    ];
    if (lunch) stops.push(mkStop(lunch, "meal", 13 * 60, 80, lunchNote(lunch), costFor(lunch, req.budget) * 0.8));
    if (dinner) stops.push(mkStop(dinner, "meal", 19 * 60 + 30, 100, dinnerNote(dinner, req), costFor(dinner, req.budget)));
    outDays.push({ day: d, title: hood ? `Local life in ${hood.name}` : "Free day", theme: "Downtime", stops });
  }

  const estimatedCostUsd = computeCosts(outDays, hotel, dest, req);

  const allStops = outDays.flatMap((d) => d.stops.filter((s) => s.kind === "place"));
  const topNames = allStops.slice(0, 3).map((s) => s.title);
  const avgKm = totalKm / Math.max(1, days);
  const wet = weather.slice(0, days).filter((w) => w.precipProb >= 60);

  const tips = [
    ...(dest.info.tips || []).slice(0, 2),
    wet.length ? `Rain is likely on ${wet.map((w) => formatShortDate(w.date)).join(" & ")} — we scheduled indoor sights on those days where possible.` : "",
    dayTrips.length ? `Your day trip to ${dayTrips[0].name} is a long day — start early and pack water and snacks.` : "",
    req.budget === "budget" ? `Budget hack: ${dest.info.gettingAround || "use public transport and walk between nearby sights."}` : "",
    dest.info.tipping ? `Tipping: ${dest.info.tipping}` : "",
  ].filter(Boolean);

  return {
    destinationSlug: dest.slug,
    title: `${days} ${days === 1 ? "day" : "days"} in ${dest.name}`,
    summary:
      `A ${req.pace} ${req.budget === "midrange" ? "mid-range" : req.budget} trip for ${travelers} ${travelers > 1 ? "travelers" : "traveler"}` +
      (req.interests.length ? `, built around ${listJoin(req.interests.slice(0, 3))}` : "") +
      `. ${hotel ? `You'll base yourselves at ${hotel.name}${hotel.neighborhood ? ` in ${hotel.neighborhood}` : ""}, ` : ""}` +
      `see ${allStops.length} highlights${topNames.length ? ` including ${listJoin(topNames)}` : ""}, and eat at ${usedRestaurants.size} hand-picked spots. ` +
      `Each day is clustered by neighbourhood to keep travel short (about ${avgKm.toFixed(1)} km of getting around per day).`,
    days: outDays,
    hotelPlaceId: hotel?.id ?? null,
    estimatedCostUsd,
    tips: tips.slice(0, 5),
    provider: "local",
  };
}

/** Trip cost estimate (USD) from scheduled stops, hotel and destination price levels. */
export function computeCosts(days: ItineraryDay[], hotel: PlannerPlace | null, dest: PlannerDestination, req: PlanRequest) {
  const travelers = clamp(req.travelers || 2, 1, 12);
  const n = Math.max(1, days.length);
  const nights = Math.max(1, n - 1);
  const rooms = Math.ceil(travelers / 2);
  const lodging = hotel ? Math.round(hotel.priceUsd * nights * rooms) : Math.round((dest.info.dailyBudgetUSD?.[req.budget] || 150) * 0.45 * nights * travelers);
  const food = Math.round(
    days.reduce((s, d) => s + d.stops.filter((x) => x.kind === "meal").reduce((a, x) => a + x.costUsd, 0), 0) * travelers + (dest.info.costs?.coffee || 4) * n * travelers
  );
  const activities = Math.round(days.reduce((s, d) => s + d.stops.filter((x) => x.kind === "place").reduce((a, x) => a + x.costUsd, 0), 0));
  const transport = Math.round((dest.info.costs?.transitTicket || 3) * (req.budget === "luxury" ? 10 : 4) * n * travelers);
  const total = lodging + food + activities + transport;
  return { lodging, food, activities, transport, total, perPerson: Math.round(total / travelers) };
}

/** Cost of a single stop: meals are per person, activities for the whole group. */
export function stopCost(p: PlannerPlace, kind: ItineraryStop["kind"], req: PlanRequest) {
  if (kind === "meal") return Math.round(costFor(p, req.budget) * 0.9);
  if (p.type === "hotel") return 0;
  return Math.round(p.priceUsd * clamp(req.travelers || 2, 1, 12));
}

/** Capacity-balanced clustering: k-means centres, then greedy assignment with a size cap. */
function balancedClusters(items: PlannerPlace[], k: number): PlannerPlace[][] {
  if (k <= 1) return [items];
  if (items.length <= k) return items.map((i) => [i]);
  const centers = kmeans(items, k).map((g) => centroid(g));
  while (centers.length < k) centers.push(centroid(items));
  const cap = Math.ceil(items.length / k);
  const groups: PlannerPlace[][] = centers.map(() => []);
  const pref = items
    .map((p) => {
      const ds = centers.map((c) => haversineKm(p, c));
      const sorted = [...ds].sort((a, b) => a - b);
      return { p, ds, regret: (sorted[1] ?? 0) - sorted[0] };
    })
    .sort((a, b) => b.regret - a.regret);
  for (const { p, ds } of pref) {
    const order = ds.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
    const target = order.find((o) => groups[o.i].length < cap) ?? order[0];
    groups[target.i].push(p);
  }
  return groups.filter((g) => g.length);
}

function orderByTimeOfDay(route: PlannerPlace[]) {
  const morning = route.filter((p) => p.details.bestTime === "morning");
  const evening = route.filter((p) => p.details.bestTime === "evening");
  const rest = route.filter((p) => !morning.includes(p) && !evening.includes(p));
  return [...morning, ...rest, ...evening];
}

function mkStop(p: PlannerPlace, kind: ItineraryStop["kind"], start: number, duration: number, note: string, cost: number): ItineraryStop {
  return { placeId: p.id, title: p.name, kind, startTime: hhmm(start), durationMin: Math.round(duration), note, costUsd: Math.round(cost) };
}

function costFor(r: PlannerPlace, budget: BudgetStyle) {
  const base = [0, 14, 32, 65, 140][clamp(r.priceLevel || 2, 1, 4)];
  return budget === "luxury" ? base * 1.15 : base;
}

function stopNote(p: PlannerPlace, km: number, from: string) {
  const mode = travelMode(km);
  const mins = travelMinutes(km);
  const move = km < 0.05 ? "" : `${mins} min ${mode === "walk" ? "walk" : mode === "transit" ? "by transit/taxi" : "drive"} from ${from}. `;
  const tip = p.details.bookingTip ? firstSentence(p.details.bookingTip) : "";
  const dur = p.details.durationMin ? `Allow ${formatDuration(durationOf(p))}. ` : "";
  return `${move}${dur}${tip}`.trim();
}

function lunchNote(r: PlannerPlace) {
  return `Lunch${r.category ? ` — ${r.category.toLowerCase()}` : ""}${r.details.signatureDish ? `. Order the ${r.details.signatureDish.toLowerCase()}` : ""}.`;
}

function dinnerNote(r: PlannerPlace, req: PlanRequest) {
  const bits = [`Dinner${r.category ? ` — ${r.category.toLowerCase()}` : ""}`];
  if (r.details.signatureDish) bits.push(`signature: ${r.details.signatureDish.toLowerCase()}`);
  if (r.priceLevel >= 3) bits.push("book ahead");
  if (req.dietary?.length && (r.details.dietary || []).some((d) => req.dietary!.includes(d))) bits.push(`${req.dietary.join("/")} options`);
  return bits.join(" · ") + ".";
}

function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

function themeFor(items: PlannerPlace[], dayTrip: boolean) {
  if (dayTrip) return "Day trip";
  const buckets: [RegExp, string][] = [
    [/museum|gallery/i, "Art & museums"],
    [/historic|religious|architecture|landmark/i, "History & landmarks"],
    [/park|nature|beach|viewpoint|zoo/i, "Views & green spaces"],
    [/market|neighborhood/i, "Markets & neighbourhoods"],
    [/entertainment|theme park/i, "Fun & entertainment"],
    [/tour|class|cruise|food|adventure|wellness|nightlife/i, "Local experiences"],
  ];
  const counts = new Map<string, number>();
  for (const it of items) {
    const b = buckets.find(([re]) => re.test(it.category))?.[1] || "Highlights";
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Highlights";
}

function mostCommon(xs: string[]) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : xs.length === 1 ? xs[0] : "";
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Re-orders a day's place stops into the shortest walking route, keeping meal slots roughly in place. */
export function optimizeDayRoute<T extends { lat: number; lng: number }>(items: T[], start?: LatLng): { ordered: T[]; beforeKm: number; afterKm: number } {
  const beforeKm = routeLengthKm(start ? [start, ...items] : items);
  const ordered = orderRoute(items, start);
  const afterKm = routeLengthKm(start ? [start, ...ordered] : ordered);
  return afterKm < beforeKm ? { ordered, beforeKm, afterKm } : { ordered: items, beforeKm, afterKm: beforeKm };
}
