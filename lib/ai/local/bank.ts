import fs from "node:fs";
import path from "node:path";
import type { PlaceType } from "@/lib/types";

export interface BankAspect {
  label: string;
  keywords: string[];
  positive: string[];
  neutral: string[];
  negative: string[];
}

export interface Tone3 {
  positive: string[];
  mixed: string[];
  negative: string[];
}

export interface BankType {
  aspects: Record<string, BankAspect>;
  openers: Tone3;
  closers: Tone3;
  titles: Tone3;
  tips: string[];
}

export interface ForeignReview {
  type: PlaceType;
  lang: string;
  rating: number;
  title: string;
  text: string;
  english_title: string;
  english: string;
}

export interface ReviewBank {
  types: Record<PlaceType, BankType>;
  suspicious: { titles: string[]; bodies: string[] };
  foreign: ForeignReview[];
}

let cached: ReviewBank | null = null;

export function loadReviewBank(): ReviewBank {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "source", "review-bank.json");
  cached = JSON.parse(fs.readFileSync(file, "utf8")) as ReviewBank;
  return cached;
}

/** Aspect keyword index for a place type: aspectKey -> { label, keywords }. */
export function aspectIndex(type: PlaceType) {
  const bank = loadReviewBank();
  return Object.entries(bank.types[type].aspects).map(([key, a]) => ({
    key,
    label: a.label,
    keywords: a.keywords.map((k) => k.toLowerCase()),
  }));
}

export function detectAspects(type: PlaceType, sentence: string) {
  const s = sentence.toLowerCase();
  return aspectIndex(type)
    .filter((a) => a.keywords.some((k) => keywordRe(k).test(s)))
    .map((a) => a.key);
}

const reCache = new Map<string, RegExp>();

/** Whole-word match (allowing simple plurals) so "spa" doesn't match "spacious". */
export function keywordRe(k: string) {
  let re = reCache.get(k);
  if (!re) {
    re = new RegExp(`\\b${escapeRe(k)}(?:s|es)?\\b`, "i");
    reCache.set(k, re);
  }
  return re;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
