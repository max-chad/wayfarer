import { db, json } from "../db";
import { randomToken } from "../password";
import type { BudgetStyle, PackingList, Pace, Trip, TripItem } from "../types";
import { getDestinationById } from "./destinations";
import { destinationToSummary, toPublicUser, type UserRow } from "./mappers";
import { getPlacesByIds } from "./places";

interface TripRow {
  id: number;
  user_id: number;
  title: string;
  destination_id: number | null;
  start_date: string | null;
  days: number;
  travelers: number;
  budget: BudgetStyle;
  pace: Pace;
  interests: string;
  notes: string;
  share_token: string | null;
  is_public: number;
  ai_summary: string;
  packing: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: number;
  trip_id: number;
  day: number;
  position: number;
  place_id: number | null;
  title: string;
  note: string;
  start_time: string | null;
  duration_min: number;
  kind: TripItem["kind"];
  cost_usd: number;
}

function hydrate(row: TripRow, withItems = true): Trip {
  const conn = db();
  const dest = row.destination_id ? getDestinationById(row.destination_id) : null;
  let items: TripItem[] = [];
  if (withItems) {
    const rows = conn.prepare("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day, position, id").all(row.id) as ItemRow[];
    const places = new Map(getPlacesByIds(rows.map((r) => r.place_id!).filter(Boolean)).map((p) => [p.id, p]));
    items = rows.map((r) => ({
      id: r.id,
      tripId: r.trip_id,
      day: r.day,
      position: r.position,
      placeId: r.place_id,
      title: r.title,
      note: r.note,
      startTime: r.start_time,
      durationMin: r.duration_min,
      kind: r.kind,
      costUsd: r.cost_usd,
      place: r.place_id ? places.get(r.place_id) || null : null,
    }));
  }
  const owner = conn.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as UserRow | undefined;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    destinationId: row.destination_id,
    destination: dest ? destinationToSummary(dest) : null,
    startDate: row.start_date,
    days: row.days,
    travelers: row.travelers,
    budget: row.budget,
    pace: row.pace,
    interests: json(row.interests, []),
    notes: row.notes,
    shareToken: row.share_token,
    isPublic: !!row.is_public,
    aiSummary: row.ai_summary,
    packing: json<PackingList | null>(row.packing, null),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: owner ? toPublicUser(owner) : undefined,
  };
}

export function listTrips(userId: number): (Trip & { itemCount: number })[] {
  const rows = db().prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as TripRow[];
  return rows.map((r) => {
    const t = hydrate(r, false);
    const n = (db().prepare("SELECT COUNT(*) n FROM trip_items WHERE trip_id = ?").get(r.id) as { n: number }).n;
    return { ...t, itemCount: n };
  });
}

export function publicTrips(limit = 6) {
  const rows = db().prepare("SELECT * FROM trips WHERE is_public = 1 ORDER BY updated_at DESC LIMIT ?").all(limit) as TripRow[];
  return rows.map((r) => hydrate(r, false));
}

export function getTrip(id: number): Trip | null {
  const r = db().prepare("SELECT * FROM trips WHERE id = ?").get(id) as TripRow | undefined;
  return r ? hydrate(r) : null;
}

export function getTripByShareToken(token: string): Trip | null {
  const r = db().prepare("SELECT * FROM trips WHERE share_token = ? AND is_public = 1").get(token) as TripRow | undefined;
  return r ? hydrate(r) : null;
}

export function canEditTrip(trip: Trip | null, userId: number | undefined | null) {
  return !!trip && !!userId && trip.userId === userId;
}

export function createTrip(
  userId: number,
  data: { title: string; destinationId: number | null; startDate?: string | null; days?: number; travelers?: number; budget?: BudgetStyle; pace?: Pace; interests?: string[] }
) {
  const id = Number(
    db()
      .prepare(
        "INSERT INTO trips (user_id, title, destination_id, start_date, days, travelers, budget, pace, interests, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        userId,
        data.title.slice(0, 120) || "My trip",
        data.destinationId,
        data.startDate || null,
        Math.min(21, Math.max(1, data.days || 3)),
        Math.min(12, Math.max(1, data.travelers || 2)),
        data.budget || "midrange",
        data.pace || "balanced",
        JSON.stringify(data.interests || []),
        randomToken(12)
      ).lastInsertRowid
  );
  return id;
}

export function updateTrip(
  id: number,
  patch: Partial<{ title: string; startDate: string | null; days: number; travelers: number; budget: BudgetStyle; pace: Pace; notes: string; isPublic: boolean; packing: PackingList | null }>
) {
  const cols: string[] = [];
  const vals: unknown[] = [];
  const set = (c: string, v: unknown) => {
    cols.push(`${c} = ?`);
    vals.push(v);
  };
  if (patch.title !== undefined) set("title", patch.title.slice(0, 120));
  if (patch.startDate !== undefined) set("start_date", patch.startDate || null);
  if (patch.days !== undefined) set("days", Math.min(21, Math.max(1, patch.days)));
  if (patch.travelers !== undefined) set("travelers", Math.min(12, Math.max(1, patch.travelers)));
  if (patch.budget !== undefined) set("budget", patch.budget);
  if (patch.pace !== undefined) set("pace", patch.pace);
  if (patch.notes !== undefined) set("notes", patch.notes.slice(0, 5000));
  if (patch.isPublic !== undefined) set("is_public", patch.isPublic ? 1 : 0);
  if (patch.packing !== undefined) set("packing", patch.packing ? JSON.stringify(patch.packing) : null);
  if (!cols.length) return;
  cols.push("updated_at = datetime('now')");
  db().prepare(`UPDATE trips SET ${cols.join(", ")} WHERE id = ?`).run(...vals, id);
  if (patch.days !== undefined) db().prepare("UPDATE trip_items SET day = ? WHERE trip_id = ? AND day > ?").run(patch.days, id, patch.days);
}

