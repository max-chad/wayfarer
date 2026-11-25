import type { ImageRef, PlaceType } from "./types";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Deterministic 32-bit string hash (cyrb53, truncated). */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number | string) {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    shuffle: <T,>(arr: readonly T[]): T[] => {
      const a2 = [...arr];
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
    sample: <T,>(arr: readonly T[], n: number): T[] => {
      const a2 = [...arr];
      const out: T[] = [];
      while (out.length < n && a2.length) out.push(a2.splice(Math.floor(next() * a2.length), 1)[0]);
      return out;
    },
    normal: (mean = 0, sd = 1) => {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: <T,>(items: readonly T[], weights: readonly number[]): T => {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

export type Rng = ReturnType<typeof rng>;

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function formatUsd(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export function formatMonthYear(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MONTHS[m - 1]} ${y}`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const d = new Date(iso.includes("T") || iso.includes(" ") ? iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z") : iso + "T12:00:00Z");
  const s = Math.max(1, Math.round((now - d.getTime()) / 1000));
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [sec, name] of units) {
    if (s >= sec) {
      const v = Math.floor(s / sec);
      return `${v} ${name}${v > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function formatDuration(min: number) {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) {
    const d = Math.round(h / 24);
    return `${d} day${d > 1 ? "s" : ""}`;
  }
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function priceSymbols(level: number) {
  return "$".repeat(clamp(level || 1, 1, 4));
}

export function pluralize(n: number, word: string, plural?: string) {
  return `${formatNumber(n)} ${n === 1 ? word : plural || word + "s"}`;
}

export function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[,.;:\s]+$/, "") + "…";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Wikimedia serves fixed thumbnail widths; swap the width in a 1280px thumb URL. */
export function imgUrl(ref: ImageRef | string | null | undefined, width: 330 | 500 | 960 | 1280 = 960): string | null {
  if (!ref) return null;
  const url = typeof ref === "string" ? ref : ref.url;
  if (url.startsWith("/")) return url;
  return url.replace(/\/1280px-/, `/${width}px-`);
}

export const TYPE_LABELS: Record<PlaceType, { singular: string; plural: string; route: string }> = {
  hotel: { singular: "Hotel", plural: "Hotels", route: "hotels" },
  restaurant: { singular: "Restaurant", plural: "Restaurants", route: "restaurants" },
  attraction: { singular: "Thing to do", plural: "Things to do", route: "things-to-do" },
  experience: { singular: "Experience", plural: "Experiences", route: "experiences" },
};

export const ROUTE_TO_TYPE: Record<string, PlaceType> = {
  hotels: "hotel",
  restaurants: "restaurant",
  "things-to-do": "attraction",
  experiences: "experience",
};

export const TRIP_TYPE_LABELS: Record<string, string> = {
  couples: "Couples",
  family: "Family",
  friends: "Friends",
  solo: "Solo",
  business: "Business",
};

export const VIBES = [
  "romantic",
  "culture",
  "history",
  "art",
  "food",
  "nightlife",
  "beach",
  "nature",
  "adventure",
  "shopping",
  "family",
  "relaxation",
  "architecture",
  "wellness",
  "budget",
  "luxury",
  "photography",
  "hiking",
  "wine",
  "festivals",
] as const;

export const VIBE_EMOJI: Record<string, string> = {
  romantic: "💞",
  culture: "🎭",
  history: "🏛️",
  art: "🎨",
  food: "🍜",
  nightlife: "🌃",
  beach: "🏖️",
  nature: "🌿",
  adventure: "🧗",
  shopping: "🛍️",
  family: "👨‍👩‍👧",
  relaxation: "🧘",
  architecture: "🏰",
  wellness: "💆",
  budget: "💸",
  luxury: "💎",
  photography: "📸",
  hiking: "🥾",
  wine: "🍷",
  festivals: "🎉",
};

export function titleCase(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export const AVATAR_COLORS = [
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#1d4ed8",
  "#15803d",
  "#c2410c",
  "#0e7490",
  "#a21caf",
  "#4d7c0f",
  "#9f1239",
  "#334155",
];

export function ratingLabel(r: number) {
  if (r >= 4.6) return "Exceptional";
  if (r >= 4.2) return "Excellent";
  if (r >= 3.8) return "Very good";
  if (r >= 3.2) return "Good";
  if (r >= 2.5) return "Average";
  return "Poor";
}
