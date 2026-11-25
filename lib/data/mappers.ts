import { json } from "../db";
import type { Destination, DestinationSummary, ImageRef, Place, PlaceCardData, PlaceType, PublicUser, Review } from "../types";

export interface DestinationRow {
  id: number;
  slug: string;
  name: string;
  country: string;
  country_code: string;
  region: string;
  continent: string;
  lat: number;
  lng: number;
  tagline: string;
  description: string;
  wiki_extract: string;
  wiki_url: string;
  image: string | null;
  gallery: string;
  vibes: string;
  info: string;
  climate: string;
  popularity: number;
  avg_rating?: number;
  review_count?: number;
  place_count?: number;
}

export function toDestination(r: DestinationRow): Destination {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    country: r.country,
    countryCode: r.country_code,
    region: r.region,
    continent: r.continent,
    lat: r.lat,
    lng: r.lng,
    tagline: r.tagline,
    description: r.description,
    wikiExtract: r.wiki_extract,
    wikiUrl: r.wiki_url,
    image: json<ImageRef | null>(r.image, null),
    gallery: json<ImageRef[]>(r.gallery, []),
    vibes: json<string[]>(r.vibes, []),
    info: json(r.info, {} as Destination["info"]),
    climate: json(r.climate, [] as Destination["climate"]),
    popularity: r.popularity,
    avgRating: Math.round((r.avg_rating || 0) * 10) / 10,
    reviewCount: r.review_count || 0,
    placeCount: r.place_count || 0,
  };
}

export function toDestinationSummary(r: DestinationRow): DestinationSummary {
  return destinationToSummary(toDestination(r));
}

export function destinationToSummary(d: Destination): DestinationSummary {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    country: d.country,
    countryCode: d.countryCode,
    continent: d.continent,
    lat: d.lat,
    lng: d.lng,
    tagline: d.tagline,
    image: d.image,
    vibes: d.vibes,
    popularity: d.popularity,
    avgRating: d.avgRating,
    reviewCount: d.reviewCount,
    placeCount: d.placeCount,
    bestMonths: d.info.bestMonths || [],
    dailyBudgetUSD: d.info.dailyBudgetUSD || { budget: 0, midrange: 0, luxury: 0 },
    climate: d.climate,
  };
}

export interface PlaceRow {
  id: number;
  slug: string;
  destination_id: number;
  destination_slug: string;
  destination_name: string;
  country: string;
  type: Place["type"];
  name: string;
  category: string;
  description: string;
  wiki_extract: string;
  wiki_url: string;
  lat: number;
  lng: number;
  neighborhood: string;
  price_level: number;
  price_usd: number;
  image: string | null;
  gallery: string;
  tags: string;
  amenities: string;
  details: string;
  rating: number;
  review_count: number;
  ranking: number;
  ranking_total: number;
  awards: string;
  aspect_scores: string;
  distance_km?: number;
}

export function toPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    slug: r.slug,
    destinationId: r.destination_id,
    destinationSlug: r.destination_slug,
    destinationName: r.destination_name,
    country: r.country,
    type: r.type,
    name: r.name,
    category: r.category,
    description: r.description,
    wikiExtract: r.wiki_extract,
    wikiUrl: r.wiki_url,
    lat: r.lat,
    lng: r.lng,
    neighborhood: r.neighborhood,
    priceLevel: r.price_level,
    priceUsd: r.price_usd,
    image: json<ImageRef | null>(r.image, null),
    gallery: json<ImageRef[]>(r.gallery, []),
    tags: json<string[]>(r.tags, []),
    amenities: json<string[]>(r.amenities, []),
    details: json(r.details, {}),
    rating: Math.round(r.rating * 10) / 10,
    reviewCount: r.review_count,
    ranking: r.ranking,
    rankingTotal: r.ranking_total,
    awards: json<string[]>(r.awards, []),
    aspectScores: json<Record<string, number>>(r.aspect_scores, {}),
  };
}