export function deleteTrip(id: number) {
  db().prepare("DELETE FROM trips WHERE id = ?").run(id);
}

export function addTripItem(
  tripId: number,
  item: { day: number; placeId?: number | null; title?: string; note?: string; startTime?: string | null; durationMin?: number; kind?: TripItem["kind"]; costUsd?: number }
) {
  const conn = db();
  const pos = (conn.prepare("SELECT COALESCE(MAX(position), -1) + 1 p FROM trip_items WHERE trip_id = ? AND day = ?").get(tripId, item.day) as { p: number }).p;
  let title = item.title || "";
  let cost = item.costUsd ?? 0;
  let duration = item.durationMin ?? 90;
  if (item.placeId) {
    const p = conn.prepare("SELECT name, price_usd, type, details FROM places WHERE id = ?").get(item.placeId) as
      | { name: string; price_usd: number; type: string; details: string }
      | undefined;
    if (p) {
      title = title || p.name;
      if (item.costUsd === undefined) cost = p.type === "restaurant" ? p.price_usd * 0.8 : p.type === "hotel" ? 0 : p.price_usd;
      if (item.durationMin === undefined) duration = json<{ durationMin?: number }>(p.details, {}).durationMin || (p.type === "restaurant" ? 75 : 90);
    }
  }
  const id = Number(
    conn
      .prepare(
        "INSERT INTO trip_items (trip_id, day, position, place_id, title, note, start_time, duration_min, kind, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(tripId, item.day, pos, item.placeId || null, title || "Untitled", item.note || "", item.startTime || null, duration, item.kind || "place", Math.round(cost))
      .lastInsertRowid
  );
  touch(tripId);
  return id;
}

export function updateTripItem(tripId: number, itemId: number, patch: Partial<{ title: string; note: string; startTime: string | null; durationMin: number; costUsd: number; day: number }>) {
  const cols: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) (cols.push("title = ?"), vals.push(patch.title.slice(0, 200)));
  if (patch.note !== undefined) (cols.push("note = ?"), vals.push(patch.note.slice(0, 2000)));
  if (patch.startTime !== undefined) (cols.push("start_time = ?"), vals.push(patch.startTime || null));
  if (patch.durationMin !== undefined) (cols.push("duration_min = ?"), vals.push(Math.max(5, Math.min(1440, patch.durationMin))));
  if (patch.costUsd !== undefined) (cols.push("cost_usd = ?"), vals.push(Math.max(0, patch.costUsd)));
  if (patch.day !== undefined) (cols.push("day = ?"), vals.push(patch.day));
  if (!cols.length) return;
  db().prepare(`UPDATE trip_items SET ${cols.join(", ")} WHERE id = ? AND trip_id = ?`).run(...vals, itemId, tripId);
  touch(tripId);
}

export function removeTripItem(tripId: number, itemId: number) {
  db().prepare("DELETE FROM trip_items WHERE id = ? AND trip_id = ?").run(itemId, tripId);
  touch(tripId);
}

/** Applies a full ordering: [{id, day, position}] */
export function reorderTripItems(tripId: number, order: { id: number; day: number; position: number; startTime?: string | null }[]) {
  const conn = db();
  const stmt = conn.prepare("UPDATE trip_items SET day = ?, position = ?, start_time = COALESCE(?, start_time) WHERE id = ? AND trip_id = ?");
  conn.transaction(() => {
    for (const o of order) stmt.run(o.day, o.position, o.startTime ?? null, o.id, tripId);
  })();
  touch(tripId);
}

export function duplicateTrip(tripId: number, userId: number) {
  const conn = db();
  const t = getTrip(tripId);
  if (!t) return null;
  const id = createTrip(userId, {
    title: `${t.title} (copy)`,
    destinationId: t.destinationId,
    startDate: t.startDate,
    days: t.days,
    travelers: t.travelers,
    budget: t.budget,
    pace: t.pace,
    interests: t.interests,
  });
  conn.prepare("UPDATE trips SET notes = ?, ai_summary = ? WHERE id = ?").run(t.notes, t.aiSummary, id);
  const ins = conn.prepare(
    "INSERT INTO trip_items (trip_id, day, position, place_id, title, note, start_time, duration_min, kind, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const i of t.items) ins.run(id, i.day, i.position, i.placeId, i.title, i.note, i.startTime, i.durationMin, i.kind, i.costUsd);
  return id;
}

function touch(tripId: number) {
  db().prepare("UPDATE trips SET updated_at = datetime('now') WHERE id = ?").run(tripId);
}
