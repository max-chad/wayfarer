export type PlaceType = "hotel" | "restaurant" | "attraction" | "experience";
export type TripType = "couples" | "family" | "friends" | "solo" | "business";
export type BudgetStyle = "budget" | "midrange" | "luxury";
export type Pace = "relaxed" | "balanced" | "packed";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export interface ImageRef {
  url: string;
  w: number;
  h: number;
  author: string;
  license: string;
  source: string;
}

export interface ClimateMonth {
  month: number;
  tmax: number;
  tmin: number;
  precip: number;
  rainyDays: number;
  sunHours: number;
}

export interface Phrase {
  english: string;
  local: string;
  pronunciation: string;
}

export interface DestinationInfo {
  currency: { code: string; symbol: string; name: string };
  languages: string[];
  timezone: string;
  airport: { code: string; name: string };
  bestMonths: number[];
  avoidMonths: number[];
  dailyBudgetUSD: Record<BudgetStyle, number>;
  costs: { coffee: number; meal: number; fineDining: number; transitTicket: number; beer: number; museum: number };
  safety: { score: number; notes: string };
  plugType: string;
  voltage: string;
  tipping: string;
  gettingAround: string;
  tips: string[];
  etiquette: string[];
  phrases: Phrase[];
  neighborhoods: { name: string; blurb: string; bestFor: string[] }[];
  dishes: { name: string; description: string }[];
  events: { month: number; name: string; description: string }[];
}

export interface Destination {
  id: number;
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  continent: string;
  lat: number;
  lng: number;
  tagline: string;
  description: string;
  wikiExtract: string;
  wikiUrl: string;
  image: ImageRef | null;
  gallery: ImageRef[];
  vibes: string[];
  info: DestinationInfo;
  climate: ClimateMonth[];
  popularity: number;
  avgRating: number;
  reviewCount: number;
  placeCount: number;
}

export type DestinationSummary = Pick<
  Destination,
  | "id"
  | "slug"
  | "name"
  | "country"
  | "countryCode"
  | "continent"
  | "lat"
  | "lng"
  | "tagline"
  | "image"
  | "vibes"
  | "popularity"
  | "avgRating"
  | "reviewCount"
  | "placeCount"
> & { bestMonths: number[]; dailyBudgetUSD: Record<BudgetStyle, number>; climate: ClimateMonth[] };

export interface PlaceDetails {
  hours?: string;
  bookingTip?: string;
  accessibility?: "full" | "partial" | "limited";
  durationMin?: number;
  bestTime?: TimeOfDay;
  indoor?: boolean;
  stars?: number;
  style?: string;
  highlights?: string[];
  signatureDish?: string;
  meals?: string[];
  dietary?: string[];
  includes?: string[];
  wikiTitle?: string;
  nearAttraction?: string;
}

export interface Place {
  id: number;
  slug: string;
  destinationId: number;
  destinationSlug: string;
  destinationName: string;
  country: string;
  type: PlaceType;
  name: string;
  category: string;
  description: string;
  wikiExtract: string;
  wikiUrl: string;
  lat: number;
  lng: number;
  neighborhood: string;
  priceLevel: number;
  priceUsd: number;
  image: ImageRef | null;
  gallery: ImageRef[];
  tags: string[];
  amenities: string[];
  details: PlaceDetails;
  rating: number;
  reviewCount: number;
  ranking: number;
  rankingTotal: number;
  awards: string[];
  aspectScores: Record<string, number>;
}

export type PlaceCardData = Pick<
  Place,
  | "id"
  | "slug"
  | "type"
  | "name"
  | "category"
  | "destinationSlug"
  | "destinationName"
  | "lat"
  | "lng"
  | "neighborhood"
  | "priceLevel"
  | "priceUsd"
  | "image"
  | "tags"
  | "rating"
  | "reviewCount"
  | "ranking"
  | "rankingTotal"
  | "awards"
> & { description: string; details: PlaceDetails; distanceKm?: number };

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
  homeCity: string | null;
  bio: string | null;
  createdAt: string;
  reviewCount?: number;
}

export interface SessionUser extends PublicUser {
  email: string | null;
  role: "user" | "admin";
  homeLat: number | null;
  homeLng: number | null;
  interests: string[];
}

export interface Review {
  id: number;
  placeId: number;
  userId: number;
  user: PublicUser & { reviewCount: number; helpfulTotal: number };
  rating: number;
  title: string;
  body: string;
  tripType: TripType;
  visitDate: string;
  subRatings: Record<string, number>;
  language: string;
  translation: { title: string; body: string } | null;
  helpfulCount: number;
  trustScore: number;
  trustFlags: string[];
  status: "published" | "flagged" | "removed";
  ownerResponse: string | null;
  photos: string[];
  createdAt: string;
  votedByMe?: boolean;
  place?: { slug: string; name: string; type: PlaceType; destinationName: string };
}

export interface TripItem {
  id: number;
  tripId: number;
  day: number;
  position: number;
  placeId: number | null;
  title: string;
  note: string;
  startTime: string | null;
  durationMin: number;
  kind: "place" | "meal" | "note" | "transport";
  costUsd: number;
  place?: PlaceCardData | null;
}

export interface Trip {
  id: number;
  userId: number;
  title: string;
  destinationId: number | null;
  destination?: DestinationSummary | null;
  startDate: string | null;
  days: number;
  travelers: number;
  budget: BudgetStyle;
  pace: Pace;
  interests: string[];
  notes: string;
  shareToken: string | null;
  isPublic: boolean;
  aiSummary: string;
  packing: PackingList | null;
  items: TripItem[];
  createdAt: string;
  updatedAt: string;
  owner?: PublicUser;
}

export interface PackingList {
  generatedAt: string;
  categories: { name: string; items: { name: string; checked: boolean; reason?: string }[] }[];
}

// ---- AI shared shapes -------------------------------------------------------

export interface ReviewSummary {
  headline: string;
  summary: string;
  pros: string[];
  cons: string[];
  bestFor: { tripType: TripType; share: number }[];
  aspects: { key: string; label: string; score: number; mentions: number; sentiment: "positive" | "mixed" | "negative" }[];
  quotes: { text: string; reviewId: number; rating: number }[];
  provider: "claude" | "local";
  basedOn: number;
}

export interface ItineraryStop {
  placeId: number | null;
  title: string;
  kind: "place" | "meal" | "note" | "transport";
  startTime: string;
  durationMin: number;
  note: string;
  costUsd: number;
}

export interface ItineraryDay {
  day: number;
  title: string;
  theme: string;
  stops: ItineraryStop[];
}

export interface Itinerary {
  destinationSlug: string;
  title: string;
  summary: string;
  days: ItineraryDay[];
  hotelPlaceId: number | null;
  estimatedCostUsd: { lodging: number; food: number; activities: number; transport: number; total: number; perPerson: number };
  tips: string[];
  provider: "claude" | "local";
}

export interface PlanRequest {
  destinationSlug: string;
  days: number;
  startDate?: string | null;
  travelers: number;
  budget: BudgetStyle;
  pace: Pace;
  interests: string[];
  tripType: TripType;
  mustSee?: number[];
  dietary?: string[];
  notes?: string;
}
