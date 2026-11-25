// Rule-based natural-language understanding for travel queries.
// Turns "cheap romantic dinner with a view in Lisbon" into structured filters.

import type { BudgetStyle, PlaceType, TripType } from "@/lib/types";
import { MONTHS } from "@/lib/utils";

export type Intent =
  | "search"
  | "plan"
  | "weather"
  | "budget"
  | "packing"
  | "compare"
  | "phrases"
  | "recommend-destination"
  | "destination-info"
  | "greeting"
  | "thanks"
  | "help"
  | "unknown";

export interface ParsedQuery {
  intent: Intent;
  destinationSlug?: string;
  destinationName?: string;
  otherDestinationSlugs: string[];
  type?: PlaceType;
  category?: string;
  priceLevels?: number[];
  tags: string[];
  minRating?: number;
  tripType?: TripType;
  days?: number;
  month?: number;
  budget?: BudgetStyle;
  climate?: "warm" | "cool";
  interests: string[];
  dietary: string[];
  keywords: string;
  interpretation: string;
}

export interface DestLite {
  slug: string;
  name: string;
  country: string;
}

const ALIASES: Record<string, string> = {
  nyc: "new-york",
  "new york": "new-york",
  "big apple": "new-york",
  manhattan: "new-york",
  brooklyn: "new-york",
  sf: "san-francisco",
  "san fran": "san-francisco",
  "bay area": "san-francisco",
  cdmx: "mexico-city",
  "mexico city": "mexico-city",
  rio: "rio-de-janeiro",
  "buenos aires": "buenos-aires",
  ba: "buenos-aires",
  bkk: "bangkok",
  "cape town": "cape-town",
  capetown: "cape-town",
  "machu picchu": "cusco",
  cuzco: "cusco",
  constantinople: "istanbul",
  firenze: "florence",
  roma: "rome",
  lisboa: "lisbon",
  praha: "prague",
  wien: "vienna",
  "saigon": "hanoi",
  "the city of light": "paris",
  "milford sound": "queenstown",
  ubud: "bali",
  seminyak: "bali",
  oia: "santorini",
  giza: "cairo",
};

const TYPE_WORDS: [RegExp, PlaceType][] = [
  [/\b(hotels?|stay|stays|staying|accommodation|lodging|hostels?|resorts?|b&b|guesthouse|sleep|room)\b/, "hotel"],
  [/\b(restaurants?|eat|eating|dinner|lunch|brunch|breakfast|food|dine|dining|cafes?|café|coffee|bars?|drinks?|cocktails?|pizza|sushi|ramen|tapas|tacos|bistro|street food|vegan|seafood|steak|dessert)\b/, "restaurant"],
  [/\b(tours?|class|classes|cruises?|experiences?|activities|activity|workshop|excursion|day trip|cooking|kayak|snorkel|hike with guide|lesson)\b/, "experience"],
  [/\b(things to do|see|sights?|sightseeing|attractions?|museums?|landmarks?|parks?|beach(es)?|viewpoints?|temples?|churches|cathedral|gallery|galleries|monuments?|palace|castle|market)\b/, "attraction"],
];

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\bmuseums?\b/, "Museum"],
  [/\bgallery|galleries\b/, "Gallery"],
  [/\bparks?|gardens?\b/, "Park"],
  [/\bbeach(es)?\b/, "Beach"],
  [/\bviewpoints?|lookout\b/, "Viewpoint"],
  [/\bmarkets?\b/, "Market"],
  [/\btemples?|church(es)?|cathedral|mosque|shrine\b/, "Religious"],
  [/\bcastle|palace|fort|ruins\b/, "Historic"],
  [/\bpizza\b/, "pizza"],
  [/\bsushi\b/, "sushi"],
  [/\bramen\b/, "ramen"],
  [/\btapas\b/, "tapas"],
  [/\btacos?\b/, "taco"],
  [/\bseafood|fish\b/, "seafood"],
  [/\bsteak|asado|grill\b/, "grill"],
  [/\bcafe|café|coffee\b/, "caf"],
  [/\bcocktails?|bar\b/, "bar"],
  [/\bcooking class\b/, "Class"],
  [/\bcruise|boat\b/, "Cruise"],
  [/\bfood tour\b/, "Food Tour"],
];

