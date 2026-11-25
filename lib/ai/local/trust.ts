// Review authenticity heuristics ("Trust score").
// Combines stylometric signals with account signals and rating/text consistency.

import { analyzeSentiment, impliedRating, tokenize } from "./sentiment";

export interface TrustInput {
  title: string;
  body: string;
  rating: number;
  userReviewCount: number;
  accountAgeDays: number;
  aspectHits?: number; // number of distinct aspect keywords mentioned (specificity)
  similarityToOthers?: number; // 0..1 max Jaccard similarity to other reviews of the same place
}

export interface TrustResult {
  score: number; // 0..100
  flags: string[];
  level: "high" | "medium" | "low";
}

/** Reviews scoring below this are held for moderation (live path and seeder must agree). */
export const TRUST_HOLD_THRESHOLD = 35;

const PROMO = /\b(book now|visit our|discount|promo|coupon|click|dm me|follow (us|me)|use code|www\.|http|\.com\b|call now|best price guaranteed|special offer)\b/i;
const GENERIC = /\b(best ever|best place ever|amazing|awesome|perfect|must visit|must go|10\/10|100%|highly recommend|five stars|5 stars|number one|no\.? ?1|unbelievable|life changing|incredible experience|worst ever|never again|avoid at all costs)\b/gi;

export function scoreReviewTrust(input: TrustInput): TrustResult {
  const text = `${input.title}. ${input.body}`;
  const flags: string[] = [];
  let score = 92;

  const len = input.body.trim().length;
  if (len < 60) {
    score -= 22;
    flags.push("Very short review");
  } else if (len < 140) {
    score -= 8;
  }

  const exclam = (text.match(/!/g) || []).length;
  if (exclam >= 4 || /!!!/.test(text) || exclam / Math.max(1, len) > 0.02) {
    score -= 14;
    flags.push("Excessive exclamation marks");
  }

  const words = text.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w));
  const caps = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 3 && w === w.toUpperCase());
  if (words.length && caps.length / words.length > 0.15 && caps.length >= 2) {
    score -= 14;
    flags.push("Shouting (ALL CAPS)");
  }

  const generic = (text.match(GENERIC) || []).length;
  const hits = input.aspectHits ?? 0;
  if (generic >= 2 && hits <= 1) {
    score -= 20;
    flags.push("Generic superlatives without specifics");
  }

  if (PROMO.test(text)) {
    score -= 26;
    flags.push("Promotional language");
  }

  const sentiment = analyzeSentiment(text);
  const implied = impliedRating(sentiment.score);
  if (Math.abs(implied - input.rating) >= 2.2 && sentiment.positive + sentiment.negative >= 2) {
    score -= 18;
    flags.push("Star rating doesn't match the text");
  }

  if (input.accountAgeDays < 14 && input.userReviewCount <= 1) {
    score -= 14;
    flags.push("Brand-new account");
  } else if (input.userReviewCount >= 10) {
    score += 3;
  }

  if ((input.rating === 5 || input.rating === 1) && hits === 0 && len < 200) {
    score -= 8;
    flags.push("Extreme rating with no detail");
  }

  if ((input.similarityToOthers ?? 0) > 0.6) {
    score -= 25;
    flags.push("Near-duplicate of another review");
  }

  if (hits >= 3) score += 4;
  if (/\d/.test(input.body)) score += 2;
  const uniqueRatio = new Set(tokenize(input.body)).size / Math.max(1, tokenize(input.body).length);
  if (uniqueRatio < 0.45 && len > 80) {
    score -= 10;
    flags.push("Repetitive wording");
  }

  score = Math.max(3, Math.min(99, Math.round(score)));
  return { score, flags, level: score >= 70 ? "high" : score >= 40 ? "medium" : "low" };
}

export function jaccard(a: string, b: string) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
