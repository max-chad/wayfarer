// Regression net for the money/quota/trust logic. Runs with `npm test` (node --test) against a
// temporary copy of the seeded database, the way scripts/test-claude-paths.ts does.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const src = path.join(process.cwd(), "data", "wayfarer.db");
const tmpDb = path.join(os.tmpdir(), `wayfarer-test-${process.pid}.db`);
if (fs.existsSync(src)) fs.copyFileSync(src, tmpDb); // otherwise db() seeds a fresh file automatically
process.env.DATABASE_PATH = tmpDb;

const { consumeQuota, sweepSubscriptions, subscribe } = await import("../lib/data/billing");
const { isCancellable } = await import("../lib/data/commerce");
const { createReview } = await import("../lib/data/reviews");
const { db } = await import("../lib/db");
const { TRUST_HOLD_THRESHOLD, scoreReviewTrust } = await import("../lib/ai/local/trust");
const { localToUtcMs } = await import("../lib/time");

const sqlNow = () => (db().prepare("SELECT datetime('now') v").get() as { v: string }).v;
const mkUser = () =>
  Number(db().prepare("INSERT INTO users (username, display_name) VALUES (?, ?)").run(`t${process.pid}-${Math.random().toString(36).slice(2, 8)}`, "Test User").lastInsertRowid);

test.after(() => {
  db().close(); // Windows refuses to unlink a file with an open handle
  for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) fs.rmSync(f, { force: true });
});

// ── subscription renewal math ───────────────────────────────────────────────

test("sweep renews a two-months-lapsed subscription, invoicing every missed month", () => {
  const { id: subId } = subscribe(mkUser(), "plus", "month");
  db().prepare("UPDATE subscriptions SET current_period_end = datetime('now', '-61 days') WHERE id = ?").run(subId);

  // Mirror the sweep's calendar-month loop so the expectation holds on any run date.
  let expectedInvoices = 0;
  for (let end = (db().prepare("SELECT current_period_end v FROM subscriptions WHERE id = ?").get(subId) as { v: string }).v; end <= sqlNow(); end = (db().prepare("SELECT datetime(?, '+1 month') v").get(end) as { v: string }).v) expectedInvoices++;
  assert.ok(expectedInvoices >= 2);
  const invoicesBefore = (db().prepare("SELECT COUNT(*) n FROM invoices WHERE subscription_id = ?").get(subId) as { n: number }).n;

  sweepSubscriptions(true);

  const sub = db().prepare("SELECT current_period_end, status FROM subscriptions WHERE id = ?").get(subId) as { current_period_end: string; status: string };
  const invoices = (db().prepare("SELECT COUNT(*) n FROM invoices WHERE subscription_id = ?").get(subId) as { n: number }).n;
  assert.equal(sub.status, "active");
  assert.ok(sub.current_period_end > sqlNow(), "period end must roll into the future");
  assert.equal(invoices - invoicesBefore, expectedInvoices, "one renewal invoice per missed month");
});

test("sweep expires a cancel-at-period-end subscription without a new invoice", () => {
  const { id: subId } = subscribe(mkUser(), "api_growth", "month");
  db().prepare("UPDATE subscriptions SET cancel_at_period_end = 1, current_period_end = datetime('now', '-1 day') WHERE id = ?").run(subId);
  const invoicesBefore = (db().prepare("SELECT COUNT(*) n FROM invoices WHERE subscription_id = ?").get(subId) as { n: number }).n;

  sweepSubscriptions(true);

  const sub = db().prepare("SELECT status FROM subscriptions WHERE id = ?").get(subId) as { status: string };
  const invoices = (db().prepare("SELECT COUNT(*) n FROM invoices WHERE subscription_id = ?").get(subId) as { n: number }).n;
  assert.equal(sub.status, "canceled");
  assert.equal(invoices, invoicesBefore, "a cancelled renewal must not invoice");
});

// ── quota windows (periodKey / resetsAt midnight-UTC boundaries) ───────────

