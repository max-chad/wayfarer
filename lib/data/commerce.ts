import crypto from "node:crypto";
import { db, json } from "../db";
import { COMMISSION, HOTEL_PARTNERS, hotelCpcCents, tierRank, type BusinessTier, type PartnerKey } from "../plans";
import { addDays, nightlyRate, todayIso } from "../pricing";
import { signToken } from "../sign";
import { localToUtcMs, nowAt } from "../time";
import type { DestinationInfo, ImageRef, PlaceDetails, PlaceType } from "../types";
import { rng } from "../utils";
import { getPlan, sweepSubscriptions } from "./billing";
import { notify } from "./notifications";
import { addTripItem, getTrip } from "./trips";

// ── Analytics counters (aggregated per place per day; no personal data) ─────

type Counter = "views" | "saves" | "clickouts" | "bookings";

export function bumpPlaceDaily(placeId: number, field: Counter, n = 1, cents?: { clickout?: number; commission?: number }, day = todayIso()) {
  try {
    db()
      .prepare(
        `INSERT INTO place_daily (place_id, day, ${field}, clickout_cents, commission_cents) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(place_id, day) DO UPDATE SET ${field} = ${field} + excluded.${field},
           clickout_cents = clickout_cents + excluded.clickout_cents, commission_cents = commission_cents + excluded.commission_cents`
      )
      .run(placeId, day, n, cents?.clickout ?? 0, cents?.commission ?? 0);
  } catch {
    /* analytics must never break a page */
  }
}

export const trackPlaceView = (placeId: number) => bumpPlaceDaily(placeId, "views");

// ── Hotel offers (meta-search) ──────────────────────────────────────────────

interface PlaceCommerceRow {
  id: number;
  slug: string;
  name: string;
  type: PlaceType;
  price_usd: number;
  price_level: number;
  details: string;
  info: string;
  destination_id: number;
  neighborhood: string;
  image: string | null;
  destination_name: string;
  tz: string | null;
}

function commercePlace(placeId: number) {
  return db()
    .prepare(
      `SELECT p.id, p.slug, p.name, p.type, p.price_usd, p.price_level, p.details, p.destination_id, p.neighborhood, p.image, d.info, d.name AS destination_name,
        json_extract(d.info, '$.timezone') AS tz
       FROM places p JOIN destinations d ON d.id = p.destination_id WHERE p.id = ?`
    )
    .get(placeId) as PlaceCommerceRow | undefined;
}

function seasonOf(row: PlaceCommerceRow) {
  const info = json<Partial<DestinationInfo>>(row.info, {});
  return { bestMonths: info.bestMonths || [], avoidMonths: info.avoidMonths || [], eventMonths: (info.events || []).map((e) => e.month) };
}

export interface HotelOffer {
  partner: PartnerKey;
  partnerName: string;
  color: string;
  nightlyUsd: number;
  totalUsd: number;
  perks: string[];
  token: string;
  direct: boolean;
}

export interface OfferSearch {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
}

export function validateStay(checkIn: string, nights: number, guests: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return "Pick a check-in date";
  const today = todayIso();
  if (checkIn < today) return "Check-in can't be in the past";
  if (checkIn > addDays(today, 365)) return "We show prices up to a year ahead";
  if (!Number.isInteger(nights) || nights < 1 || nights > 14) return "Stays of 1–14 nights";
  if (!Number.isInteger(guests) || guests < 1 || guests > 8) return "1–8 guests";
  return null;
}

function stayTotal(row: PlaceCommerceRow, partner: { key: string; priceBias: number }, s: { checkIn: string; nights: number; guests: number }, today?: string) {
  let total = 0;
  for (let i = 0; i < s.nights; i++) {
    total += nightlyRate({
      placeId: row.id,
      baseUsd: row.price_usd,
      date: addDays(s.checkIn, i),
      guests: s.guests,
      season: seasonOf(row),
      partnerKey: partner.key,
      partnerBias: partner.priceBias,
      today,
    });
  }
  return Math.round(total);
}

