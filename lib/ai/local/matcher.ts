// Destination matcher: scores every destination against a traveler's quiz answers.
import { flightEstimate, type LatLng } from "@/lib/geo";
import type { DestinationSummary } from "@/lib/types";
import { MONTHS } from "@/lib/utils";

export interface MatchAnswers {
  month: number;
  budget: "budget" | "midrange" | "luxury";
  vibes: string[];
  climate: "hot" | "warm" | "mild" | "cool" | "any";
  days: number;
  maxFlightHours?: number | null;
  home?: LatLng | null;
  avoid?: string[]; // e.g. "crowds", "long-flights", "rain"
}

export interface MatchResult {
  slug: string;
  score: number; // 0..100
  reasons: string[];
  warnings: string[];
  flightHours?: number;
  co2Kg?: number;
  estTotalUsd: number;
}

const CLIMATE_TARGET: Record<string, [number, number]> = { hot: [29, 40], warm: [23, 30], mild: [16, 24], cool: [5, 17], any: [-50, 60] };

export function matchDestinations(dests: DestinationSummary[], a: MatchAnswers): MatchResult[] {
  return dests
    .map((d) => {
      const c = d.climate[a.month - 1];
      const reasons: string[] = [];
      const warnings: string[] = [];
      let s = 0;

      // vibes (40)
      const hits = a.vibes.filter((v) => d.vibes.includes(v));
      s += a.vibes.length ? (hits.length / a.vibes.length) * 40 : 20;
      if (hits.length) reasons.push(`Great for ${hits.slice(0, 3).join(", ")}`);

      // season (20)
      if (d.bestMonths.includes(a.month)) {
        s += 20;
        reasons.push(`${MONTHS[a.month - 1]} is one of the best months to go`);
      } else s += 6;

      // climate (20)
      if (c) {
        const [lo, hi] = CLIMATE_TARGET[a.climate];
        const t = c.tmax;
        const miss = t < lo ? lo - t : t > hi ? t - hi : 0;
        s += Math.max(0, 20 - miss * 2.2);
        if (!miss && a.climate !== "any") reasons.push(`${a.climate === "hot" ? "Hot" : a.climate === "warm" ? "Warm" : a.climate === "mild" ? "Mild" : "Cool"} weather (~${Math.round(t)}°C highs)`);
        if (c.rainyDays >= 12) {
          warnings.push(`Rainy season — about ${c.rainyDays} wet days`);
          s -= a.avoid?.includes("rain") ? 12 : 5;
        }
      }

      // budget (15)
      const daily = d.dailyBudgetUSD[a.budget];
      const mid = d.dailyBudgetUSD.midrange;
      if (a.budget === "budget") {
        s += mid < 120 ? 15 : mid < 200 ? 8 : 0;
        if (mid < 120) reasons.push(`Easy on the wallet (~$${d.dailyBudgetUSD.budget}/day on a budget)`);
        if (mid >= 250) warnings.push("One of the pricier destinations");
      } else if (a.budget === "luxury") {
        s += 12;
      } else s += mid < 260 ? 13 : 8;

      // flight (5 + filter)
      let flightHours: number | undefined;
      let co2Kg: number | undefined;
      if (a.home) {
        const f = flightEstimate(a.home, d);
        flightHours = f.hours;
        co2Kg = f.co2Kg;
        if (a.maxFlightHours && f.hours > a.maxFlightHours) {
          s -= 30;
          warnings.push(`~${f.hours} h flight — longer than you'd like`);
        } else if (f.hours <= 4) {
          s += 5;
          reasons.push(`Short hop — about ${f.hours} h away`);
        }
        if (a.days <= 4 && f.hours > 10) {
          s -= 10;
          warnings.push("Long way to go for a short trip");
        }
      }
      if (a.avoid?.includes("crowds") && d.popularity > 900) {
        s -= 6;
        warnings.push("Very popular — expect crowds at the big sights");
      }
      s += (d.avgRating - 4) * 6;
      return {
        slug: d.slug,
        score: Math.max(1, Math.min(99, Math.round(s))),
        reasons: reasons.slice(0, 4),
        warnings: warnings.slice(0, 2),
        flightHours,
        co2Kg,
        estTotalUsd: Math.round(daily * a.days),
      };
    })
    .sort((x, y) => y.score - x.score);
}
