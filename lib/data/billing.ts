import crypto from "node:crypto";
import { db } from "../db";
import {
  AI_QUOTAS,
  FEATURE_LABELS,
  PRODUCTS,
  formatCents,
  priceFor,
  type BillingInterval,
  type BusinessTier,
  type ConsumerPlan,
  type MeteredFeature,
  type ProductId,
} from "../plans";
import type { SessionUser } from "../types";
import { notify } from "./notifications";

const isProd = process.env.NODE_ENV === "production";

/**
 * Billing runs in demo mode: checkout creates a subscription and an invoice without charging a
 * card. In production the same functions are driven by payment-provider webhooks.
 * Production defaults to live unless PAYMENTS_MODE explicitly says otherwise.
 */
export const PAYMENTS_MODE = process.env.PAYMENTS_MODE ? (process.env.PAYMENTS_MODE === "live" ? "live" : "demo") : isProd ? "live" : "demo";

/** Demo conveniences (e.g. showing listing verification codes on screen). Production implies off unless DEMO_MODE=true. */
export const DEMO_MODE = process.env.DEMO_MODE ? process.env.DEMO_MODE !== "false" : !isProd;

export interface Subscription {
  id: number;
  product: ProductId;
  productName: string;
  placeId: number | null;
  placeName: string | null;
  placeSlug: string | null;
  interval: BillingInterval;
  priceCents: number;
  status: "active" | "canceled";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  startedAt: string;
  canceledAt: string | null;
}

interface SubRow {
  id: number;
  user_id: number;
  product: ProductId;
  place_id: number | null;
  interval: BillingInterval;
  price_cents: number;
  status: "active" | "canceled";
  cancel_at_period_end: number;
  current_period_end: string;
  started_at: string;
  canceled_at: string | null;
  place_name?: string | null;
  place_slug?: string | null;
}

const toSub = (r: SubRow): Subscription => ({
  id: r.id,
  product: r.product,
  productName: PRODUCTS[r.product]?.name ?? r.product,
  placeId: r.place_id,
  placeName: r.place_name ?? null,
  placeSlug: r.place_slug ?? null,
  interval: r.interval,
  priceCents: r.price_cents,
  status: r.status,
  cancelAtPeriodEnd: !!r.cancel_at_period_end,
  currentPeriodEnd: r.current_period_end,
  startedAt: r.started_at,
  canceledAt: r.canceled_at,
});

const tierForProduct = (p: ProductId): BusinessTier | null => (p === "business_insights" ? "insights" : p === "business_pro" ? "pro" : null);

// ── Billing clock ───────────────────────────────────────────────────────────

let lastSweep = 0;