/**
 * Prices from every partner for a stay, cheapest first. Ranking is by price only — never by
 * commission. Hotels on Business Insights+ also get a commission-free Book Direct link; we don't
 * know their direct rate, so it is shown separately and never claims to be the lowest.
 */
export function hotelOffers(
  placeId: number,
  s: { checkIn: string; nights: number; guests: number }
): (OfferSearch & { offers: HotelOffer[]; direct: { token: string; host: string } | null; placeName: string }) | null {
  const row = commercePlace(placeId);
  if (!row || row.type !== "hotel") return null;
  sweepSubscriptions();
  const offers: HotelOffer[] = HOTEL_PARTNERS.map((p) => {
    const total = stayTotal(row, p, s);
    return {
      partner: p.key,
      partnerName: p.name,
      color: p.color,
      nightlyUsd: Math.round(total / s.nights),
      totalUsd: total,
      perks: [...p.perks],
      token: signToken({ pl: row.id, pk: p.key, pr: total * 100, ci: s.checkIn, n: s.nights, g: s.guests }),
      direct: false,
    };
  });
  offers.sort((a, b) => a.totalUsd - b.totalUsd);
  const biz = db().prepare("SELECT tier, booking_url FROM businesses WHERE place_id = ? AND status = 'verified'").get(placeId) as
    | { tier: BusinessTier; booking_url: string | null }
    | undefined;
  let direct: { token: string; host: string } | null = null;
  if (biz && tierRank(biz.tier) >= 1 && biz.booking_url) {
    try {
      const host = new URL(biz.booking_url).hostname;
      direct = { token: signToken({ pl: row.id, pk: "direct", pr: 0, ci: s.checkIn, n: s.nights, g: s.guests, u: biz.booking_url }), host };
    } catch {
      direct = null;
    }
  }
  return { checkIn: s.checkIn, checkOut: addDays(s.checkIn, s.nights), nights: s.nights, guests: s.guests, offers, direct, placeName: row.name };
}

export function lowestStayPriceCents(placeId: number, s: { checkIn: string; nights: number; guests: number }, today?: string) {
  const row = commercePlace(placeId);
  if (!row || row.type !== "hotel") return null;
  return Math.min(...HOTEL_PARTNERS.map((p) => stayTotal(row, p, s, today))) * 100;
}

// ── Click-outs ──────────────────────────────────────────────────────────────

export interface ClickoutPayload {
  pl: number;
  pk: PartnerKey;
  pr: number;
  ci: string;
  n: number;
  g: number;
  u?: string;
}

const recentClicks = new Map<string, number>();

/**
 * True when this visitor+thing has not been seen in the last 30 minutes; records the touch.
 * shortcut: memory only — a restart re-bills the last 30 minutes of clicks; move to SQLite if that matters.
 */
export function billable(key: string): boolean {
  const now = Date.now();
  const last = recentClicks.get(key);
  recentClicks.set(key, now);
  if (recentClicks.size > 20000) recentClicks.delete(recentClicks.keys().next().value as string);
  return !last || now - last > 30 * 60_000;
}

/**
 * Records a partner click-out and its CPC revenue. Repeat clicks on the same offer from the same
 * visitor within 30 minutes aren't billable (basic click-fraud protection).
 */
export function recordClickout(p: ClickoutPayload, visitor: string, userId: number | null) {
  const row = commercePlace(p.pl);
  if (!row) return { revenueCents: 0, billable: false };
  const bill = billable(`${visitor}:${p.pl}:${p.pk}`);
  const revenue = bill ? hotelCpcCents(row.price_level, p.pk) : 0;
  db()
    .prepare("INSERT INTO clickouts (place_id, user_id, partner, price_cents, revenue_cents) VALUES (?, ?, ?, ?, ?)")
    .run(p.pl, userId, p.pk, Math.round(p.pr), revenue);
  if (bill) bumpPlaceDaily(p.pl, "clickouts", 1, { clickout: revenue });
  return { revenueCents: revenue, billable: bill, place: { slug: row.slug, name: row.name } };
}

