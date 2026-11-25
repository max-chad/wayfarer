import fs from "node:fs";
import path from "node:path";
import type { ClimateMonth, DestinationInfo, ImageRef } from "../types";

export interface AttractionSource {
  name: string;
  wiki: string;
  lat: number;
  lng: number;
  category: string;
  description: string;
  durationMin: number;
  bestTime: "morning" | "afternoon" | "evening" | "any";
  priceUSD: number;
  tags: string[];
  indoor: boolean;
  hours: string;
  bookingTip: string;
  accessibility: "full" | "partial" | "limited";
}

export interface HotelSource {
  name: string;
  style: string;
  stars: number;
  nearAttraction: string;
  neighborhood: string;
  pricePerNightUSD: number;
  description: string;
  amenities: string[];
  tags: string[];
  highlights: string[];
}

export interface RestaurantSource {
  name: string;
  cuisine: string;
  priceLevel: number;
  nearAttraction: string;
  neighborhood: string;
  description: string;
  signatureDish: string;
  meals: string[];
  dietary: string[];
  tags: string[];
  hours: string;
}

export interface ExperienceSource {
  name: string;
  category: string;
  nearAttraction: string;
  durationMin: number;
  priceUSD: number;
  description: string;
  includes: string[];
  tags: string[];
  bestTime: "morning" | "afternoon" | "evening" | "any";
}

export interface DestinationSource
  extends Omit<DestinationInfo, "currency" | "dailyBudgetUSD"> {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  continent: string;
  wiki: string;
  lat: number;
  lng: number;
  tagline: string;
  description: string;
  vibes: string[];
  currency: { code: string; symbol: string; name: string };
  dailyBudgetUSD: { budget: number; midrange: number; luxury: number };
  attractions: AttractionSource[];
  hotels: HotelSource[];
  restaurants: RestaurantSource[];
  experiences: ExperienceSource[];
}

export interface PageMedia {
  missing?: boolean;
  title?: string;
  url?: string;
  description?: string;
  extract?: string;
  lat?: number | null;
  lng?: number | null;
  image?: ImageRef | null;
  gallery?: ImageRef[];
}

export interface MediaFile {
  pages: Record<string, PageMedia>;
  pools: Record<string, ImageRef[]>;
  climate: Record<string, ClimateMonth[]>;
}

export function loadSources(): DestinationSource[] {
  const dir = path.join(process.cwd(), "data", "source", "destinations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as DestinationSource];
      } catch (e) {
        console.warn(`[seed] skipping invalid source ${f}: ${(e as Error).message}`);
        return [];
      }
    });
}

export function loadMedia(): MediaFile {
  const file = path.join(process.cwd(), "data", "generated", "media.json");
  try {
    const m = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<MediaFile>;
    return { pages: m.pages || {}, pools: m.pools || {}, climate: m.climate || {} };
  } catch {
    return { pages: {}, pools: {}, climate: {} };
  }
}

/** Approximate climate when no measured normals are available (offline fallback). */
export function syntheticClimate(lat: number): ClimateMonth[] {
  const south = lat < 0;
  const abs = Math.abs(lat);
  const mean = 30 - abs * 0.45;
  const amp = Math.min(14, abs * 0.28);
  return Array.from({ length: 12 }, (_, i) => {
    const peakMonth = south ? 0 : 6; // warmest month index
    const t = mean + amp * Math.cos(((i - peakMonth) / 12) * 2 * Math.PI);
    return {
      month: i + 1,
      tmax: Math.round((t + 5) * 10) / 10,
      tmin: Math.round((t - 4) * 10) / 10,
      precip: 60,
      rainyDays: 8,
      sunHours: 6,
    };
  });
}
