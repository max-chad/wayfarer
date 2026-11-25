import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { COMMISSION, HOTEL_PARTNERS, hotelCpcCents, PRODUCTS, type BusinessTier, type ProductId } from "../plans";
import type { PlaceType } from "../types";
import type { Rng } from "../utils";
import { STAFF_NAMES } from "./people";

type DB = Database.Database;

const DAY = 86400000;
const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function addMonths(d: Date, n: number) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}

/** "YYYY-MM" for the month `k` months before `d` (safe on the 29th–31st). */
const monthKey = (d: Date, k: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)).toISOString().slice(0, 7);

interface SeedPlace {
  id: number;
  slug: string;
  name: string;
  type: PlaceType;
  rating: number;
  review_count: number;
  price_usd: number;
  price_level: number;
  destination_id: number;
  awards: string;
}

const ANNOUNCEMENTS: Record<string, string[]> = {
  hotel: ["Book direct and get a free welcome drink on arrival.", "Our rooftop terrace is open again for sunset drinks.", "Stay 3 nights, get late check-out on us."],
  restaurant: ["New seasonal tasting menu from this month.", "Terrace tables can now be reserved online.", "Sunday lunch is back — book ahead, it fills up fast."],
  experience: ["Small groups only: max 10 guests per departure.", "New sunset departures added for the summer season.", "Private tours available on request."],
};

/**
 * Commercial history for the demo: Plus subscribers, claimed business listings and their plans,
 * sponsored campaigns, API customers, and 90 days of traffic, click-outs and bookings.
 */