// ── Bookable experiences, tickets & tables ──────────────────────────────────

export type BookingKind = "experience" | "ticket" | "table";

export function bookingKindFor(place: { type: PlaceType; priceUsd: number }): BookingKind | null {
  if (place.type === "experience") return "experience";
  if (place.type === "attraction" && place.priceUsd > 0) return "ticket";
  if (place.type === "restaurant") return "table";
  return null;
}

export interface Slot {
  time: string;
  left: number;
}

export function availability(placeId: number, date: string): { kind: BookingKind; slots: Slot[]; priceUsd: number; timezone: string } | null {
  const row = commercePlace(placeId);
  if (!row) return null;
  const tz = row.tz || "UTC";
  const kind = bookingKindFor({ type: row.type, priceUsd: row.price_usd });
  if (!kind) return null;
  const d = json<PlaceDetails>(row.details, {});
  let times: string[];
  if (kind === "table") {
    const meals = d.meals || ["lunch", "dinner"];
    times = [
      ...(meals.includes("breakfast") || meals.includes("brunch") ? ["09:00", "10:00", "11:00"] : []),
      ...(meals.includes("lunch") ? ["12:00", "12:30", "13:00", "13:30", "14:00"] : []),
      ...(meals.includes("dinner") ? ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"] : []),
    ];
    if (!times.length) times = ["12:30", "19:30"];
  } else if (kind === "ticket") {
    times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
  } else {
    const dur = d.durationMin || 180;
    if (d.bestTime === "evening") times = ["17:30", "19:00"];
    else if (dur >= 360) times = ["08:00"];
    else if (dur >= 180) times = ["09:00", "14:00"];
    else times = ["09:30", "11:00", "13:30", "15:00", "16:30"];
  }
  // Capacity left = a deterministic "sold elsewhere" share, minus confirmed Wayfarer bookings.
  const booked = new Map(
    (
      db()
        .prepare("SELECT time, COUNT(*) n, SUM(party) seats FROM bookings WHERE place_id = ? AND date = ? AND status = 'confirmed' GROUP BY time")
        .all(placeId, date) as { time: string; n: number; seats: number }[]
    ).map((b) => [b.time, kind === "table" ? b.n : b.seats])
  );
  // Same-day slots close an hour before they start, in the destination's own time zone.
  const local = nowAt(tz);
  const cutoff = date === local.date ? addMinutes(local.time, 60) : null;
  const slots = times.map((time) => {
    const left = cutoff && time <= cutoff ? 0 : Math.max(0, slotBaseCapacity(placeId, date, time, kind) - (booked.get(time) ?? 0));
    return { time, left };
  });
  return { kind, slots, priceUsd: row.price_usd, timezone: tz };
}

/** The deterministic "sold elsewhere" capacity for one slot; shared by availability() and the booking transaction so both agree. */
function slotBaseCapacity(placeId: number, date: string, time: string, kind: BookingKind) {
  const R = rng(`${placeId}:${date}:${time}`);
  const cap = kind === "table" ? 6 : kind === "ticket" ? 40 : 14;
  return R.chance(kind === "table" ? 0.25 : 0.12) ? 0 : R.int(1, cap);
}

function addMinutes(hhmm: string, n: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + n);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export interface Booking {
  id: number;
  ref: string;
  kind: BookingKind;
  date: string;
  time: string | null;
  party: number;
  totalCents: number;
  commissionCents: number;
  status: "confirmed" | "canceled";
  contactName: string;
  notes: string;
  tripId: number | null;
  createdAt: string;
  /** The venue's IANA time zone; the booking's date and time are local to it. */
  timezone: string;
  place: { id: number; slug: string; name: string; type: PlaceType; image: ImageRef | null; destinationName: string; neighborhood: string };
}

interface BookingRow {
  id: number;
  ref: string;
  kind: BookingKind;
  date: string;
  time: string | null;
  party: number;
  total_cents: number;
  commission_cents: number;
  status: "confirmed" | "canceled";
  contact_name: string;
  notes: string;
  trip_id: number | null;
  created_at: string;
  place_id: number;
  slug: string;
  name: string;
  type: PlaceType;
  image: string | null;
  destination_name: string;
  neighborhood: string;
  tz: string | null;
}

const BOOKING_SELECT = `SELECT b.*, p.slug, p.name, p.type, p.image, p.neighborhood, d.name AS destination_name,
  json_extract(d.info, '$.timezone') AS tz
  FROM bookings b JOIN places p ON p.id = b.place_id JOIN destinations d ON d.id = p.destination_id`;

const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  ref: r.ref,
  kind: r.kind,
  date: r.date,
  time: r.time,
  party: r.party,
  totalCents: r.total_cents,
  commissionCents: r.commission_cents,
  status: r.status,
  contactName: r.contact_name,
  notes: r.notes,
  tripId: r.trip_id,
  createdAt: r.created_at,
  timezone: r.tz || "UTC",
  place: { id: r.place_id, slug: r.slug, name: r.name, type: r.type, image: json<ImageRef | null>(r.image, null), destinationName: r.destination_name, neighborhood: r.neighborhood },
});