const TAG_WORDS: [RegExp, string][] = [
  [/\bromantic|date night|honeymoon|anniversary\b/, "romantic"],
  [/\bfamil(y|ies)|kids?|children|toddlers?\b/, "family-friendly"],
  [/\bviews?|panoram|skyline\b/, "views"],
  [/\bsunset\b/, "sunset"],
  [/\brooftop\b/, "rooftop"],
  [/\bquiet|peaceful|calm|tranquil|relaxing\b/, "quiet"],
  [/\blively|buzzing|vibrant|party\b/, "lively"],
  [/\bhidden gems?|off the beaten|lesser known|secret|underrated\b/, "hidden-gem"],
  [/\blocals?|authentic\b/, "local-favorite"],
  [/\bfree\b/, "free"],
  [/\brain(y)?|indoors?\b/, "rainy-day"],
  [/\bvegetarian|vegan|plant.based\b/, "vegetarian-friendly"],
  [/\bpool\b/, "pool"],
  [/\bspa\b/, "spa"],
  [/\bwine\b/, "wine"],
  [/\bstreet food\b/, "street-food"],
  [/\bnightlife|late.night|clubs?\b/, "nightlife"],
  [/\bpets?|dogs?\b/, "pet-friendly"],
  [/\baccessible|wheelchair\b/, "accessible"],
  [/\beco|sustainable|green\b/, "eco-friendly"],
  [/\binstagram|photogenic|photo spots?\b/, "instagrammable"],
  [/\bhistor(y|ic|ical)\b/, "history"],
  [/\bart(sy)?\b/, "art"],
  [/\bwork(space)?|laptop|remote work\b/, "workspace"],
  [/\blive music|jazz\b/, "live-music"],
  [/\bwaterfront|seaside|riverside|harbou?r\b/, "waterfront"],
  [/\bfine dining|michelin|tasting menu\b/, "fine-dining"],
  [/\biconic|famous|must.see|must.do\b/, "iconic"],
];

const INTEREST_WORDS: [RegExp, string][] = [
  [/\bromantic|honeymoon\b/, "romantic"],
  [/\bculture|cultural\b/, "culture"],
  [/\bhistor(y|ic)\b/, "history"],
  [/\bart|museums?\b/, "art"],
  [/\bfood|foodie|eat|cuisine|culinary\b/, "food"],
  [/\bnightlife|party|bars\b/, "nightlife"],
  [/\bbeach(es)?\b/, "beach"],
  [/\bnature|outdoors?\b/, "nature"],
  [/\badventure|adrenaline\b/, "adventure"],
  [/\bshopping|shops?\b/, "shopping"],
  [/\bfamily|kids\b/, "family"],
  [/\brelax(ing|ation)?|chill\b/, "relaxation"],
  [/\barchitecture\b/, "architecture"],
  [/\bwellness|spa|yoga\b/, "wellness"],
  [/\bphotograph(y|er)|photos?\b/, "photography"],
  [/\bhik(e|ing)|trek(king)?\b/, "hiking"],
  [/\bwine|vineyards?\b/, "wine"],
  [/\bfestivals?|events?\b/, "festivals"],
];

const DIETARY: [RegExp, string][] = [
  [/\bvegetarian\b/, "vegetarian"],
  [/\bvegan\b/, "vegan"],
  [/\bgluten.free|celiac|coeliac\b/, "gluten-free"],
  [/\bhalal\b/, "halal"],
  [/\bkosher\b/, "kosher"],
];

