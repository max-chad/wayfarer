import { db, json } from "../db";
import { DEMO_EMAIL, recomputePlaceStats } from "../seed";

/** Everything Wayfarer holds about a user, for the data-export right (GDPR Art. 20 / CCPA). */
export function exportUserData(userId: number) {
  const conn = db();
  const all = (sql: string) => conn.prepare(sql).all(userId) as Record<string, unknown>[];
  const user = conn
    .prepare("SELECT id, username, email, display_name, bio, home_city, interests, avatar_color, role, created_at FROM users WHERE id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  if (!user) return null;
  return {
    exportedAt: new Date().toISOString(),
    profile: { ...user, interests: json<string[]>(user.interests as string, []) },
    reviews: all(
      `SELECT r.id, p.name AS place, r.rating, r.title, r.body, r.trip_type, r.visit_date, r.sub_ratings, r.status, r.helpful_count, r.owner_response, r.created_at
       FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = ? ORDER BY r.created_at`
    ),
    helpfulVotes: all("SELECT review_id, created_at FROM review_votes WHERE user_id = ?"),
    reports: all("SELECT review_id, reason, resolved, created_at FROM review_reports WHERE user_id = ?"),
    savedPlaces: all("SELECT p.name, p.slug, s.created_at FROM saves s JOIN places p ON p.id = s.place_id WHERE s.user_id = ?"),
    trips: all("SELECT id, title, start_date, days, travelers, budget, pace, interests, notes, is_public, created_at, updated_at FROM trips WHERE user_id = ?").map((t) => ({
      ...t,
      items: conn.prepare("SELECT day, position, title, note, start_time, duration_min, kind, cost_usd FROM trip_items WHERE trip_id = ? ORDER BY day, position").all(t.id as number),
    })),
    questions: all("SELECT q.body, p.name AS place, q.created_at FROM questions q JOIN places p ON p.id = q.place_id WHERE q.user_id = ?"),
    answers: all("SELECT body, created_at FROM answers WHERE user_id = ?"),
    bookings: all(
      "SELECT b.ref, p.name AS place, b.kind, b.date, b.time, b.party, b.total_cents, b.status, b.contact_name, b.notes, b.created_at FROM bookings b JOIN places p ON p.id = b.place_id WHERE b.user_id = ?"
    ),
    subscriptions: all("SELECT product, interval, price_cents, status, cancel_at_period_end, current_period_end, started_at, canceled_at FROM subscriptions WHERE user_id = ?"),
    invoices: all("SELECT description, amount_cents, created_at FROM invoices WHERE user_id = ?"),
    priceAlerts: all("SELECT p.name AS place, a.check_in, a.nights, a.guests, a.last_price_cents, a.created_at FROM price_alerts a JOIN places p ON p.id = a.place_id WHERE a.user_id = ?"),
    businessListings: all("SELECT p.name AS place, b.status, b.tier, b.contact_name, b.contact_role, b.website, b.phone, b.created_at FROM businesses b JOIN places p ON p.id = b.place_id WHERE b.user_id = ?"),
    apiKeys: all("SELECT name, prefix, revoked, last_used_at, created_at FROM api_keys WHERE user_id = ?"),
    notifications: all("SELECT kind, title, body, read, created_at FROM notifications WHERE user_id = ?"),
    partnerClicks: all("SELECT partner, created_at FROM clickouts WHERE user_id = ?"),
  };
}

export class AccountError extends Error {}

/**
 * Deletes an account and its personal content. Reviews are removed (and ratings recomputed);
 * booking and invoice records are kept for accounting with the name stripped.
 */
export function deleteAccount(userId: number) {
  const conn = db();
  const u = conn.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string | null } | undefined;
  if (!u) throw new AccountError("Account not found");
  if (u.email === DEMO_EMAIL) throw new AccountError("The shared demo account can't be deleted. Create your own account to try this.");
  const placeIds = (conn.prepare("SELECT DISTINCT place_id FROM reviews WHERE user_id = ?").all(userId) as { place_id: number }[]).map((r) => r.place_id);
  conn.transaction(() => {
    // Keep other reviews' helpful counts honest once this user's votes disappear.
    conn.prepare("UPDATE reviews SET helpful_count = MAX(0, helpful_count - 1) WHERE id IN (SELECT review_id FROM review_votes WHERE user_id = ?)").run(userId);
    conn.prepare("UPDATE bookings SET contact_name = '', notes = '' WHERE user_id = ?").run(userId);
    conn.prepare("DELETE FROM uploads WHERE user_id = ?").run(userId);
    conn.prepare("DELETE FROM users WHERE id = ?").run(userId); // cascades to sessions, reviews, trips, saves, subscriptions, listings, keys…
    if (placeIds.length) recomputePlaceStats(conn, placeIds);
  })();
}