export class BookingError extends Error {}

function newRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return "WF-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function createBooking(
  userId: number,
  input: { placeId: number; date: string; time: string; party: number; contactName: string; notes?: string; tripId?: number | null }
) {
  const avail = availability(input.placeId, input.date);
  if (!avail) throw new BookingError("This place can't be booked through Wayfarer");
  const today = nowAt(avail.timezone).date;
  if (input.date < today) throw new BookingError("That date has passed");
  if (input.date > addDays(today, 365)) throw new BookingError("Bookings open up to a year ahead");
  const slot = avail.slots.find((s) => s.time === input.time);
  if (!slot) throw new BookingError("Pick an available time");
  if (slot.left < (avail.kind === "table" ? 1 : input.party)) throw new BookingError("Not enough availability at that time — try another slot");
  if (input.party < 1 || input.party > (avail.kind === "table" ? 10 : 15)) throw new BookingError("Party size isn't available online — contact the venue");

  const total = avail.kind === "table" ? 0 : Math.round(avail.priceUsd * 100) * input.party;
  const commission = avail.kind === "table" ? COMMISSION.restaurantPerCoverCents * input.party : Math.round(total * COMMISSION.experienceRate);
  const conn = db();
  let tripId: number | null = null;
  if (input.tripId) {
    const trip = getTrip(input.tripId);
    const destId = (conn.prepare("SELECT destination_id FROM places WHERE id = ?").get(input.placeId) as { destination_id: number }).destination_id;
    if (!trip || trip.userId !== userId) throw new BookingError("Trip not found");
    if (trip.destinationId !== destId) throw new BookingError("That trip is for a different destination");
    tripId = trip.id;
  }
  const ref = newRef();
  const need = avail.kind === "table" ? 1 : input.party;
  // Re-check capacity and insert atomically: a second request (or a second process on this file)
  // cannot slip an insert between the read and the write.
  const id = Number(
    conn.transaction(() => {
      const bookedRow = conn
        .prepare("SELECT COUNT(*) n, COALESCE(SUM(party),0) seats FROM bookings WHERE place_id = ? AND date = ? AND time = ? AND status = 'confirmed'")
        .get(input.placeId, input.date, input.time) as { n: number; seats: number };
      const booked = avail.kind === "table" ? bookedRow.n : bookedRow.seats;
      const local2 = nowAt(avail.timezone);
      const cutoff = input.date === local2.date ? addMinutes(local2.time, 60) : null;
      const left = cutoff && input.time <= cutoff ? 0 : Math.max(0, slotBaseCapacity(input.placeId, input.date, input.time, avail.kind) - booked);
      if (left < need) throw new BookingError("That time just filled up — pick another slot");
      return conn
        .prepare(
          "INSERT INTO bookings (ref, user_id, place_id, trip_id, kind, date, time, party, total_cents, commission_cents, contact_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(ref, userId, input.placeId, tripId, avail.kind, input.date, input.time, input.party, total, commission, input.contactName.slice(0, 80), (input.notes || "").slice(0, 400)).lastInsertRowid;
    })()
  );
  bumpPlaceDaily(input.placeId, "bookings", 1, { commission });

  if (tripId) {
    const trip = getTrip(tripId)!;
    let day = 1;
    if (trip.startDate) {
      const diff = Math.round((Date.parse(input.date) - Date.parse(trip.startDate)) / 86400000) + 1;
      day = diff >= 1 && diff <= trip.days ? diff : 1;
    }
    addTripItem(tripId, { day, placeId: input.placeId, startTime: input.time, note: `Booked ✓ · ${ref} · ${input.party} ${input.party === 1 ? "person" : "people"}`, costUsd: total / 100 });
  }
  const b = getBookingById(id)!;
  notify(userId, {
    kind: "booking",
    title: `${avail.kind === "table" ? "Table reserved" : "Booking confirmed"}: ${b.place.name}`,
    body: `${b.date} at ${b.time} · ${b.party} ${b.party === 1 ? "person" : "people"} · ref ${ref}`,
    url: `/bookings/${ref}`,
  });
  return b;
}

function getBookingById(id: number) {
  const r = db().prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id) as BookingRow | undefined;
  return r ? toBooking(r) : null;
}