const STOPWORDS = new Set(
  "a an the in at on for to of and or with near around best top good great find show me some any i we my our want looking look need please can you recommend suggest where what is are there place places spot spots somewhere something that this it be do get go city cheap budget affordable luxury fancy upscale expensive".split(
    " "
  )
);

export function parseTravelQuery(raw: string, dests: DestLite[], context: { destinationSlug?: string } = {}): ParsedQuery {
  const q = ` ${raw.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}$€£'+\-.\s]/gu, " ")} `;
  const out: ParsedQuery = { intent: "unknown", tags: [], interests: [], dietary: [], keywords: "", interpretation: "", otherDestinationSlugs: [] };
  const consumed: string[] = [];

  // destinations (aliases, names, countries)
  const found: string[] = [];
  for (const [alias, slug] of Object.entries(ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(q) && dests.some((d) => d.slug === slug)) {
      found.push(slug);
      consumed.push(alias);
    }
  }
  for (const d of dests) {
    const name = d.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    const qn = q.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (qn.includes(` ${name} `) || qn.includes(` ${name}'s`) || qn.includes(` ${name}.`) || qn.includes(` ${name}?`)) {
      if (!found.includes(d.slug)) found.push(d.slug);
      consumed.push(d.name.toLowerCase());
    }
  }
  if (!found.length) {
    for (const d of dests) {
      const c = d.country.toLowerCase();
      if (q.includes(` ${c} `) || q.includes(` ${c}?`) || q.includes(` ${c}.`)) {
        found.push(d.slug);
        consumed.push(c);
        break;
      }
    }
  }
  if (found.length) {
    out.destinationSlug = found[0];
    out.destinationName = dests.find((d) => d.slug === found[0])?.name;
    out.otherDestinationSlugs = found.slice(1);
  } else if (context.destinationSlug) {
    out.destinationSlug = context.destinationSlug;
    out.destinationName = dests.find((d) => d.slug === context.destinationSlug)?.name;
  }

  for (const [re, t] of TYPE_WORDS) {
    if (re.test(q)) {
      out.type = t;
      break;
    }
  }
  for (const [re, c] of CATEGORY_WORDS) {
    if (re.test(q)) {
      out.category = c;
      break;
    }
  }
  for (const [re, t] of TAG_WORDS) if (re.test(q) && !out.tags.includes(t)) out.tags.push(t);
  for (const [re, i] of INTEREST_WORDS) if (re.test(q) && !out.interests.includes(i)) out.interests.push(i);
  for (const [re, d] of DIETARY) if (re.test(q)) out.dietary.push(d);

  // price
  const dollar = q.match(/(?<![\w$])\${1,4}(?![\w$\d])/); // "$$" style, not "$300"
  if (/\b(cheap|budget|affordable|inexpensive|low.cost|backpack(er|ing)?|hostel)\b/.test(q)) {
    out.priceLevels = [1, 2];
    out.budget = "budget";
  } else if (/\b(luxury|luxurious|fancy|upscale|splurge|high.end|five.star|5.star|lavish|posh)\b/.test(q) || out.tags.includes("fine-dining")) {
    out.priceLevels = [3, 4];
    out.budget = "luxury";
  } else if (/\b(mid.range|moderate|reasonabl[ey])\b/.test(q)) {
    out.priceLevels = [2, 3];
    out.budget = "midrange";
  } else if (dollar && /under|below|less than|max/.test(q)) {
    out.priceLevels = Array.from({ length: dollar[0].length }, (_, i) => i + 1);
  } else if (dollar) {
    out.priceLevels = [dollar[0].length];
  }
  const underUsd = q.match(/(under|below|less than|max)\s*\$?\s?(\d{2,4})/);
  if (underUsd && !out.priceLevels) {
    const v = Number(underUsd[2]);
    out.priceLevels = out.type === "hotel" ? (v < 90 ? [1] : v < 200 ? [1, 2] : v < 380 ? [1, 2, 3] : [1, 2, 3, 4]) : v < 40 ? [1] : v < 90 ? [1, 2] : [1, 2, 3];
  }

  // rating
  const ratingNum = q.match(/(\d(?:\.\d)?)\s*(\+|stars?|or (higher|more|above))/);
  if (ratingNum && Number(ratingNum[1]) <= 5) out.minRating = Number(ratingNum[1]);
  else if (/\b(top.rated|highly.rated|best.rated|best|excellent|top)\b/.test(q)) out.minRating = 4.2;

  // climate preference
  if (/\b(sun|sunny|sunshine|warm|warmth|hot|heat|tropical)\b/.test(q)) out.climate = "warm";
  else if (/\b(cool|cold|snow|snowy|northern lights)\b/.test(q)) out.climate = "cool";

  // trip type
  if (/\b(couple|partner|wife|husband|girlfriend|boyfriend|honeymoon|romantic)\b/.test(q)) out.tripType = "couples";
  else if (/\b(family|kids|children|toddler)\b/.test(q)) out.tripType = "family";
  else if (/\b(friends|group|mates|bachelor|bachelorette)\b/.test(q)) out.tripType = "friends";
  else if (/\b(solo|alone|by myself)\b/.test(q)) out.tripType = "solo";
  else if (/\b(business|work trip|conference)\b/.test(q)) out.tripType = "business";

  // duration
  const d = q.match(/(\d{1,2})\s*(-|\s)?(days?|nights?)/);
  if (d) out.days = Math.min(14, Number(d[1]) + (d[3].startsWith("night") ? 1 : 0));
  else if (/\blong weekend\b/.test(q)) out.days = 3;
  else if (/\bweekend\b/.test(q)) out.days = 2;
  else if (/\b(a|one) week\b/.test(q)) out.days = 7;
  else if (/\btwo weeks|fortnight\b/.test(q)) out.days = 14;

  // month
  MONTHS.forEach((m, i) => {
    if (new RegExp(`\\b${m.toLowerCase()}\\b|\\b${m.slice(0, 3).toLowerCase()}\\b(?!\\w)`).test(q) && !/\bmar\b/.test("")) out.month = i + 1;
  });
  if (/\bnext month\b/.test(q)) out.month = ((new Date().getMonth() + 1) % 12) + 1;
  if (/\bthis summer|in summer\b/.test(q)) out.month = 7;
  if (/\bthis winter|in winter\b/.test(q)) out.month = 1;
  if (/\bin spring\b/.test(q)) out.month = 4;
  if (/\bin (autumn|fall)\b/.test(q)) out.month = 10;

  // intent
  if (/^\s*(hi|hello|hey|yo|hola|bonjour|ciao|good (morning|afternoon|evening))\b/.test(q) && q.trim().split(/\s+/).length <= 4) out.intent = "greeting";
  else if (/\b(thanks|thank you|cheers|merci|gracias)\b/.test(q) && q.trim().split(/\s+/).length <= 6) out.intent = "thanks";
  else if (/\b(what can you do|help me|how does this work|who are you)\b/.test(q)) out.intent = "help";
  else if (/\b(compare|vs\.?|versus|better than|difference between)\b/.test(q) || (found.length >= 2 && /\bor\b/.test(q))) out.intent = "compare";
  else if (
    !found.length &&
    /\b(where should (i|we) go|where to go|where (can|could) (i|we) go|recommend (a|some)? ?(city|destination|place to go)|suggest (a|some)? ?destinations?|surprise me|somewhere (warm|sunny|hot|cheap|new|different)|where is (warm|sunny|hot)|next trip|holiday ideas|vacation ideas)\b/.test(q)
  )
    out.intent = "recommend-destination";
  else if (/\b(pack|packing|what to (bring|wear)|luggage|suitcase)\b/.test(q)) out.intent = "packing";
  else if (/\b(weather|temperature|forecast|rain(fall|y)?|climate|how (hot|cold|warm))\b/.test(q)) out.intent = "weather";
  else if (/\b(phrases?|how do (you|i) say|language|speak|translate|words?)\b/.test(q)) out.intent = "phrases";
  else if (/\b(itinerary|plan (a|my)|plan\b|schedule|\d+ days? in|days in|weekend in|trip to|visit .* for)\b/.test(q)) out.intent = "plan";
  else if (/\b(budget|cost|how much|expensive|price|money|afford)\b/.test(q) && !out.type) out.intent = "budget";
  else if (out.type || out.category || out.tags.length) out.intent = "search";
  else if (out.destinationSlug && found.length) out.intent = /\b(safe|safety|tips|know|visa|currency|tipping|best time|when)\b/.test(q) ? "destination-info" : "destination-info";
  else if (out.interests.length || out.month) out.intent = "recommend-destination";

  // keywords left over for full-text search
  let rest = q;
  for (const c of consumed) rest = rest.replace(c, " ");
  out.keywords = rest
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d/.test(w) && !/^\$/.test(w))
    .filter((w) => !TYPE_WORDS.some(([re]) => re.test(` ${w} `)))
    .filter((w) => ![...TAG_WORDS, ...INTEREST_WORDS, ...DIETARY].some(([re]) => re.test(` ${w} `)))
    .filter((w) => !/^(view|views|dinner|lunch|breakfast|cheap|budget|luxury|fancy|affordable|nice|good|best|top|rated|highly|near|close|walking|distance|with|without|under|over|stay|trip|visit|place|spot|spots|area)$/.test(w))
    .slice(0, 6)
    .join(" ");

  out.interpretation = describe(out);
  return out;
}