export function seedBusinessModel(conn: DB, R: Rng) {
  const now = new Date();
  const places = conn
    .prepare("SELECT id, slug, name, type, rating, review_count, price_usd, price_level, destination_id, awards FROM places")
    .all() as SeedPlace[];
  const demo = conn.prepare("SELECT id FROM users WHERE username = 'demo'").get() as { id: number } | undefined;

  const insUser = conn.prepare(
    "INSERT INTO users (username, email, password_hash, display_name, avatar_color, role, is_demo, created_at) VALUES (?, NULL, NULL, ?, '#475569', 'user', 1, ?)"
  );
  const insSub = conn.prepare(
    `INSERT INTO subscriptions (user_id, product, place_id, interval, price_cents, status, cancel_at_period_end, current_period_end, started_at, canceled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insInvoice = conn.prepare("INSERT INTO invoices (user_id, subscription_id, stream, description, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const insBiz = conn.prepare(
    `INSERT INTO businesses (place_id, user_id, status, tier, contact_name, contact_role, website, booking_url, announcement, verify_code, verified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  /** Inserts a subscription with its invoice history; returns the subscription id. */
  const subscription = (userId: number, product: ProductId, interval: "month" | "year", start: Date, opts: { placeId?: number; cancelAt?: Date | null } = {}) => {
    const p = PRODUCTS[product];
    const price = interval === "year" && p.yearlyCents ? p.yearlyCents : p.monthlyCents;
    const step = interval === "year" ? 12 : 1;
    const end = opts.cancelAt ?? null;
    let k = 0;
    let periodEnd = addMonths(start, step);
    const invoiceDates: Date[] = [start];
    while (periodEnd <= now && (!end || periodEnd <= end)) {
      invoiceDates.push(periodEnd);
      k++;
      periodEnd = addMonths(start, step * (k + 1));
    }
    const status = end && periodEnd <= now ? "canceled" : "active";
    const id = Number(
      insSub.run(
        userId,
        product,
        opts.placeId ?? null,
        interval,
        price,
        status,
        end ? 1 : 0,
        sqlTime(periodEnd),
        sqlTime(start),
        end ? sqlTime(end) : null
      ).lastInsertRowid
    );
    for (const d of invoiceDates) {
      insInvoice.run(userId, id, p.stream, `${p.name} — ${d === start ? (interval === "year" ? "annual plan" : "monthly plan") : "renewal"}`, price, sqlTime(d));
    }
    return id;
  };

  // ── Wayfarer Plus subscribers (from active contributors) ──────────────────
  const contributors = conn
    .prepare("SELECT u.id FROM users u JOIN reviews r ON r.user_id = u.id WHERE u.is_demo = 1 GROUP BY u.id HAVING COUNT(*) >= 3")
    .all() as { id: number }[];
  for (const u of R.sample(contributors, Math.round(contributors.length * 0.14))) {
    const start = new Date(now.getTime() - R.int(4, 330) * DAY - R.int(0, 86000) * 1000);
    const interval = R.chance(0.4) ? "year" : "month";
    const churn = R.chance(0.18) ? new Date(start.getTime() + R.int(20, Math.max(25, Math.round((now.getTime() - start.getTime()) / DAY))) * DAY) : null;
    subscription(u.id, "plus", interval, start, { cancelAt: churn && churn < now ? churn : null });
  }

  // ── Claimed business listings ─────────────────────────────────────────────
  const demoHotel = places.find((p) => p.slug === "hotel-cortica-belem-lisbon") || places.find((p) => p.type === "hotel");
  const demoRestaurant = places.find((p) => p.slug === "petisqueira-cais-torto-lisbon") || places.find((p) => p.type === "restaurant");
  const reserved = new Set([demoHotel?.id, demoRestaurant?.id]);
  const eligible = places.filter((p) => p.type !== "attraction" && !reserved.has(p.id));
  const claimed = R.sample(eligible, Math.round(eligible.length * 0.15));
  const businesses: { id: number; place: SeedPlace; tier: BusinessTier; verified: boolean; since: Date }[] = [];

  for (const p of claimed) {
    const since = new Date(now.getTime() - R.int(10, 420) * DAY);
    const contact = R.pick(STAFF_NAMES);
    const owner = Number(insUser.run(`biz_${p.id}`, `${contact} (${p.name})`, sqlTime(since)).lastInsertRowid);
    const verified = R.chance(0.92);
    const tier: BusinessTier = !verified ? "free" : R.chance(0.1) ? "pro" : R.chance(0.3) ? "insights" : "free";
    const role = p.type === "hotel" ? R.pick(["General Manager", "Front Office Manager", "Owner"]) : p.type === "restaurant" ? R.pick(["Owner", "Restaurant Manager", "Head Chef"]) : R.pick(["Founder", "Operations Lead", "Owner"]);
    const announcement = tier !== "free" && R.chance(0.6) ? R.pick(ANNOUNCEMENTS[p.type] || ANNOUNCEMENTS.experience) : null;
    const bookingUrl = tier !== "free" && p.type === "hotel" ? `https://example.com/book/${p.slug}` : null;
    const website = tier !== "free" ? "https://example.com" : null;
    const verifiedAt = verified ? new Date(since.getTime() + R.int(0, 3) * DAY) : null;
    const bizId = Number(
      insBiz.run(
        p.id,
        owner,
        verified ? "verified" : "pending",
        tier,
        contact,
        role,
        website,
        bookingUrl,
        announcement,
        verified ? null : String(R.int(100000, 999999)),
        verifiedAt ? sqlTime(verifiedAt) : null,
        sqlTime(since)
      ).lastInsertRowid
    );
    if (tier !== "free") {
      // Upgrade a few days after verifying, but never in the future: a paid tier always has a subscription.
      const start = new Date(Math.min(verifiedAt!.getTime() + R.int(0, 25) * DAY, now.getTime() - DAY));
      subscription(owner, tier === "pro" ? "business_pro" : "business_insights", R.chance(0.2) ? "year" : "month", start, { placeId: p.id });
    }
    businesses.push({ id: bizId, place: p, tier, verified, since });
  }

  // The demo account manages two Lisbon listings so the business dashboard has something to show.
  if (demo && demoHotel && demoRestaurant) {
    const since = new Date(now.getTime() - 120 * DAY);
    const hotelBiz = Number(
      insBiz.run(
        demoHotel.id,
        demo.id,
        "verified",
        "insights",
        "Demo Traveler",
        "General Manager",
        "https://example.com",
        `https://example.com/book/${demoHotel.slug}`,
        ANNOUNCEMENTS.hotel[0],
        null,
        sqlTime(since),
        sqlTime(since)
      ).lastInsertRowid
    );
    subscription(demo.id, "business_insights", "month", new Date(since.getTime() + 2 * DAY), { placeId: demoHotel.id });
    const restBiz = Number(
      insBiz.run(demoRestaurant.id, demo.id, "verified", "free", "Demo Traveler", "Owner", null, null, null, null, sqlTime(new Date(now.getTime() - 40 * DAY)), sqlTime(new Date(now.getTime() - 41 * DAY)))
        .lastInsertRowid
    );
    businesses.push({ id: hotelBiz, place: demoHotel, tier: "insights", verified: true, since });
    businesses.push({ id: restBiz, place: demoRestaurant, tier: "free", verified: true, since: new Date(now.getTime() - 41 * DAY) });
  }

  // ── Sponsored campaigns ───────────────────────────────────────────────────
  const insCampaign = conn.prepare(
    "INSERT INTO campaigns (business_id, place_id, name, status, daily_budget_cents, cpc_cents, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insCampaignDay = conn.prepare("INSERT INTO campaign_daily (campaign_id, day, impressions, clicks, spend_cents) VALUES (?, ?, ?, ?, ?)");
  const advertisers = businesses.filter((b) => b.verified && b.place.rating >= 3.7 && (b.tier !== "free" ? R.chance(0.65) : R.chance(0.12)));
  const demoHotelBiz = businesses.find((b) => b.place.id === demoHotel?.id);
  if (demoHotelBiz && !advertisers.includes(demoHotelBiz)) advertisers.push(demoHotelBiz);
  for (const b of advertisers) {
    const isDemo = b === demoHotelBiz;
    const startDays = isDemo ? 45 : R.int(12, 85);
    const start = new Date(now.getTime() - startDays * DAY);
    const budget = isDemo ? 1500 : R.pick([500, 800, 1000, 1500, 2000, 2500]);
    const cpc = isDemo ? 65 : R.int(30, 140);
    const paused = !isDemo && R.chance(0.15);
    const pausedAfter = paused ? R.int(5, startDays - 1) : startDays;
    const name = R.pick(["Always-on listing boost", `${b.place.name} — peak season`, "Weekend getaways", "Sponsored listing", "Summer push"]);
    const cid = Number(insCampaign.run(b.id, b.place.id, name, paused ? "paused" : "active", budget, cpc, isoDay(start), null, sqlTime(start)).lastInsertRowid);
    const quality = Math.pow(b.place.rating / 5, 2);
    for (let i = 0; i < pausedAfter; i++) {
      const day = new Date(start.getTime() + i * DAY);
      if (day > now) break;
      const impressions = Math.round(R.int(120, 520) * quality * (1 + b.place.review_count / 80));
      const ctr = 0.012 + R.next() * 0.025;
      let clicks = Math.round(impressions * ctr);
      let spend = clicks * cpc;
      if (spend > budget) {
        clicks = Math.floor(budget / cpc);
        spend = clicks * cpc;
      }
      insCampaignDay.run(cid, isoDay(day), impressions, clicks, spend);
    }
  }

  // ── API customers ─────────────────────────────────────────────────────────
  const insKey = conn.prepare("INSERT INTO api_keys (user_id, name, prefix, key_hash, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const insApiUsage = conn.prepare("INSERT INTO api_usage (key_id, period, n) VALUES (?, ?, ?)");
  const devPool = R.sample(contributors, Math.min(30, contributors.length));
  devPool.forEach((u, i) => {
    const growth = i < 5;
    const created = new Date(now.getTime() - R.int(15, 240) * DAY);
    if (growth) subscription(u.id, "api_growth", "month", created);
    const key = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
    const kid = Number(
      insKey
        .run(u.id, growth ? R.pick(["Production", "Hotel CRM sync", "City guide app", "Tourism board site", "Travel blog widgets"]) : R.pick(["Side project", "Test", "Hackathon", "Prototype"]), key.slice(0, 14), crypto.createHash("sha256").update(key).digest("hex"), sqlTime(new Date(now.getTime() - R.int(0, 5) * DAY)), sqlTime(created))
        .lastInsertRowid
    );
    for (let m = 0; m < 4; m++) {
      const period = monthKey(now, m);
      if (period < created.toISOString().slice(0, 7)) break;
      insApiUsage.run(kid, period, growth ? R.int(9000, 68000) : R.int(20, 950));
    }
  });

  // ── 90 days of traffic, click-outs and bookings ───────────────────────────
  const insDaily = conn.prepare(
    "INSERT INTO place_daily (place_id, day, views, saves, clickouts, clickout_cents, bookings, commission_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insClickout = conn.prepare("INSERT INTO clickouts (place_id, user_id, partner, price_cents, revenue_cents, created_at) VALUES (?, NULL, ?, ?, ?, ?)");
  const DAYS = 90;
  const noisy = (x: number) => Math.max(0, Math.round(x * (0.75 + R.next() * 0.5)));
  for (const p of places) {
    const awards: string[] = JSON.parse(p.awards || "[]");
    const base = (4 + p.review_count * (p.type === "attraction" ? 0.75 : 0.6)) * (awards.length ? 1.25 : 1);
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * DAY);
      const progress = (DAYS - i) / DAYS;
      const dow = date.getUTCDay();
      const weekly = dow === 0 || dow === 1 ? 1.18 : dow === 5 ? 0.9 : 1;
      const views = noisy(base * (0.72 + 0.28 * progress) * weekly);
      if (!views) continue;
      const saves = Math.floor(views * (0.012 + R.next() * 0.02) + R.next());
      let clickouts = 0;
      let clickoutCents = 0;
      let bookings = 0;
      let commission = 0;
      if (p.type === "hotel") {
        clickouts = noisy(views * 0.08);
        for (let c = 0; c < clickouts; c++) {
          const partner = R.weighted(HOTEL_PARTNERS.map((x) => x.key), [0.34, 0.28, 0.22, 0.16]);
          const cents = hotelCpcCents(p.price_level, partner);
          clickoutCents += cents;
          if (i < 30) insClickout.run(p.id, partner, Math.round(p.price_usd * 2.6 * 100), cents, sqlTime(new Date(date.getTime() - R.int(0, 80000) * 1000)));
        }
      } else if (p.type === "experience" || (p.type === "attraction" && p.price_usd > 0)) {
        const rate = p.type === "experience" ? 0.011 : 0.005;
        for (let v = 0; v < views; v++) {
          if (R.next() < rate) {
            bookings++;
            const party = R.weighted([1, 2, 3, 4], [0.2, 0.5, 0.15, 0.15]);
            commission += Math.round(p.price_usd * party * 100 * COMMISSION.experienceRate);
          }
        }
      } else if (p.type === "restaurant") {
        for (let v = 0; v < views; v++) {
          if (R.next() < 0.012) {
            bookings++;
            commission += COMMISSION.restaurantPerCoverCents * R.weighted([2, 3, 4, 6], [0.55, 0.15, 0.2, 0.1]);
          }
        }
      }
      insDaily.run(p.id, isoDay(date), views, saves, clickouts, clickoutCents, bookings, commission);
    }
  }

  // ── Demo account: bookings on the Paris trip, notifications ───────────────
  if (demo) {
    const paris = conn.prepare("SELECT id, start_date FROM trips WHERE user_id = ? AND title LIKE 'Paris%'").get(demo.id) as { id: number; start_date: string | null } | undefined;
    const insBooking = conn.prepare(
      "INSERT INTO bookings (ref, user_id, place_id, trip_id, kind, date, time, party, total_cents, commission_cents, contact_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?, 'Demo Traveler', ?)"
    );
    const insNote = conn.prepare("INSERT INTO notifications (user_id, kind, title, body, url, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    if (paris?.start_date) {
      const items = conn
        .prepare("SELECT ti.id, ti.day, ti.start_time, ti.note, p.id AS place_id, p.type, p.name, p.price_usd FROM trip_items ti JOIN places p ON p.id = ti.place_id WHERE ti.trip_id = ? ORDER BY ti.day, ti.position")
        .all(paris.id) as { id: number; day: number; start_time: string | null; note: string; place_id: number; type: PlaceType; name: string; price_usd: number }[];
      const picks = [items.find((x) => x.type === "experience"), items.find((x) => x.type === "restaurant" && (x.start_time || "") >= "18:00")].filter(Boolean) as typeof items;
      picks.forEach((it, n) => {
        const date = isoDay(new Date(Date.parse(paris.start_date! + "T12:00:00Z") + (it.day - 1) * DAY));
        const kind = it.type === "restaurant" ? "table" : "experience";
        const total = kind === "table" ? 0 : Math.round(it.price_usd * 100) * 2;
        const commission = kind === "table" ? COMMISSION.restaurantPerCoverCents * 2 : Math.round(total * COMMISSION.experienceRate);
        const ref = n === 0 ? "WF-DEMO42" : "WF-DEMO7K";
        const created = new Date(now.getTime() - (3 - n) * DAY);
        insBooking.run(ref, demo.id, it.place_id, paris.id, kind, date, it.start_time || "19:00", total, commission, sqlTime(created));
        conn.prepare("UPDATE trip_items SET note = ? WHERE id = ?").run(`Booked ✓ · ${ref} · 2 people${it.note ? ` — ${it.note}` : ""}`, it.id);
        insNote.run(demo.id, "booking", `${kind === "table" ? "Table reserved" : "Booking confirmed"}: ${it.name}`, `${date} at ${it.start_time || "19:00"} · 2 people · ref ${ref}`, `/bookings/${ref}`, 1, sqlTime(created));
      });
    }
    if (demoHotel) {
      const latest = conn
        .prepare("SELECT r.title FROM reviews r WHERE r.place_id = ? AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 1")
        .get(demoHotel.id) as { title: string } | undefined;
      insNote.run(
        demo.id,
        "business",
        `New review for ${demoHotel.name}`,
        latest ? `“${latest.title}” — reply from your business dashboard.` : "Reply from your business dashboard.",
        `/business/${businesses.find((b) => b.place.id === demoHotel.id)?.id ?? ""}`,
        0,
        sqlTime(new Date(now.getTime() - 5 * 3600_000))
      );
    }
    insNote.run(demo.id, "billing", "Try Wayfarer Plus", "Unlimited AI trip plans, hotel price-drop alerts and no sponsored listings.", "/pricing", 0, sqlTime(new Date(now.getTime() - 26 * 3600_000)));
  }
}
