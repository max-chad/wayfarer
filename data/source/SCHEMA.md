# Destination source file schema (one JSON file per destination)

Path: `data/source/destinations/<slug>.json`. Strict JSON (no comments, no trailing commas). UTF-8.

```ts
interface DestinationSource {
  slug: string;                 // kebab-case, e.g. "paris", "new-york"
  name: string;                 // "Paris"
  country: string;              // "France"
  countryCode: string;          // ISO 3166-1 alpha-2, "FR"
  region: string;               // state/province/region, "Île-de-France"
  continent: "Europe" | "Asia" | "North America" | "South America" | "Africa" | "Oceania" | "Middle East";
  wiki: string;                 // EXACT English Wikipedia article title, e.g. "Paris", "Queenstown, New Zealand"
  lat: number; lng: number;     // city centre, 4 decimals
  tagline: string;              // <= 70 chars, evocative
  description: string;          // ORIGINAL prose, 2-3 paragraphs separated by "\n\n", 150-230 words total. Never copy Wikipedia.
  vibes: string[];              // 4-7 values from VIBES vocabulary
  currency: { code: string; symbol: string; name: string };
  languages: string[];          // ["French"]
  timezone: string;             // IANA, "Europe/Paris"
  airport: { code: string; name: string };
  bestMonths: number[];         // 1-12
  avoidMonths: number[];        // 1-12 (may be empty)
  dailyBudgetUSD: { budget: number; midrange: number; luxury: number };  // per person per day incl. lodging
  costs: { coffee: number; meal: number; fineDining: number; transitTicket: number; beer: number; museum: number }; // USD, realistic 2026
  safety: { score: 1 | 2 | 3 | 4 | 5; notes: string };  // 5 = very safe; notes 1-2 sentences, practical
  plugType: string;             // "C / E"
  voltage: string;              // "230V"
  tipping: string;              // 1 sentence
  gettingAround: string;        // 1-2 sentences
  tips: string[];               // exactly 6 practical insider tips, 1-2 sentences each
  etiquette: string[];          // exactly 4 short cultural etiquette notes
  phrases: { english: string; local: string; pronunciation: string }[];  // exactly 10, in this order:
      // Hello, Thank you, Please, Excuse me, Yes, No, How much is this?, Where is the bathroom?, The bill, please, Goodbye
      // For cities whose main language is English (London, New York, San Francisco, Sydney, Vancouver, Queenstown): instead give 10 fun local
      // slang/regional expressions: english = what it means, local = the expression, pronunciation = short usage example.
      // Cape Town: use Afrikaans. Singapore: use Singlish/Malay mix. Dubai: Arabic. Bali: Indonesian.
  neighborhoods: { name: string; blurb: string; bestFor: string[] }[];   // 4-5 real neighborhoods
  dishes: { name: string; description: string }[];                       // exactly 5 local dishes/drinks
  events: { month: number; name: string; description: string }[];       // 3-4 real annual festivals/events
  attractions: AttractionSource[];   // exactly 10, REAL, all with valid English Wikipedia articles
  hotels: HotelSource[];             // exactly 6, FICTIONAL
  restaurants: RestaurantSource[];   // exactly 8, FICTIONAL
  experiences: ExperienceSource[];   // exactly 4, FICTIONAL operators
}

interface AttractionSource {
  name: string;                 // real attraction name
  wiki: string;                 // EXACT English Wikipedia article title (must exist; prefer the canonical title)
  lat: number; lng: number;     // accurate, 4 decimals
  category: "Landmark" | "Museum" | "Park" | "Religious Site" | "Historic Site" | "Viewpoint" | "Market" | "Beach" | "Neighborhood" | "Nature" | "Entertainment" | "Architecture" | "Gallery" | "Zoo & Aquarium" | "Theme Park";
  description: string;          // ORIGINAL, 2-3 sentences, vivid & useful
  durationMin: number;          // typical visit length
  bestTime: "morning" | "afternoon" | "evening" | "any";
  priceUSD: number;             // typical adult ticket, 0 if free
  tags: string[];               // 3-6 from PLACE_TAGS
  indoor: boolean;
  hours: string;                // "09:30–18:00 daily (closed Tue)" – approximate is fine
  bookingTip: string;           // 1 sentence
  accessibility: "full" | "partial" | "limited";
}

interface HotelSource {
  name: string;                 // FICTIONAL, plausible, local flavour. Must NOT be a real hotel or chain.
  style: "Luxury" | "Boutique" | "Design" | "Budget" | "Hostel" | "Resort" | "Heritage" | "Apartment";
  stars: 2 | 3 | 4 | 5;
  nearAttraction: string;       // EXACTLY equal to one attraction.name in this file (used to place it on the map)
  neighborhood: string;
  pricePerNightUSD: number;     // realistic for style/city
  description: string;          // 2-3 sentences
  amenities: string[];          // 5-10 from AMENITIES
  tags: string[];               // 3-5 from PLACE_TAGS
  highlights: string[];         // exactly 3, short (<= 6 words each)
}
// Mix of styles per city: at least 1 Luxury, 1 Boutique or Design, 1 Budget or Hostel, plus 3 others. Stars must fit style.

interface RestaurantSource {
  name: string;                 // FICTIONAL, must NOT be a real restaurant
  cuisine: string;              // "French bistro", "Neapolitan pizza", "Izakaya"...
  priceLevel: 1 | 2 | 3 | 4;
  nearAttraction: string;       // EXACTLY equal to one attraction.name in this file
  neighborhood: string;
  description: string;          // 2-3 sentences
  signatureDish: string;        // a real dish type, e.g. "Duck confit with lentils"
  meals: ("breakfast" | "lunch" | "dinner" | "late-night")[];
  dietary: ("vegetarian" | "vegan" | "gluten-free" | "halal" | "kosher")[];
  tags: string[];               // 3-5 from PLACE_TAGS
  hours: string;
}
// Mix per city: at least 1 priceLevel 1 (street food / café), 1 priceLevel 4 fine dining, 1 café/breakfast spot, mostly local cuisine + 1-2 international.

interface ExperienceSource {
  name: string;                 // FICTIONAL tour/class e.g. "Twilight Seine Cruise with Local Sommelier"
  category: "Tour" | "Class" | "Cruise" | "Day Trip" | "Food Tour" | "Adventure" | "Wellness" | "Nightlife";
  nearAttraction: string;       // EXACTLY equal to one attraction.name in this file (meeting point)
  durationMin: number;
  priceUSD: number;
  description: string;          // 2-3 sentences
  includes: string[];           // 3-4 short items
  tags: string[];               // 3-5 from PLACE_TAGS
  bestTime: "morning" | "afternoon" | "evening" | "any";
}
```

VIBES = romantic, culture, history, art, food, nightlife, beach, nature, adventure, shopping, family, relaxation, architecture, wellness, budget, luxury, photography, hiking, wine, festivals

PLACE_TAGS = iconic, hidden-gem, romantic, family-friendly, views, sunset, free, rainy-day, instagrammable, local-favorite, quiet, lively, outdoor, history, art, foodie, budget, luxury, eco-friendly, pet-friendly, accessible, nightlife, kid-friendly, rooftop, waterfront, nature, architecture, shopping, live-music, late-night, vegetarian-friendly, wine, coffee, street-food, fine-dining, spa, pool, beach, workspace

AMENITIES = Free Wi-Fi, Breakfast included, Pool, Spa, Fitness center, Restaurant, Bar, Rooftop terrace, Airport shuttle, Parking, Air conditioning, Pet friendly, Family rooms, 24h front desk, Concierge, Room service, Kitchenette, Laundry, EV charging, Beach access, Garden, Wheelchair accessible, Non-smoking rooms, Business center, Bike rental, Hot tub, Sauna, Kids club