export function toCard(r: PlaceRow): PlaceCardData {
  const p = toPlace(r);
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    name: p.name,
    category: p.category,
    destinationSlug: p.destinationSlug,
    destinationName: p.destinationName,
    lat: p.lat,
    lng: p.lng,
    neighborhood: p.neighborhood,
    priceLevel: p.priceLevel,
    priceUsd: p.priceUsd,
    image: p.image,
    tags: p.tags,
    rating: p.rating,
    reviewCount: p.reviewCount,
    ranking: p.ranking,
    rankingTotal: p.rankingTotal,
    awards: p.awards,
    description: p.description,
    details: p.details,
    distanceKm: r.distance_km,
  };
}

/** One builder so extra columns/joins can't be lost to a stale string replace. */
export function placeSelect(extraCols = "", extraJoin = "") {
  return `
  SELECT p.*, d.slug AS destination_slug, d.name AS destination_name, d.country AS country${extraCols ? `, ${extraCols}` : ""}
  FROM places p JOIN destinations d ON d.id = p.destination_id${extraJoin ? ` ${extraJoin}` : ""}`;
}

export const PLACE_SELECT = placeSelect();

export interface ReviewRow {
  id: number;
  place_id: number;
  user_id: number;
  rating: number;
  title: string;
  body: string;
  trip_type: Review["tripType"];
  visit_date: string;
  sub_ratings: string;
  language: string;
  translation: string | null;
  helpful_count: number;
  trust_score: number;
  trust_flags: string;
  status: Review["status"];
  owner_response: string | null;
  photos: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_color: string;
  home_city: string | null;
  bio: string | null;
  user_created_at: string;
  user_review_count: number;
  user_helpful_total: number;
  voted?: number;
  place_slug?: string;
  place_name?: string;
  place_type?: PlaceType;
  place_destination?: string;
}

/** One builder so extra columns/joins can't be lost to a stale string replace. */
export function reviewSelect(opts: { place?: boolean; votedId?: number | null } = {}) {
  const placeCols = opts.place ? ", p.slug AS place_slug, p.name AS place_name, p.type AS place_type, d.name AS place_destination" : "";
  const placeJoins = opts.place ? " JOIN places p ON p.id = r.place_id JOIN destinations d ON d.id = p.destination_id" : "";
  const votedCol = opts.votedId ? `EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = r.id AND v.user_id = ${Number(opts.votedId)}) AS voted, ` : "";
  return `
  SELECT r.*, ${votedCol}u.username, u.display_name, u.avatar_color, u.home_city, u.bio, u.created_at AS user_created_at,
    (SELECT COUNT(*) FROM reviews r2 WHERE r2.user_id = u.id AND r2.status = 'published') AS user_review_count,
    (SELECT COALESCE(SUM(helpful_count),0) FROM reviews r3 WHERE r3.user_id = u.id) AS user_helpful_total${placeCols}
  FROM reviews r JOIN users u ON u.id = r.user_id${placeJoins}`;
}

export function toReview(r: ReviewRow): Review {
  const user: Review["user"] = {
    id: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    homeCity: r.home_city,
    bio: r.bio,
    createdAt: r.user_created_at,
    reviewCount: r.user_review_count,
    helpfulTotal: r.user_helpful_total,
  };
  return {
    id: r.id,
    placeId: r.place_id,
    userId: r.user_id,
    user,
    rating: r.rating,
    title: r.title,
    body: r.body,
    tripType: r.trip_type,
    visitDate: r.visit_date,
    subRatings: json(r.sub_ratings, {}),
    language: r.language,
    translation: json(r.translation, null),
    helpfulCount: r.helpful_count,
    trustScore: r.trust_score,
    trustFlags: json(r.trust_flags, []),
    status: r.status,
    ownerResponse: r.owner_response,
    photos: json(r.photos, []),
    createdAt: r.created_at,
    votedByMe: !!r.voted,
    place: r.place_slug
      ? { slug: r.place_slug, name: r.place_name!, type: r.place_type!, destinationName: r.place_destination || "" }
      : undefined,
  };
}

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  avatar_color: string;
  bio: string | null;
  home_city: string | null;
  home_lat: number | null;
  home_lng: number | null;
  interests: string;
  role: "user" | "admin";
  created_at: string;
}

export function toPublicUser(r: UserRow): PublicUser {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    homeCity: r.home_city,
    bio: r.bio,
    createdAt: r.created_at,
  };
}