/** Renews subscriptions that reached their period end (issuing invoices) and expires cancelled ones. */
export function sweepSubscriptions(force = false) {
  if (!force && Date.now() - lastSweep < 5 * 60_000) return;
  lastSweep = Date.now();
  const conn = db();
  // Retention (privacy policy): usage counters 60 days, read notifications 180 days.
  conn
    .prepare(
      "DELETE FROM ai_usage WHERE (length(period) = 10 AND period < date('now', '-60 days')) OR (length(period) = 7 AND period < strftime('%Y-%m', 'now', '-2 months'))"
    )
    .run();
  conn.prepare("DELETE FROM notifications WHERE read = 1 AND created_at < datetime('now', '-180 days')").run();
  // Retention: review photos not referenced by any review, AI telemetry and AI cache.
  conn
    .prepare(
      `DELETE FROM uploads
       WHERE created_at < datetime('now', '-90 days')
         AND ('/api/uploads/' || id) NOT IN (SELECT value FROM reviews, json_each(reviews.photos))`
    )
    .run();
  conn.prepare("DELETE FROM ai_events WHERE created_at < datetime('now', '-90 days')").run();
  conn.prepare("DELETE FROM ai_cache WHERE created_at < datetime('now', '-60 days')").run();
  const due = conn.prepare("SELECT * FROM subscriptions WHERE status = 'active' AND current_period_end <= datetime('now')").all() as SubRow[];
  if (!due.length) return;
  const step = conn.prepare("SELECT datetime(?, ?) v");
  const tx = conn.transaction(() => {
    for (const s of due) {
      if (s.cancel_at_period_end) {
        conn.prepare("UPDATE subscriptions SET status = 'canceled' WHERE id = ?").run(s.id);
        if (tierForProduct(s.product) && s.place_id) conn.prepare("UPDATE businesses SET tier = 'free' WHERE place_id = ? AND user_id = ?").run(s.place_id, s.user_id);
        continue;
      }
      let end = s.current_period_end;
      for (let guard = 0; guard < 48; guard++) {
        const cur = (conn.prepare("SELECT datetime('now') v").get() as { v: string }).v;
        if (end > cur) break;
        conn
          .prepare("INSERT INTO invoices (user_id, subscription_id, stream, description, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(s.user_id, s.id, PRODUCTS[s.product].stream, `${PRODUCTS[s.product].name} — renewal`, s.price_cents, end);
        end = (step.get(end, s.interval === "year" ? "+1 year" : "+1 month") as { v: string }).v;
      }
      conn.prepare("UPDATE subscriptions SET current_period_end = ? WHERE id = ?").run(end, s.id);
    }
  });
  tx();
}

// ── Plans & subscriptions ───────────────────────────────────────────────────

export function getPlan(userId: number): "free" | "plus" {
  sweepSubscriptions();
  const row = db().prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND product = 'plus' AND status = 'active' LIMIT 1").get(userId);
  return row ? "plus" : "free";
}

export function consumerPlan(user: SessionUser | null): ConsumerPlan {
  return user ? getPlan(user.id) : "anon";
}

export function listSubscriptions(userId: number): Subscription[] {
  sweepSubscriptions();
  const rows = db()
    .prepare(
      `SELECT s.*, p.name AS place_name, p.slug AS place_slug FROM subscriptions s LEFT JOIN places p ON p.id = s.place_id
       WHERE s.user_id = ? ORDER BY s.status = 'active' DESC, s.started_at DESC`
    )
    .all(userId) as SubRow[];
  return rows.map(toSub);
}

export function activeSubscription(userId: number, product: ProductId, placeId?: number | null) {
  const row = db()
    .prepare(`SELECT * FROM subscriptions WHERE user_id = ? AND product = ? AND status = 'active' AND (? IS NULL OR place_id = ?) ORDER BY id DESC LIMIT 1`)
    .get(userId, product, placeId ?? null, placeId ?? null) as SubRow | undefined;
  return row ? toSub(row) : null;
}

export class BillingError extends Error {}

export function subscribe(userId: number, productId: ProductId, interval: BillingInterval, placeId?: number | null) {
  const product = PRODUCTS[productId];
  if (!product) throw new BillingError("Unknown product");
  if (interval === "year" && !product.yearlyCents) interval = "month";
  const tier = tierForProduct(productId);
  const conn = db();
  if (tier) {
    if (!placeId) throw new BillingError("Choose which listing to upgrade");
    const biz = conn.prepare("SELECT id, status FROM businesses WHERE place_id = ? AND user_id = ?").get(placeId, userId) as { id: number; status: string } | undefined;
    if (!biz) throw new BillingError("Claim this listing before upgrading it");
    if (biz.status !== "verified") throw new BillingError("Verify your listing before upgrading it");
  }
  const price = priceFor(productId, interval);

  return conn.transaction(() => {
    const existing = conn
      .prepare("SELECT * FROM subscriptions WHERE user_id = ? AND product = ? AND status = 'active' AND (? IS NULL OR place_id = ?)")
      .get(userId, productId, placeId ?? null, placeId ?? null) as SubRow | undefined;
    if (existing) {
      if (existing.cancel_at_period_end) {
        conn.prepare("UPDATE subscriptions SET cancel_at_period_end = 0, canceled_at = NULL WHERE id = ?").run(existing.id);
        return { id: existing.id, resumed: true };
      }
      throw new BillingError(`You already have ${product.name}`);
    }
    if (tier) {
      // switching business tier: end the other tier's subscription for this listing now
      conn
        .prepare("UPDATE subscriptions SET status = 'canceled', canceled_at = datetime('now') WHERE user_id = ? AND place_id = ? AND product LIKE 'business_%' AND status = 'active'")
        .run(userId, placeId);
      conn.prepare("UPDATE businesses SET tier = ? WHERE place_id = ? AND user_id = ?").run(tier, placeId, userId);
    }
    const id = Number(
      conn
        .prepare(
          "INSERT INTO subscriptions (user_id, product, place_id, interval, price_cents, current_period_end) VALUES (?, ?, ?, ?, ?, datetime('now', ?))"
        )
        .run(userId, productId, placeId ?? null, interval, price, interval === "year" ? "+1 year" : "+1 month").lastInsertRowid
    );
    conn
      .prepare("INSERT INTO invoices (user_id, subscription_id, stream, description, amount_cents) VALUES (?, ?, ?, ?, ?)")
      .run(userId, id, product.stream, `${product.name} — ${interval === "year" ? "annual" : "monthly"} plan`, price);
    notify(userId, {
      kind: "billing",
      title: `Welcome to ${product.name}`,
      body: `${formatCents(price)} / ${interval}. ${PAYMENTS_MODE === "demo" ? "Demo mode: no card was charged." : ""}`.trim(),
      url: "/account/billing",
    });
    return { id, resumed: false };
  })();
}

export function setCancelAtPeriodEnd(userId: number, subId: number, cancel: boolean) {
  const res = db()
    .prepare(
      `UPDATE subscriptions SET cancel_at_period_end = ?, canceled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
       WHERE id = ? AND user_id = ? AND status = 'active'`
    )
    .run(cancel ? 1 : 0, cancel ? 1 : 0, subId, userId);
  return res.changes > 0;
}

export function invoicesFor(userId: number, limit = 24) {
  return db()
    .prepare("SELECT id, description, amount_cents AS amountCents, stream, created_at AS createdAt FROM invoices WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(userId, limit) as { id: number; description: string; amountCents: number; stream: string; createdAt: string }[];
}

// ── AI quotas ───────────────────────────────────────────────────────────────

/** Rate-limit subject. IPs are hashed so raw addresses never land in the database. */
export function quotaSubject(req: Request, user: SessionUser | null) {
  if (user) return `u:${user.id}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return `ip:${crypto.createHash("sha256").update(`wayfarer:${ip}`).digest("hex").slice(0, 20)}`;
}

function periodKey(per: "day" | "month") {
  const now = new Date().toISOString();
  return per === "day" ? now.slice(0, 10) : now.slice(0, 7);
}

function resetsAt(per: "day" | "month") {
  const d = new Date();
  const next = per === "day" ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toISOString();
}

export interface QuotaStatus {
  feature: MeteredFeature;
  plan: ConsumerPlan;
  limit: number;
  per: "day" | "month";
  used: number;
  remaining: number;
  resetsAt: string;
}

export function quotaStatus(subject: string, plan: ConsumerPlan, feature: MeteredFeature): QuotaStatus {
  const q = AI_QUOTAS[plan][feature];
  const row = db().prepare("SELECT n FROM ai_usage WHERE subject = ? AND feature = ? AND period = ?").get(subject, feature, periodKey(q.per)) as { n: number } | undefined;
  const used = row?.n ?? 0;
  return { feature, plan, limit: q.limit, per: q.per, used, remaining: Math.max(0, q.limit - used), resetsAt: resetsAt(q.per) };
}

/** Counts one use of a metered AI feature; returns allowed=false once the plan's quota is spent. */
export function consumeQuota(subject: string, plan: ConsumerPlan, feature: MeteredFeature): QuotaStatus & { allowed: boolean } {
  const status = quotaStatus(subject, plan, feature);
  if (status.remaining <= 0) return { ...status, allowed: false };
  db()
    .prepare("INSERT INTO ai_usage (subject, feature, period, n) VALUES (?, ?, ?, 1) ON CONFLICT(subject, feature, period) DO UPDATE SET n = n + 1")
    .run(subject, feature, periodKey(status.per));
  return { ...status, used: status.used + 1, remaining: status.remaining - 1, allowed: true };
}

export function quotaMessage(s: QuotaStatus) {
  const label = FEATURE_LABELS[s.feature];
  const period = s.per === "day" ? "today" : "this month";
  if (s.plan === "anon") return `You've used the ${s.limit} free ${label.many} available without an account ${period}. Create a free account for more, or go Plus for unlimited.`;
  if (s.plan === "free") return `You've used all ${s.limit} free ${label.many} ${period}. Upgrade to Wayfarer Plus for unlimited ${label.many}.`;
  return `You've reached the fair-use limit of ${s.limit} ${label.many} ${period}. It resets soon.`;
}

/** Quota check for API routes: returns a ready 402 payload when the quota is spent. */
export function meter(req: Request, user: SessionUser | null, feature: MeteredFeature) {
  const plan = consumerPlan(user);
  const status = consumeQuota(quotaSubject(req, user), plan, feature);
  return status.allowed ? { ok: true as const, status } : { ok: false as const, status, message: quotaMessage(status) };
}
