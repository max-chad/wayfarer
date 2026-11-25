// Lightweight lexicon-based sentiment analysis with negation & intensifier handling.
// Used by the offline AI engine (review summaries, trust scoring, tone meter).

const POSITIVE = `
amazing awesome beautiful best brilliant charming clean comfortable cosy cozy delicious delightful excellent exceptional
fantastic fabulous fresh friendly generous gorgeous great happy helpful impeccable impressive incredible lovely magical
memorable nice outstanding peaceful perfect pleasant quiet recommend recommended relaxing remarkable romantic smooth
spacious spectacular spotless stunning superb tasty terrific thoughtful welcoming wonderful worth worthwhile enjoyed
enjoy loved love adore attentive knowledgeable efficient fun calm airy bright elegant stylish authentic breathtaking
flawless heavenly highlight gem favourite favorite glad pleased value bargain seamless professional polite warm
immaculate tidy good fine well easy convenient reasonable affordable safe prompt quick fast organised organized
engaging informative passionate hilarious unforgettable iconic legendary sublime divine juicy crispy tender fragrant
`;

const NEGATIVE = `
awful bad boring broken cold cramped crowded dirty disappointing disappointed dreadful dull expensive filthy
horrible mediocre mess messy mouldy moldy noisy overpriced poor rude slow small smelly stained sticky terrible
tired tiny ugly uncomfortable unfriendly unhelpful unpleasant worst worse waste avoid chaotic confusing cramped
disgusting greasy bland overcooked undercooked soggy stale lukewarm loud rushed pushy scam touristy tourist-trap
queue queues packed underwhelming unclean unsafe dated worn shabby leaking leak broken problem problems issue issues
complaint complain complained annoying frustrating frustrated wait waited waiting delay delayed late lost cancelled
canceled refund stuck sweaty humid freezing hot unbearable dark gloomy sad regret overrated overhyped ripoff rip-off
`;

const INTENSIFIERS: Record<string, number> = {
  very: 1.4,
  really: 1.3,
  extremely: 1.6,
  incredibly: 1.6,
  super: 1.4,
  so: 1.2,
  absolutely: 1.5,
  truly: 1.3,
  totally: 1.3,
  quite: 0.9,
  somewhat: 0.6,
  slightly: 0.5,
  bit: 0.6,
  little: 0.7,
  pretty: 1.1,
};

const NEGATORS = new Set(["not", "no", "never", "hardly", "barely", "nothing", "isn't", "wasn't", "weren't", "aren't", "don't", "didn't", "doesn't", "couldn't", "wouldn't", "won't", "cannot", "can't", "without", "nor"]);

const POS = new Set(POSITIVE.split(/\s+/).filter(Boolean));
const NEG = new Set(NEGATIVE.split(/\s+/).filter(Boolean));

// words that look negative but are usually neutral in reviews, or context-dependent
const SOFT_NEG = new Set(["queue", "queues", "wait", "waited", "waiting", "hot", "packed", "small", "tiny", "expensive", "touristy"]);

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9'\-]+/)
    .filter(Boolean);
}

export interface SentimentResult {
  score: number; // -1 .. 1
  positive: number;
  negative: number;
  label: "positive" | "mixed" | "negative" | "neutral";
}

export function analyzeSentiment(text: string): SentimentResult {
  const tokens = tokenize(text);
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let polarity = POS.has(t) ? 1 : NEG.has(t) ? (SOFT_NEG.has(t) ? -0.6 : -1) : 0;
    if (!polarity) continue;
    let mult = 1;
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(tokens[j])) negated = !negated;
      if (INTENSIFIERS[tokens[j]]) mult *= INTENSIFIERS[tokens[j]];
    }
    if (negated) polarity *= -0.8;
    if (polarity > 0) pos += polarity * mult;
    else neg += -polarity * mult;
  }
  const exclam = (text.match(/!/g) || []).length;
  if (pos > neg) pos += Math.min(exclam, 3) * 0.2;
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / (total + 1);
  const label: SentimentResult["label"] =
    total === 0 ? "neutral" : score > 0.25 ? "positive" : score < -0.25 ? "negative" : "mixed";
  return { score: Math.max(-1, Math.min(1, score)), positive: pos, negative: neg, label };
}

/** Maps sentiment (-1..1) to an implied star rating (1..5). */
export function impliedRating(score: number) {
  return Math.max(1, Math.min(5, Math.round((3 + score * 2.4) * 10) / 10));
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}
