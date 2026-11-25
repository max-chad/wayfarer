// Offline review-writing assistant: drafts, polishes and titles reviews.
import type { PlaceType } from "@/lib/types";
import { aspectIndex, keywordRe, loadReviewBank } from "./bank";
import { analyzeSentiment, splitSentences } from "./sentiment";

const ABBREV: [RegExp, string][] = [
  [/\bgr8\b/gi, "great"],
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\bb4\b/gi, "before"],
  [/\bthx\b|\bthanx\b/gi, "thanks"],
  [/\bpls\b|\bplz\b/gi, "please"],
  [/\bw\/\b/gi, "with"],
  [/\bw\/o\b/gi, "without"],
  [/\bimo\b/gi, "in my opinion"],
  [/\bdef\b/gi, "definitely"],
  [/\bprob\b/gi, "probably"],
  [/\bbc\b|\bcuz\b/gi, "because"],
  [/\bppl\b/gi, "people"],
  [/\brm\b/gi, "room"],
  [/\bi\b/g, "I"],
  [/\bim\b/gi, "I'm"],
  [/\bdont\b/gi, "don't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bwasnt\b/gi, "wasn't"],
  [/\bisnt\b/gi, "isn't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bthats\b/gi, "that's"],
  [/\bits a\b/gi, "it's a"],
];

export function polishText(text: string): string {
  let t = text.replace(/\r/g, "").trim();
  for (const [re, rep] of ABBREV) t = t.replace(re, rep);
  t = t
    .replace(/([!?.])\1{1,}/g, "$1") // "!!!" -> "!"
    .replace(/\b(\w+)\s+\1\b/gi, "$1") // doubled words
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])(?=[A-Za-z])/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ");
  // de-shout words in ALL CAPS (keep short acronyms)
  t = t.replace(/\b[A-Z]{5,}\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  const paragraphs = t.split(/\n{2,}/).map((p) =>
    splitSentences(p.replace(/\n/g, " "))
      .map((s) => {
        let x = s.trim();
        x = x.charAt(0).toUpperCase() + x.slice(1);
        if (!/[.!?]$/.test(x)) x += ".";
        return x;
      })
      .join(" ")
  );
  return paragraphs.filter(Boolean).join("\n\n");
}

/** Turns rough notes ("great location, breakfast meh, staff super nice") into a readable review. */
export function draftFromNotes(input: { notes: string; rating: number; placeName: string; placeType: PlaceType; tripType?: string }) {
  const bits = input.notes
    .split(/\n|;|,|•|- |\. /)
    .map((b) => b.trim().replace(/^[-*•]\s*/, ""))
    .filter((b) => b.length > 1);
  const tone = input.rating >= 4 ? "positive" : input.rating === 3 ? "mixed" : "negative";
  const bank = loadReviewBank().types[input.placeType];
  const openerChoices: Record<string, string[]> = {
    positive: [`We had a genuinely lovely time at ${input.placeName}.`, `${input.placeName} exceeded our expectations.`, `I'd happily come back to ${input.placeName}.`],
    mixed: [`${input.placeName} was a bit of a mixed bag.`, `There's a lot to like about ${input.placeName}, with a few caveats.`],
    negative: [`Unfortunately ${input.placeName} didn't live up to expectations.`, `I really wanted to like ${input.placeName}, but it fell short.`],
  };
  const opener = openerChoices[tone][input.notes.length % openerChoices[tone].length];
  const sentences = bits.map((b) => {
    const s = analyzeSentiment(b);
    let x = polishText(b).replace(/[.!?]$/, "");
    const lower = x.toLowerCase();
    if (!/\b(was|were|is|are|had|felt|loved|hated|enjoyed|found)\b/.test(lower)) {
      const words = x.split(" ");
      if (words.length <= 4) {
        const [noun, ...rest] = words;
        const adj = rest.join(" ");
        x = adj ? `The ${noun.toLowerCase()} was ${adj.toLowerCase()}` : s.label === "negative" ? `The ${noun.toLowerCase()} was disappointing` : `The ${noun.toLowerCase()} was a highlight`;
      }
    }
    return x.charAt(0).toUpperCase() + x.slice(1) + ".";
  });
  const closer =
    tone === "positive"
      ? "Highly recommended — I'd return in a heartbeat."
      : tone === "mixed"
        ? "Worth a visit if you manage expectations."
        : "I'd look elsewhere next time.";
  const body = [opener, ...sentences, closer].join(" ");
  const titles = suggestTitles({ body, rating: input.rating, placeType: input.placeType });
  return { title: titles[0] || bank.titles[tone][0], body };
}

export function suggestTitles(input: { body: string; rating: number; placeType: PlaceType }): string[] {
  const tone = input.rating >= 4 ? "positive" : input.rating === 3 ? "mixed" : "negative";
  const idx = aspectIndex(input.placeType);
  const lower = input.body.toLowerCase();
  const mentioned = idx.filter((a) => a.keywords.some((k) => keywordRe(k).test(lower))).map((a) => a.label.toLowerCase());
  const titles: string[] = [];
  if (mentioned.length) {
    const a = mentioned[0];
    if (tone === "positive") titles.push(`Loved the ${a}${mentioned[1] ? ` and ${mentioned[1]}` : ""}`, `${cap(a)} was the highlight`);
    else if (tone === "mixed") titles.push(`Great ${a}, but room to improve`);
    else titles.push(`Disappointing ${a}`);
  }
  const bank = loadReviewBank().types[input.placeType].titles[tone].filter((t) => !t.includes("{"));
  for (const t of bank) if (titles.length < 4 && !titles.includes(t)) titles.push(t);
  return titles.slice(0, 4);
}

/** Review-quality coaching shown while writing. */
export function reviewCoach(input: { title: string; body: string; rating: number; placeType: PlaceType }) {
  const words = input.body.trim().split(/\s+/).filter(Boolean).length;
  const idx = aspectIndex(input.placeType);
  const lower = input.body.toLowerCase();
  const covered = idx.filter((a) => a.keywords.some((k) => keywordRe(k).test(lower)));
  const missing = idx.filter((a) => !covered.includes(a)).slice(0, 4);
  const s = analyzeSentiment(`${input.title}. ${input.body}`);
  const implied = Math.max(1, Math.min(5, Math.round(3 + s.score * 2.4)));
  const tips: string[] = [];
  if (words < 50) tips.push("Add a few more details — reviews over 50 words are rated far more helpful.");
  if (covered.length < 2) tips.push(`Mention specifics like ${missing.slice(0, 3).map((m) => m.label.toLowerCase()).join(", ")}.`);
  if (!/\d/.test(input.body)) tips.push("Concrete facts help: prices, wait times, room number or what you ordered.");
  if (Math.abs(implied - input.rating) >= 2 && words > 15) tips.push(`Your text sounds like a ${implied}-star review but you selected ${input.rating} stars — double-check.`);
  const score = Math.min(100, Math.round(Math.min(words, 150) / 1.5 * 0.45 + covered.length * 9 + (/\d/.test(input.body) ? 8 : 0) + (input.title.length > 8 ? 8 : 0)));
  return { words, covered: covered.map((c) => c.label), missing: missing.map((m) => m.label), sentiment: s.label, impliedRating: implied, tips, score };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