test("daily quota counts only the current UTC period and resets at midnight UTC", () => {
  const subject = `u:${900000 + process.pid}`;
  const feature = "chat" as const;

  // Spend the anon daily allowance (15/day): the 15th is allowed, the 16th is refused.
  let allowed = true;
  for (let i = 0; i < 15; i++) allowed = consumeQuota(subject, "anon", feature).allowed;
  assert.equal(allowed, true);
  const spent = consumeQuota(subject, "anon", feature);
  assert.equal(spent.allowed, false);

  // A full count for a previous period must not count against today.
  db().prepare("INSERT INTO ai_usage (subject, feature, period, n) VALUES (?, ?, '2020-01-01', 999)").run(subject, feature);
  const after = consumeQuota(subject, "anon", feature);
  assert.equal(after.allowed, false);
  assert.equal(after.used, 15, "old periods are ignored, not summed");

  // The usage row lives under today's UTC date, and the reset is exactly the next midnight UTC.
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(db().prepare("SELECT 1 FROM ai_usage WHERE subject = ? AND feature = 'chat' AND period = ?").get(subject, today), "consumption writes the current UTC-day period");
  assert.equal(Date.parse(spent.resetsAt) % 86_400_000, 0, "daily reset lands on midnight UTC");

  // Month period: 7-char "YYYY-MM" key, reset at the 1st 00:00 UTC.
  const month = consumeQuota(`m:${process.pid}`, "free", "plan");
  assert.ok(month.allowed);
  assert.equal((db().prepare("SELECT period FROM ai_usage WHERE subject = ?").get(`m:${process.pid}`) as { period: string }).period, today.slice(0, 7));
  assert.equal(Date.parse(month.resetsAt) % 86_400_000, 0, "monthly reset lands on midnight UTC");
});

// ── 24-hour cancellation rule across time zones ────────────────────────────

test("isCancellable reads the booking time in the venue's time zone, not UTC", () => {
  // Wall-clock strings spelled in Midway (UTC−11, no DST): localToUtcMs must see 25h/23h out,
  // while a naive UTC parse would see 14h/12h and wrongly refuse the 25h booking.
  const zone = "Pacific/Midway";
  const wall = (msAhead: number) => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const p = Object.fromEntries(fmt.formatToParts(new Date(Date.now() + msAhead)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  };
  const b = { status: "confirmed" as const, timezone: zone };
  assert.equal(isCancellable({ ...b, ...wall(25 * 3600_000) }), true, "25h out in the venue's zone is cancellable");
  assert.equal(isCancellable({ ...b, ...wall(23 * 3600_000) }), false, "23h out is inside the 24h cutoff");
  assert.equal(isCancellable({ ...b, ...wall(48 * 3600_000), status: "canceled" as const }), false, "only confirmed bookings cancel");

  // localToUtcMs converts a wall time in Kiritimati (UTC+14, no DST) exactly.
  assert.equal(localToUtcMs("2026-07-15", "12:00", "Pacific/Kiritimati"), Date.UTC(2026, 6, 15, 12, 0) - 14 * 3600_000);
});

// ── trust thresholds (score function and the hold-for-moderation rule) ─────

test("spam scores below the hold threshold, genuine reviews clear it", () => {
  assert.equal(TRUST_HOLD_THRESHOLD, 35, "moderators' documented rule");

  const spam = scoreReviewTrust({
    title: "Book now!!!",
    body: "Visit our hotel and use code SAVE20 at www.bestprice.com — best place ever! amazing! 10/10! highly recommend! call now! click here!",
    rating: 5,
    userReviewCount: 1,
    accountAgeDays: 2,
    aspectHits: 0,
  });
  assert.ok(spam.score < TRUST_HOLD_THRESHOLD, `spam must be held (got ${spam.score})`);
  assert.ok(spam.flags.length > 0);

  const genuine = scoreReviewTrust({
    title: "Quiet rooms facing the courtyard",
    body:
      "We stayed four nights in June. The courtyard rooms are genuinely quiet even on a busy weekend, the metro stop is a three-minute walk, " +
      "and breakfast starts at 6:30 with fresh fruit and eggs made to order. The lift is small, so pack light — but staff carried our cases without being asked.",
    rating: 4,
    userReviewCount: 12,
    accountAgeDays: 300,
    aspectHits: 5,
  });
  assert.ok(genuine.score >= TRUST_HOLD_THRESHOLD, `genuine review must not be held (got ${genuine.score})`);

  // The live createReview path holds reviews with the same constant.
  const place = db().prepare("SELECT id FROM places LIMIT 1").get() as { id: number };
  const held = createReview({
    placeId: place.id,
    userId: mkUser(),
    rating: 5,
    title: "BEST EVER!!!",
    body: "Amazing awesome perfect must visit! 10/10 highly recommend five stars unbelievable incredible experience! click www.deal.com use code X now!",
    tripType: "couples",
    visitDate: "2026-05-01",
    subRatings: {},
    photos: [],
  });
  assert.equal(held.status, "flagged");
  assert.equal(held.trust.score < TRUST_HOLD_THRESHOLD, true);
});
