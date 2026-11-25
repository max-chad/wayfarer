import { db, json } from "../db";
import type { PublicUser, SessionUser } from "../types";
import { toPublicUser, type UserRow } from "./mappers";

export function toSessionUser(r: UserRow): SessionUser {
  return {
    ...toPublicUser(r),
    email: r.email,
    role: r.role,
    homeLat: r.home_lat,
    homeLng: r.home_lng,
    interests: json<string[]>(r.interests, []),
  };
}

export function getUserById(id: number): SessionUser | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r ? toSessionUser(r) : null;
}

export function getUserByUsername(username: string): PublicUser | null {
  const r = db().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  return r ? toPublicUser(r) : null;
}

export function getUserForLogin(identifier: string) {
  return db().prepare("SELECT * FROM users WHERE email = ? OR username = ?").get(identifier, identifier) as (UserRow & { password_hash: string | null }) | undefined;
}

// ── Gamification ────────────────────────────────────────────────────────────

export const LEVELS = [0, 300, 900, 2000, 4000, 7500, 12000];

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
}

export function userStats(userId: number) {
  const conn = db();
  const s = conn
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM reviews WHERE user_id = @id AND status = 'published') reviews,
        (SELECT COALESCE(SUM(helpful_count),0) FROM reviews WHERE user_id = @id) helpful,
        (SELECT COUNT(*) FROM reviews WHERE user_id = @id AND photos != '[]') photoReviews,
        (SELECT COUNT(*) FROM answers WHERE user_id = @id) answers,
        (SELECT COUNT(*) FROM trips WHERE user_id = @id) trips,
        (SELECT COUNT(DISTINCT p.destination_id) FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = @id) cities,
        (SELECT COUNT(DISTINCT d.country) FROM reviews r JOIN places p ON p.id = r.place_id JOIN destinations d ON d.id = p.destination_id WHERE r.user_id = @id) countries,
        (SELECT COUNT(DISTINCT d.continent) FROM reviews r JOIN places p ON p.id = r.place_id JOIN destinations d ON d.id = p.destination_id WHERE r.user_id = @id) continents,
        (SELECT COUNT(*) FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = @id AND p.type = 'restaurant') restaurantReviews,
        (SELECT COUNT(*) FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = @id AND p.type = 'attraction') attractionReviews,
        (SELECT COUNT(*) FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = @id AND p.type = 'hotel') hotelReviews`
    )
    .get({ id: userId }) as {
    reviews: number;
    helpful: number;
    photoReviews: number;
    answers: number;
    trips: number;
    cities: number;
    countries: number;
    continents: number;
    restaurantReviews: number;
    attractionReviews: number;
    hotelReviews: number;
  };
  const points = s.reviews * 100 + s.helpful * 10 + s.photoReviews * 30 + s.answers * 40 + s.trips * 25;
  let level = 1;
  LEVELS.forEach((min, i) => {
    if (points >= min) level = i + 1;
  });
  const next = LEVELS[level] ?? null;
  const badges: Badge[] = [
    { id: "first-review", name: "First Review", emoji: "✍️", description: "Wrote a first review", earned: s.reviews >= 1 },
    { id: "storyteller", name: "Storyteller", emoji: "📚", description: "10+ published reviews", earned: s.reviews >= 10 },
    { id: "top-contributor", name: "Top Contributor", emoji: "🏆", description: "50+ published reviews", earned: s.reviews >= 50 },
    { id: "helpful", name: "Helpful Voice", emoji: "👍", description: "50+ helpful votes received", earned: s.helpful >= 50 },
    { id: "globetrotter", name: "Globetrotter", emoji: "🌍", description: "Reviewed places in 5+ countries", earned: s.countries >= 5 },
    { id: "continental", name: "Continental", emoji: "🧭", description: "Reviewed places on 3+ continents", earned: s.continents >= 3 },
    { id: "foodie", name: "Foodie", emoji: "🍜", description: "10+ restaurant reviews", earned: s.restaurantReviews >= 10 },
    { id: "culture", name: "Culture Vulture", emoji: "🏛️", description: "10+ attraction reviews", earned: s.attractionReviews >= 10 },
    { id: "hotelier", name: "Hotel Critic", emoji: "🛎️", description: "5+ hotel reviews", earned: s.hotelReviews >= 5 },
    { id: "shutterbug", name: "Shutterbug", emoji: "📸", description: "5+ reviews with photos", earned: s.photoReviews >= 5 },
    { id: "planner", name: "Master Planner", emoji: "🗺️", description: "Planned 3+ trips", earned: s.trips >= 3 },
    { id: "helper", name: "Community Helper", emoji: "💬", description: "Answered 5+ traveler questions", earned: s.answers >= 5 },
  ];
  return {
    ...s,
    points,
    level,
    levelMin: LEVELS[level - 1],
    nextLevelAt: next,
    progress: next ? (points - LEVELS[level - 1]) / (next - LEVELS[level - 1]) : 1,
    badges,
  };
}

export function reviewedPlacesMap(userId: number) {
  return db()
    .prepare(
      `SELECT p.slug, p.name, p.lat, p.lng, p.type, r.rating, d.name AS destination FROM reviews r
       JOIN places p ON p.id = r.place_id JOIN destinations d ON d.id = p.destination_id
       WHERE r.user_id = ? AND r.status = 'published'`
    )
    .all(userId) as { slug: string; name: string; lat: number; lng: number; type: string; rating: number; destination: string }[];
}

export function leaderboard(limit = 25) {
  const rows = db()
    .prepare(
      `SELECT u.*, COUNT(r.id) reviews, COALESCE(SUM(r.helpful_count),0) helpful,
        COUNT(DISTINCT p.destination_id) cities
       FROM users u JOIN reviews r ON r.user_id = u.id AND r.status = 'published'
       JOIN places p ON p.id = r.place_id
       GROUP BY u.id ORDER BY (COUNT(r.id) * 100 + COALESCE(SUM(r.helpful_count),0) * 10) DESC LIMIT ?`
    )
    .all(limit) as (UserRow & { reviews: number; helpful: number; cities: number })[];
  return rows.map((r) => ({ ...toPublicUser(r), reviews: r.reviews, helpful: r.helpful, cities: r.cities, points: r.reviews * 100 + r.helpful * 10 }));
}

export function updateProfile(
  userId: number,
  patch: Partial<{ displayName: string; bio: string; homeCity: string; homeLat: number | null; homeLng: number | null; interests: string[]; avatarColor: string }>
) {
  const cur = getUserById(userId);
  if (!cur) return null;
  db()
    .prepare(
      "UPDATE users SET display_name = ?, bio = ?, home_city = ?, home_lat = ?, home_lng = ?, interests = ?, avatar_color = ? WHERE id = ?"
    )
    .run(
      (patch.displayName ?? cur.displayName).slice(0, 60),
      (patch.bio ?? cur.bio ?? "").slice(0, 400),
      patch.homeCity ?? cur.homeCity,
      patch.homeLat !== undefined ? patch.homeLat : cur.homeLat,
      patch.homeLng !== undefined ? patch.homeLng : cur.homeLng,
      JSON.stringify(patch.interests ?? cur.interests),
      patch.avatarColor ?? cur.avatarColor,
      userId
    );
  return getUserById(userId);
}
