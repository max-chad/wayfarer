import { db } from "../db";
import { PRODUCTS, type RevenueStream } from "../plans";

/** Daily revenue by stream for the last `days` days (cents). */
export function revenueByDay(days = 90) {
  const conn = db();
  const since = `-${days} days`;
  const rows = [
    ...(conn
      .prepare("SELECT day, 'affiliate' stream, SUM(clickout_cents) cents FROM place_daily WHERE day > date('now', ?) GROUP BY day")
      .all(since) as { day: string; stream: RevenueStream; cents: number }[]),
    ...(conn
      .prepare("SELECT day, 'commission' stream, SUM(commission_cents) cents FROM place_daily WHERE day > date('now', ?) GROUP BY day")
      .all(since) as { day: string; stream: RevenueStream; cents: number }[]),
    ...(conn
      .prepare("SELECT day, 'ads' stream, SUM(spend_cents) cents FROM campaign_daily WHERE day > date('now', ?) GROUP BY day")
      .all(since) as { day: string; stream: RevenueStream; cents: number }[]),
    ...(conn
      .prepare("SELECT substr(created_at, 1, 10) day, stream, SUM(amount_cents) cents FROM invoices WHERE created_at > date('now', ?) GROUP BY day, stream")
      .all(since) as { day: string; stream: RevenueStream; cents: number }[]),
  ];
  const out: { day: string; streams: Partial<Record<RevenueStream, number>>; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day, streams: {}, total: 0 });
  }
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) {
    const i = idx.get(r.day);
    if (i == null || !r.cents) continue;
    out[i].streams[r.stream] = (out[i].streams[r.stream] || 0) + r.cents;
    out[i].total += r.cents;
  }
  return out;
}

/** Monthly recurring revenue from active subscriptions, by product. */
export function mrr() {
  const rows = db()
    .prepare("SELECT product, interval, COUNT(*) n, SUM(price_cents) cents FROM subscriptions WHERE status = 'active' GROUP BY product, interval")
    .all() as { product: keyof typeof PRODUCTS; interval: "month" | "year"; n: number; cents: number }[];
  const byProduct = new Map<string, { product: string; name: string; subscribers: number; mrrCents: number }>();
  for (const r of rows) {
    const cur = byProduct.get(r.product) || { product: r.product, name: PRODUCTS[r.product]?.name ?? r.product, subscribers: 0, mrrCents: 0 };
    cur.subscribers += r.n;
    cur.mrrCents += r.interval === "year" ? Math.round(r.cents / 12) : r.cents;
    byProduct.set(r.product, cur);
  }
  const list = [...byProduct.values()].sort((a, b) => b.mrrCents - a.mrrCents);
  return { list, totalCents: list.reduce((s, x) => s + x.mrrCents, 0) };
}

export function subscriptionMovement(days = 30) {
  return db()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM subscriptions WHERE product = 'plus' AND started_at > datetime('now', @since)) newPlus,
        (SELECT COUNT(*) FROM subscriptions WHERE product = 'plus' AND canceled_at > datetime('now', @since)) churnedPlus,
        (SELECT COUNT(*) FROM subscriptions WHERE product = 'plus' AND status = 'active') activePlus,
        (SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL OR is_demo = 1) accounts`
    )
    .get({ since: `-${days} days` }) as { newPlus: number; churnedPlus: number; activePlus: number; accounts: number };
}

/** Traffic → click-out → booking funnel for the last 30 days. */
export function funnel(days = 30) {
  const r = db()
    .prepare(
      `SELECT SUM(views) views, SUM(saves) saves, SUM(clickouts) clickouts, SUM(bookings) bookings,
        SUM(CASE WHEN p.type = 'hotel' THEN views END) hotelViews
       FROM place_daily pd JOIN places p ON p.id = pd.place_id WHERE day > date('now', ?)`
    )
    .get(`-${days} days`) as { views: number; saves: number; clickouts: number; bookings: number; hotelViews: number };
  return r;
}

export function topEarners(days = 30, limit = 8) {
  return db()
    .prepare(
      `SELECT p.id, p.slug, p.name, p.type, d.name AS destination, SUM(pd.clickout_cents + pd.commission_cents) cents, SUM(pd.clickouts) clickouts, SUM(pd.bookings) bookings
       FROM place_daily pd JOIN places p ON p.id = pd.place_id JOIN destinations d ON d.id = p.destination_id
       WHERE pd.day > date('now', ?) GROUP BY p.id ORDER BY cents DESC LIMIT ?`
    )
    .all(`-${days} days`, limit) as { id: number; slug: string; name: string; type: string; destination: string; cents: number; clickouts: number; bookings: number }[];
}

export function partnerSplit(days = 30) {
  return db()
    .prepare("SELECT partner, COUNT(*) clicks, SUM(revenue_cents) cents FROM clickouts WHERE created_at > datetime('now', ?) GROUP BY partner ORDER BY cents DESC")
    .all(`-${days} days`) as { partner: string; clicks: number; cents: number }[];
}

export function recentBookings(limit = 8) {
  return db()
    .prepare(
      `SELECT b.ref, b.kind, b.date, b.party, b.total_cents totalCents, b.commission_cents commissionCents, b.status, b.created_at createdAt, p.name, p.slug
       FROM bookings b JOIN places p ON p.id = b.place_id ORDER BY b.created_at DESC LIMIT ?`
    )
    .all(limit) as { ref: string; kind: string; date: string; party: number; totalCents: number; commissionCents: number; status: string; createdAt: string; name: string; slug: string }[];
}

/**
 * Estimated model cost from logged token usage. Rates are configurable because they depend on the
 * model mix; defaults are Claude Opus 5.5 list prices ($4 / $20 per million tokens).
 */
export function aiCostEstimate(days = 30) {
  const inRate = Number(process.env.AI_COST_INPUT_PER_MTOK || 4);
  const outRate = Number(process.env.AI_COST_OUTPUT_PER_MTOK || 20);
  const r = db()
    .prepare(
      "SELECT COUNT(*) calls, SUM(provider = 'claude') claudeCalls, COALESCE(SUM(input_tokens),0) input, COALESCE(SUM(output_tokens),0) output FROM ai_events WHERE created_at > datetime('now', ?)"
    )
    .get(`-${days} days`) as { calls: number; claudeCalls: number; input: number; output: number };
  const cents = Math.round(((r.input / 1e6) * inRate + (r.output / 1e6) * outRate) * 100);
  return { ...r, cents, inRate, outRate };
}