export function getBooking(ref: string, userId: number) {
  const r = db().prepare(`${BOOKING_SELECT} WHERE b.ref = ? AND b.user_id = ?`).get(ref, userId) as BookingRow | undefined;
  return r ? toBooking(r) : null;
}

export function userBookings(userId: number) {
  return (db().prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.date DESC, b.time DESC`).all(userId) as BookingRow[]).map(toBooking);
}

/** True while a booking is confirmed and more than 24 hours away, in the venue's time zone. */
export function isCancellable(b: Pick<Booking, "status" | "date" | "time" | "timezone">) {
  return b.status === "confirmed" && localToUtcMs(b.date, b.time || "12:00", b.timezone) - Date.now() > 24 * 3600_000;
}

/** Free cancellation up to 24 hours before; the commission is reversed on the day it was earned. */
export function cancelBooking(userId: number, ref: string) {
  const b = getBooking(ref, userId);
  if (!b) throw new BookingError("Booking not found");
  if (b.status === "canceled") return b;
  if (!isCancellable(b)) throw new BookingError("Free cancellation ends 24 hours before the start time — please contact the venue");
  const conn = db();
  conn.prepare("UPDATE bookings SET status = 'canceled' WHERE id = ?").run(b.id);
  conn
    .prepare("UPDATE place_daily SET bookings = MAX(0, bookings - 1), commission_cents = MAX(0, commission_cents - ?) WHERE place_id = ? AND day = ?")
    .run(b.commissionCents, b.place.id, b.createdAt.slice(0, 10));
  if (b.tripId) conn.prepare("DELETE FROM trip_items WHERE trip_id = ? AND place_id = ? AND note LIKE ?").run(b.tripId, b.place.id, `%${b.ref}%`);
  return { ...b, status: "canceled" as const };
}

export function bookingsForTrip(userId: number, tripId: number) {
  return (db().prepare(`${BOOKING_SELECT} WHERE b.user_id = ? AND (b.trip_id = ? OR b.place_id IN (SELECT place_id FROM trip_items WHERE trip_id = ?)) AND b.status = 'confirmed'`).all(userId, tripId, tripId) as BookingRow[]).map(toBooking);
}

// ── Price alerts (Wayfarer Plus) ────────────────────────────────────────────

export interface PriceAlert {
  id: number;
  placeId: number;
  placeSlug: string;
  placeName: string;
  destinationName: string;
  image: ImageRef | null;
  checkIn: string;
  nights: number;
  guests: number;
  lastPriceCents: number;
  createdAt: string;
}

export function upsertPriceAlert(userId: number, placeId: number, s: { checkIn: string; nights: number; guests: number }) {
  const price = lowestStayPriceCents(placeId, s);
  if (price == null) throw new BookingError("Price alerts are available for hotels");
  db()
    .prepare(
      `INSERT INTO price_alerts (user_id, place_id, check_in, nights, guests, last_price_cents) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, place_id) DO UPDATE SET check_in = excluded.check_in, nights = excluded.nights, guests = excluded.guests,
         last_price_cents = excluded.last_price_cents, last_checked_at = datetime('now')`
    )
    .run(userId, placeId, s.checkIn, s.nights, s.guests, price);
  return price;
}

export function deletePriceAlert(userId: number, placeId: number) {
  return db().prepare("DELETE FROM price_alerts WHERE user_id = ? AND place_id = ?").run(userId, placeId).changes > 0;
}

export function userPriceAlerts(userId: number): PriceAlert[] {
  const rows = db()
    .prepare(
      `SELECT a.*, p.slug, p.name, p.image, d.name AS destination_name FROM price_alerts a JOIN places p ON p.id = a.place_id
       JOIN destinations d ON d.id = p.destination_id WHERE a.user_id = ? ORDER BY a.check_in`
    )
    .all(userId) as {
    id: number;
    place_id: number;
    slug: string;
    name: string;
    image: string | null;
    destination_name: string;
    check_in: string;
    nights: number;
    guests: number;
    last_price_cents: number;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeSlug: r.slug,
    placeName: r.name,
    destinationName: r.destination_name,
    image: json<ImageRef | null>(r.image, null),
    checkIn: r.check_in,
    nights: r.nights,
    guests: r.guests,
    lastPriceCents: r.last_price_cents,
    createdAt: r.created_at,
  }));
}

export function hasPriceAlert(userId: number, placeId: number) {
  return !!db().prepare("SELECT 1 FROM price_alerts WHERE user_id = ? AND place_id = ?").get(userId, placeId);
}

/** Re-prices every watcher's stays once per interval; run on a timer, not inside a request. */
export function sweepPriceAlerts() {
  try {
    for (const u of db().prepare("SELECT DISTINCT user_id FROM price_alerts").all() as { user_id: number }[]) checkPriceAlerts(u.user_id);
  } catch (e) {
    console.warn(`[alerts] price sweep failed: ${(e as Error).message}`);
  }
}

/** Re-prices a user's watched stays (at most hourly) and notifies on drops of 5% or more. */
export function checkPriceAlerts(userId: number) {
  if (getPlan(userId) !== "plus") return; // alerts pause when Plus lapses and resume if it is renewed
  const conn = db();
  conn.prepare("DELETE FROM price_alerts WHERE user_id = ? AND check_in < date('now')").run(userId);
  const due = conn
    .prepare("SELECT a.*, p.name, p.slug FROM price_alerts a JOIN places p ON p.id = a.place_id WHERE a.user_id = ? AND a.last_checked_at <= datetime('now', '-1 hour')")
    .all(userId) as { id: number; place_id: number; check_in: string; nights: number; guests: number; last_price_cents: number; name: string; slug: string }[];
  for (const a of due) {
    const now = lowestStayPriceCents(a.place_id, { checkIn: a.check_in, nights: a.nights, guests: a.guests });
    if (now == null) continue;
    if (now <= a.last_price_cents * 0.95) {
      const pct = Math.round((1 - now / a.last_price_cents) * 100);
      notify(userId, {
        kind: "price_drop",
        title: `Price drop: ${a.name} is ${pct}% cheaper`,
        body: `Now $${Math.round(now / 100)} for ${a.nights} night${a.nights > 1 ? "s" : ""} from ${a.check_in} (was $${Math.round(a.last_price_cents / 100)}).`,
        url: `/place/${a.slug}#prices`,
      });
    }
    conn.prepare("UPDATE price_alerts SET last_price_cents = ?, last_checked_at = datetime('now') WHERE id = ?").run(now, a.id);
  }
}
