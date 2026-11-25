import { detectAspects } from "../ai/local/bank";
import { splitSentences } from "../ai/local/sentiment";
import { jaccard, scoreReviewTrust, TRUST_HOLD_THRESHOLD } from "../ai/local/trust";
import { db } from "../db";
import { recomputePlaceStats } from "../seed";
import type { PlaceType, Review, TripType } from "../types";
import { reviewSelect, toReview, type ReviewRow } from "./mappers";

export interface ReviewQuery {
  rating?: number[];
  tripType?: string[];
  language?: "en" | "other" | "all";
  season?: "spring" | "summer" | "autumn" | "winter";
  q?: string;
  withPhotos?: boolean;
  sort?: "recent" | "helpful" | "highest" | "lowest";
  page?: number;
  pageSize?: number;
  viewerId?: number | null;
  includeFlagged?: boolean;
}

const SEASON_MONTHS: Record<string, string[]> = {
  spring: ["03", "04", "05"],
  summer: ["06", "07", "08"],
  autumn: ["09", "10", "11"],
  winter: ["12", "01", "02"],
};

export function listReviews(placeId: number, q: ReviewQuery = {}) {
  const where = ["r.place_id = ?"];
  const params: unknown[] = [placeId];
  if (!q.includeFlagged) where.push("r.status = 'published'");
  if (q.rating?.length) {
    where.push(`r.rating IN (${q.rating.map(() => "?").join(",")})`);
    params.push(...q.rating);
  }
  if (q.tripType?.length) {
    where.push(`r.trip_type IN (${q.tripType.map(() => "?").join(",")})`);
    params.push(...q.tripType);
  }
  if (q.language === "en") where.push("r.language = 'en'");
  if (q.language === "other") where.push("r.language != 'en'");
  if (q.season) {
    where.push(`substr(r.visit_date, 6, 2) IN (${SEASON_MONTHS[q.season].map(() => "?").join(",")})`);
    params.push(...SEASON_MONTHS[q.season]);
  }
  if (q.withPhotos) where.push("r.photos != '[]'");
  if (q.q?.trim()) {
    where.push("(r.body LIKE ? OR r.title LIKE ?)");
    params.push(`%${q.q.trim()}%`, `%${q.q.trim()}%`);
  }
  const order = {
    recent: "r.created_at DESC",
    helpful: "r.helpful_count DESC, r.created_at DESC",
    highest: "r.rating DESC, r.created_at DESC",
    lowest: "r.rating ASC, r.created_at DESC",
  }[q.sort || "recent"];
  const pageSize = Math.min(50, q.pageSize || 10);
  const page = Math.max(1, q.page || 1);
  const conn = db();
  const total = (conn.prepare(`SELECT COUNT(*) n FROM reviews r WHERE ${where.join(" AND ")}`).get(...params) as { n: number }).n;
  const rows = conn
    .prepare(`${reviewSelect({ votedId: q.viewerId })} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as ReviewRow[];
  return { items: rows.map(toReview), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function reviewStats(placeId: number) {
  const conn = db();
  const dist = conn.prepare("SELECT rating, COUNT(*) n FROM reviews WHERE place_id = ? AND status = 'published' GROUP BY rating").all(placeId) as {
    rating: number;
    n: number;
  }[];
  const trips = conn.prepare("SELECT trip_type, COUNT(*) n FROM reviews WHERE place_id = ? AND status = 'published' GROUP BY trip_type ORDER BY n DESC").all(placeId) as {
    trip_type: TripType;
    n: number;
  }[];
  const langs = conn.prepare("SELECT language, COUNT(*) n FROM reviews WHERE place_id = ? AND status = 'published' GROUP BY language ORDER BY n DESC").all(placeId) as {
    language: string;
    n: number;
  }[];
  const months = conn
    .prepare("SELECT CAST(substr(visit_date, 6, 2) AS INTEGER) m, COUNT(*) n, AVG(rating) avg FROM reviews WHERE place_id = ? AND status = 'published' GROUP BY m")
    .all(placeId) as { m: number; n: number; avg: number }[];
  const trust = conn
    .prepare("SELECT AVG(trust_score) avg, SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) flagged FROM reviews WHERE place_id = ?")
    .get(placeId) as { avg: number; flagged: number };
  const distribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: dist.find((d) => d.rating === r)?.n || 0 }));
  return {
    distribution,
    total: distribution.reduce((s, d) => s + d.n, 0),
    tripTypes: trips.map((t) => ({ tripType: t.trip_type, n: t.n })),
    languages: langs,
    months,
    trustAvg: Math.round(trust.avg || 0),
    flagged: trust.flagged || 0,
  };
}

/** All published review texts for AI summarization. */
export function reviewsForAnalysis(placeId: number, limit = 400) {
  return db()
    .prepare(
      `SELECT id, rating, title, body, trip_type, visit_date, helpful_count, language, translation FROM reviews
       WHERE place_id = ? AND status = 'published' ORDER BY helpful_count DESC, created_at DESC LIMIT ?`
    )
    .all(placeId, limit) as {
    id: number;
    rating: number;
    title: string;
    body: string;
    trip_type: TripType;
    visit_date: string;
    helpful_count: number;
    language: string;
    translation: string | null;
  }[];
}

export function getReview(id: number): Review | null {
  const row = db().prepare(`${reviewSelect()} WHERE r.id = ?`).get(id) as ReviewRow | undefined;
  return row ? toReview(row) : null;
}

export interface NewReview {
  placeId: number;
  userId: number;
  rating: number;
  title: string;
  body: string;
  tripType: TripType;
  visitDate: string;
  subRatings: Record<string, number>;
  photos: string[];
}

export function createReview(input: NewReview) {
  const conn = db();
  const place = conn.prepare("SELECT id, type FROM places WHERE id = ?").get(input.placeId) as { id: number; type: PlaceType } | undefined;
  if (!place) throw new Error("Place not found");
  const user = conn
    .prepare("SELECT created_at, (SELECT COUNT(*) FROM reviews WHERE user_id = users.id) n FROM users WHERE id = ?")
    .get(input.userId) as { created_at: string; n: number };
  const others = conn.prepare("SELECT body FROM reviews WHERE place_id = ? ORDER BY created_at DESC LIMIT 200").all(input.placeId) as { body: string }[];
  const similarity = others.reduce((m, o) => Math.max(m, jaccard(o.body, input.body)), 0);
  const aspectHits = new Set(splitSentences(input.body).flatMap((s) => detectAspects(place.type, s))).size;
  const trust = scoreReviewTrust({
    title: input.title,
    body: input.body,
    rating: input.rating,
    userReviewCount: user.n + 1,
    accountAgeDays: (Date.now() - new Date(user.created_at.replace(" ", "T") + "Z").getTime()) / 86400000,
    aspectHits,
    similarityToOthers: similarity,
  });
  const status = trust.score < TRUST_HOLD_THRESHOLD ? "flagged" : "published";
  const id = Number(
    conn
      .prepare(
        `INSERT INTO reviews (place_id, user_id, rating, title, body, trip_type, visit_date, sub_ratings, photos, trust_score, trust_flags, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.placeId,
        input.userId,
        input.rating,
        input.title,
        input.body,
        input.tripType,
        input.visitDate,
        JSON.stringify(input.subRatings),
        JSON.stringify(input.photos),
        trust.score,
        JSON.stringify(trust.flags),
        status
      ).lastInsertRowid
  );
  recomputePlaceStats(conn, [input.placeId]);
  return { id, status, trust };
}