const ADJ_TAGS = new Set(["romantic", "quiet", "lively", "family-friendly", "kid-friendly", "hidden-gem", "local-favorite", "eco-friendly", "accessible", "pet-friendly", "budget", "luxury", "iconic", "instagrammable"]);
const TAG_PHRASE: Record<string, string> = {
  "hidden-gem": "hidden-gem",
  "local-favorite": "local-favourite",
  "family-friendly": "family-friendly",
  views: "great views",
  "live-music": "live music",
  "street-food": "street food",
  "fine-dining": "fine dining",
  "rainy-day": "rainy-day",
  "vegetarian-friendly": "vegetarian options",
};

export function describe(p: ParsedQuery) {
  const typeLabel = p.type ? { hotel: "hotels", restaurant: "restaurants", attraction: "things to do", experience: "experiences" }[p.type] : "places";
  const tags = p.tags.filter((t) => t !== "free");
  const adjs = tags.filter((t) => ADJ_TAGS.has(t)).map((t) => TAG_PHRASE[t] || t.replace(/-/g, " "));
  const withs = tags.filter((t) => !ADJ_TAGS.has(t)).map((t) => TAG_PHRASE[t] || t.replace(/-/g, " "));
  const cuisine = p.category && !/^[A-Z]/.test(p.category) ? `${p.category} ` : "";
  let s = `${adjs.length ? adjs.join(", ") + " " : ""}${cuisine}${typeLabel}`;
  if (withs.length) s += ` with ${withs.slice(0, 3).join(" & ")}`;
  if (p.destinationName) s += ` in ${p.destinationName}`;
  const extras: string[] = [];
  if (p.priceLevels) extras.push(p.priceLevels.map((l) => "$".repeat(l)).join("–"));
  if (p.minRating) extras.push(`rated ${p.minRating}+`);
  if (p.tags.includes("free")) extras.push("free");
  if (p.dietary.length) extras.push(p.dietary.join(", "));
  return `${s}${extras.length ? ` · ${extras.join(" · ")}` : ""}`.replace(/^\w/, (c) => c.toUpperCase());
}
