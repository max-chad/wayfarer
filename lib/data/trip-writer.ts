import type Database from "better-sqlite3";
import { randomToken } from "../password";
import type { Itinerary, PlanRequest } from "../types";

/** Persists an itinerary as a trip (+ items). Pure w.r.t. the connection so the seeder can reuse it. */
export function insertTripFromItinerary(
  conn: Database.Database,
  userId: number,
  destinationId: number,
  req: PlanRequest,
  it: Itinerary,
  opts: { title?: string; isPublic?: boolean; createdAt?: string } = {}
): number {
  const tripId = Number(
    conn
      .prepare(
        `INSERT INTO trips (user_id, title, destination_id, start_date, days, travelers, budget, pace, interests, notes, share_token, is_public, ai_summary, created_at, updated_at)
         VALUES (@user_id, @title, @destination_id, @start_date, @days, @travelers, @budget, @pace, @interests, @notes, @share_token, @is_public, @ai_summary, @created_at, @created_at)`
      )
      .run({
        user_id: userId,
        title: opts.title || it.title,
        destination_id: destinationId,
        start_date: req.startDate || null,
        days: it.days.length,
        travelers: req.travelers,
        budget: req.budget,
        pace: req.pace,
        interests: JSON.stringify(req.interests),
        notes: [it.summary, "", ...it.tips.map((t) => `• ${t}`)].join("\n"),
        share_token: randomToken(12),
        is_public: opts.isPublic ? 1 : 0,
        ai_summary: it.summary,
        created_at: opts.createdAt || new Date().toISOString().slice(0, 19).replace("T", " "),
      }).lastInsertRowid
  );
  const ins = conn.prepare(
    `INSERT INTO trip_items (trip_id, day, position, place_id, title, note, start_time, duration_min, kind, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  if (it.hotelPlaceId) {
    const hotel = conn.prepare("SELECT name, price_usd FROM places WHERE id = ?").get(it.hotelPlaceId) as { name: string; price_usd: number } | undefined;
    if (hotel) ins.run(tripId, 1, -1, it.hotelPlaceId, hotel.name, "Your base for the trip — check in and drop your bags.", "08:00", 30, "place", 0);
  }
  for (const day of it.days) {
    day.stops.forEach((s, i) => {
      ins.run(tripId, day.day, i, s.placeId, s.title, s.note, s.startTime, s.durationMin, s.kind, s.costUsd);
    });
  }
  return tripId;
}