export function deleteReview(id: number, userId: number, isAdmin = false) {
  const conn = db();
  const r = conn.prepare("SELECT place_id, user_id FROM reviews WHERE id = ?").get(id) as { place_id: number; user_id: number } | undefined;
  if (!r || (r.user_id !== userId && !isAdmin)) return false;
  conn.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  recomputePlaceStats(conn, [r.place_id]);
  return true;
}

export function toggleHelpful(reviewId: number, userId: number) {
  const conn = db();
  return conn.transaction(() => {
    const existing = conn.prepare("SELECT 1 FROM review_votes WHERE review_id = ? AND user_id = ?").get(reviewId, userId);
    if (existing) {
      conn.prepare("DELETE FROM review_votes WHERE review_id = ? AND user_id = ?").run(reviewId, userId);
      conn.prepare("UPDATE reviews SET helpful_count = MAX(0, helpful_count - 1) WHERE id = ?").run(reviewId);
    } else {
      conn.prepare("INSERT INTO review_votes (review_id, user_id) VALUES (?, ?)").run(reviewId, userId);
      conn.prepare("UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?").run(reviewId);
    }
    const row = conn.prepare("SELECT helpful_count FROM reviews WHERE id = ?").get(reviewId) as { helpful_count: number } | undefined;
    return { voted: !existing, helpfulCount: row?.helpful_count ?? 0 };
  })();
}

export function reportReview(reviewId: number, userId: number | null, reason: string) {
  db().prepare("INSERT INTO review_reports (review_id, user_id, reason) VALUES (?, ?, ?)").run(reviewId, userId, reason.slice(0, 500));
}

export function userReviews(userId: number, limit = 50) {
  const rows = db()
    .prepare(
      `${reviewSelect({ place: true })} WHERE r.user_id = ? AND r.status != 'removed' ORDER BY r.created_at DESC LIMIT ?`
    )
    .all(userId, limit) as ReviewRow[];
  return rows.map(toReview);
}

export function recentReviews(limit = 6, minRating = 4) {
  const rows = db()
    .prepare(
      `${reviewSelect({ place: true })} WHERE r.status = 'published' AND r.language = 'en' AND r.rating >= ? AND length(r.body) > 180 AND r.trust_score >= 80 ORDER BY r.created_at DESC LIMIT ?`
    )
    .all(minRating, limit) as ReviewRow[];
  return rows.map(toReview);
}

export function moderationQueue(limit = 100) {
  const rows = db()
    .prepare(
      `${reviewSelect({ place: true })} WHERE r.status = 'flagged' OR r.id IN (SELECT review_id FROM review_reports WHERE resolved = 0) ORDER BY r.trust_score ASC, r.created_at DESC LIMIT ?`
    )
    .all(limit) as ReviewRow[];
  const reports = db().prepare("SELECT review_id, reason, created_at FROM review_reports WHERE resolved = 0").all() as {
    review_id: number;
    reason: string;
    created_at: string;
  }[];
  return rows.map((r) => ({ ...toReview(r), reports: reports.filter((x) => x.review_id === r.id) }));
}

export function setReviewStatus(reviewId: number, status: "published" | "removed" | "flagged") {
  const conn = db();
  const r = conn.prepare("SELECT place_id FROM reviews WHERE id = ?").get(reviewId) as { place_id: number } | undefined;
  if (!r) return false;
  conn.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, reviewId);
  conn.prepare("UPDATE review_reports SET resolved = 1 WHERE review_id = ?").run(reviewId);
  recomputePlaceStats(conn, [r.place_id]);
  return true;
}

export function setOwnerResponse(reviewId: number, response: string) {
  db().prepare("UPDATE reviews SET owner_response = ? WHERE id = ?").run(response.slice(0, 2000), reviewId);
}

export function saveReviewTranslation(reviewId: number, t: { title: string; body: string }) {
  db().prepare("UPDATE reviews SET translation = ? WHERE id = ?").run(JSON.stringify(t), reviewId);
}
