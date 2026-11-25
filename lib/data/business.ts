import crypto from "node:crypto";
import { db, json } from "../db";
import { tierRank, type BusinessTier } from "../plans";
import { todayIso } from "../pricing";
import { signToken, verifyToken } from "../sign";
import type { ImageRef, PlaceCardData, PlaceType } from "../types";
import { PLACE_SELECT, placeSelect, toCard, type PlaceRow } from "./mappers";
import { sweepSubscriptions } from "./billing";
import { billable } from "./commerce";
import { notify } from "./notifications";

export interface BusinessListing {
  id: number;
  placeId: number;
  userId: number;
  status: "pending" | "verified";
  tier: BusinessTier;
  contactName: string;
  contactRole: string;
  website: string | null;
  phone: string | null;
  bookingUrl: string | null;
  announcement: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

interface BusinessRow {
  id: number;
  place_id: number;
  user_id: number;
  status: "pending" | "verified";
  tier: BusinessTier;
  contact_name: string;
  contact_role: string;
  website: string | null;
  phone: string | null;
  booking_url: string | null;
  announcement: string | null;
  verify_code: string | null;
  verified_at: string | null;
  created_at: string;
}

const toBusiness = (r: BusinessRow): BusinessListing => ({
  id: r.id,
  placeId: r.place_id,
  userId: r.user_id,
  status: r.status,
  tier: r.tier,
  contactName: r.contact_name,
  contactRole: r.contact_role,
  website: r.website,
  phone: r.phone,
  bookingUrl: r.booking_url,
  announcement: r.announcement,
  verifiedAt: r.verified_at,
  createdAt: r.created_at,
});

export class BusinessError extends Error {
  constructor(
    message: string,
    readonly status = 422
  ) {
    super(message);
  }
}

export function getBusinessByPlace(placeId: number) {
  const r = db().prepare("SELECT * FROM businesses WHERE place_id = ?").get(placeId) as BusinessRow | undefined;
  return r ? toBusiness(r) : null;
}

export function getBusiness(id: number) {
  const r = db().prepare("SELECT * FROM businesses WHERE id = ?").get(id) as BusinessRow | undefined;
  return r ? toBusiness(r) : null;
}

/** The listing if this user owns it. Admins moderate content but don't act as other businesses. */
export function ownedBusiness(id: number, user: { id: number; role: string }) {
  sweepSubscriptions();
  const b = getBusiness(id);
  if (!b) return null;
  return b.userId === user.id ? b : null;
}

export function businessesForUser(userId: number) {
  const rows = db()
    .prepare(
      `${placeSelect("b.id AS business_id, b.status AS business_status, b.tier AS business_tier", "JOIN businesses b ON b.place_id = p.id")} WHERE b.user_id = ? ORDER BY b.created_at`
    )
    .all(userId) as (PlaceRow & { business_id: number; business_status: "pending" | "verified"; business_tier: BusinessTier })[];
  return rows.map((r) => ({ ...toCard(r), businessId: r.business_id, status: r.business_status, tier: r.business_tier }));
}

export function isBusinessOwner(userId: number) {
  return !!db().prepare("SELECT 1 FROM businesses WHERE user_id = ? LIMIT 1").get(userId);
}

/** Starts a claim. Verification normally happens by a code sent to the listed phone or email. */
export function claimListing(userId: number, input: { placeId: number; contactName: string; contactRole: string; website?: string; phone?: string }) {
  const conn = db();
  const place = conn.prepare("SELECT id, type, name FROM places WHERE id = ?").get(input.placeId) as { id: number; type: PlaceType; name: string } | undefined;
  if (!place) throw new BusinessError("Listing not found");
  if (place.type === "attraction") throw new BusinessError("Public landmarks can't be claimed. Hotels, restaurants and experience operators can.");
  const existing = getBusinessByPlace(place.id);
  if (existing && existing.userId !== userId) throw new BusinessError("This listing has already been claimed. If that's a mistake, contact business support.");
  const code = String(crypto.randomInt(100000, 999999));
  if (existing) {
    conn.prepare("UPDATE businesses SET verify_code = ?, contact_name = ?, contact_role = ? WHERE id = ?").run(code, input.contactName, input.contactRole, existing.id);
    return { businessId: existing.id, code, alreadyVerified: existing.status === "verified" };
  }
  const id = Number(
    conn
      .prepare("INSERT INTO businesses (place_id, user_id, contact_name, contact_role, website, phone, verify_code) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(place.id, userId, input.contactName.slice(0, 80), input.contactRole.slice(0, 60), input.website || null, input.phone || null, code).lastInsertRowid
  );
  return { businessId: id, code, alreadyVerified: false };
}

export function verifyListing(businessId: number, userId: number, code: string) {
  const conn = db();
  const r = conn.prepare("SELECT * FROM businesses WHERE id = ? AND user_id = ?").get(businessId, userId) as BusinessRow | undefined;
  if (!r) throw new BusinessError("Claim not found");
  if (r.status === "verified") return toBusiness(r);
  if (!r.verify_code || r.verify_code !== code.trim()) throw new BusinessError("That code doesn't match. Check the code and try again.");
  conn.prepare("UPDATE businesses SET status = 'verified', verified_at = datetime('now'), verify_code = NULL WHERE id = ?").run(businessId);
  const place = conn.prepare("SELECT name FROM places WHERE id = ?").get(r.place_id) as { name: string };
  notify(userId, { kind: "business", title: `You now manage ${place.name}`, body: "Reply to reviews, update your details and see how travelers find you.", url: `/business/${businessId}` });
  return getBusiness(businessId)!;
}

const registrable = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** A Book Direct link must point at the business's own website (or a subdomain of it). */
function bookingUrlAllowed(bookingUrl: string, website: string | null) {
  if (!website) return false;
  try {
    const site = registrable(new URL(website).hostname);
    const host = registrable(new URL(bookingUrl).hostname);
    return host === site || host.endsWith(`.${site}`);
  } catch {
    return false;
  }
}

export function updateListing(businessId: number, patch: Partial<{ website: string | null; phone: string | null; bookingUrl: string | null; announcement: string | null }>) {
  const b = getBusiness(businessId);
  if (!b) throw new BusinessError("Listing not found");
  if ((patch.bookingUrl || patch.announcement) && tierRank(b.tier) < 1) throw new BusinessError("Book Direct links and announcements are part of Business Insights", 402);
  const website = patch.website !== undefined ? patch.website : b.website;
  const bookingUrl = patch.bookingUrl !== undefined ? patch.bookingUrl : b.bookingUrl;
  if (bookingUrl && !bookingUrlAllowed(bookingUrl, website)) {
    throw new BusinessError("The Book Direct link must be on your own website's domain — add or fix your website first");
  }
  db()
    .prepare("UPDATE businesses SET website = ?, phone = ?, booking_url = ?, announcement = ? WHERE id = ?")
    .run(website, patch.phone !== undefined ? patch.phone : b.phone, bookingUrl, patch.announcement !== undefined ? patch.announcement : b.announcement, businessId);
  return getBusiness(businessId)!;
}

/** Public info shown on the place page for claimed listings. */
export function publicBusinessInfo(placeId: number) {
  sweepSubscriptions();
  const b = getBusinessByPlace(placeId);
  if (!b || b.status !== "verified") return null;
  return { verified: true, website: b.website, phone: b.phone, announcement: tierRank(b.tier) >= 1 ? b.announcement : null, tier: b.tier };
}

// ── Owner responses ─────────────────────────────────────────────────────────

export function respondToReview(businessId: number, reviewId: number, text: string) {
  const conn = db();
  const b = getBusiness(businessId);
  if (!b || b.status !== "verified") throw new BusinessError("Verify your listing to reply to reviews");
  const r = conn.prepare("SELECT id, user_id, place_id, title FROM reviews WHERE id = ?").get(reviewId) as { id: number; user_id: number; place_id: number; title: string } | undefined;
  if (!r || r.place_id !== b.placeId) throw new BusinessError("Review not found for this listing");
  const clean = text.trim().slice(0, 2000);
  conn.prepare("UPDATE reviews SET owner_response = ? WHERE id = ?").run(clean || null, reviewId);
  if (clean) {
    const p = conn.prepare("SELECT name, slug FROM places WHERE id = ?").get(b.placeId) as { name: string; slug: string };
    notify(r.user_id, { kind: "owner_response", title: `${p.name} replied to your review`, body: `“${r.title}”`, url: `/place/${p.slug}#reviews` });
  }
  return true;
}

export function reviewsForOwner(placeId: number, filter: "unanswered" | "all" | "negative" = "unanswered", limit = 30) {
  const where =
    filter === "unanswered" ? "AND r.owner_response IS NULL" : filter === "negative" ? "AND r.rating <= 3" : "";
  return db()
    .prepare(
      `SELECT r.id, r.rating, r.title, r.body, r.trip_type AS tripType, r.visit_date AS visitDate, r.owner_response AS ownerResponse,
        r.created_at AS createdAt, r.language, u.display_name AS author
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.place_id = ? AND r.status = 'published' ${where} ORDER BY r.created_at DESC LIMIT ?`
    )
    .all(placeId, limit) as { id: number; rating: number; title: string; body: string; tripType: string; visitDate: string; ownerResponse: string | null; createdAt: string; language: string; author: string }[];
}

export function responseStats(placeId: number) {
  return db()
    .prepare(
      `SELECT COUNT(*) total, SUM(owner_response IS NOT NULL) answered,
        SUM(owner_response IS NULL AND created_at >= datetime('now', '-90 days')) unansweredRecent
       FROM reviews WHERE place_id = ? AND status = 'published'`
    )
    .get(placeId) as { total: number; answered: number; unansweredRecent: number };
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface DailyPoint {
  day: string;
  views: number;
  saves: number;
  clickouts: number;
  bookings: number;
}

/** Daily series for the chart (`days` long) plus last-30-days totals compared with the 30 days before. */
export function placeAnalytics(placeId: number, days = 30) {
  const window = Math.max(days, 60);
  const rows = db()
    .prepare(`SELECT day, views, saves, clickouts, bookings FROM place_daily WHERE place_id = ? AND day > date('now', ?) ORDER BY day`)
    .all(placeId, `-${window} days`) as DailyPoint[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push(byDay.get(day) || { day, views: 0, saves: 0, clickouts: 0, bookings: 0 });
  }
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const floor = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const sum = (list: DailyPoint[], k: keyof Omit<DailyPoint, "day">) => list.reduce((s, r) => s + r[k], 0);
  const current = rows.filter((r) => r.day > cutoff);
  const previous = rows.filter((r) => r.day <= cutoff && r.day > floor);
  const totals = (["views", "saves", "clickouts", "bookings"] as const).map((k) => ({ key: k, value: sum(current, k), previous: sum(previous, k) }));
  return { series, totals };
}

/** Reviews per month and average rating over the last year. */
export function ratingTrend(placeId: number) {
  return db()
    .prepare(
      `SELECT substr(created_at, 1, 7) ym, COUNT(*) n, ROUND(AVG(rating), 2) avg FROM reviews
       WHERE place_id = ? AND status = 'published' AND created_at >= date('now', '-12 months') GROUP BY ym ORDER BY ym`
    )
    .all(placeId) as { ym: string; n: number; avg: number }[];
}

/** Aspect scores vs. the median of the top 10 comparable places in the same city. */
export function competitorBenchmark(placeId: number) {
  const conn = db();
  const me = conn.prepare("SELECT id, destination_id, type, rating, review_count, ranking, ranking_total, aspect_scores FROM places WHERE id = ?").get(placeId) as
    | { id: number; destination_id: number; type: PlaceType; rating: number; review_count: number; ranking: number; ranking_total: number; aspect_scores: string }
    | undefined;
  if (!me) return null;
  const peers = conn
    .prepare("SELECT id, name, slug, rating, review_count, ranking, aspect_scores FROM places WHERE destination_id = ? AND type = ? AND id != ? AND ranking > 0 ORDER BY ranking LIMIT 10")
    .all(me.destination_id, me.type, me.id) as { id: number; name: string; slug: string; rating: number; review_count: number; ranking: number; aspect_scores: string }[];
  const mine = json<Record<string, number>>(me.aspect_scores, {});
  const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const aspects = Object.keys(mine)
    .map((k) => {
      const peerVals = peers.map((p) => json<Record<string, number>>(p.aspect_scores, {})[k]).filter((v): v is number => typeof v === "number");
      if (peerVals.length < 3) return null; // too few comparable places to say anything honest
      const med = Math.round(median(peerVals) * 10) / 10;
      return { aspect: k, mine: mine[k], peers: med, delta: Math.round((mine[k] - med) * 10) / 10 };
    })
    .filter((a): a is { aspect: string; mine: number; peers: number; delta: number } => !!a);
  aspects.sort((a, b) => a.delta - b.delta);
  return {
    rating: me.rating,
    reviewCount: me.review_count,
    ranking: me.ranking,
    rankingTotal: me.ranking_total,
    peerMedianRating: Math.round(median(peers.map((p) => p.rating)) * 10) / 10,
    peerMedianReviews: Math.round(median(peers.map((p) => p.review_count))),
    peers: peers.slice(0, 5).map((p) => ({ name: p.name, slug: p.slug, rating: p.rating, reviewCount: p.review_count, ranking: p.ranking })),
    aspects,
  };
}

// ── Sponsored listings ──────────────────────────────────────────────────────

export interface Campaign {
  id: number;
  businessId: number;
  placeId: number;
  name: string;
  status: "active" | "paused" | "ended";
  dailyBudgetCents: number;
  cpcCents: number;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  todaySpendCents: number;
}

export function campaignsFor(businessId: number): Campaign[] {
  const rows = db()
    .prepare(
      `SELECT c.*, COALESCE(SUM(cd.impressions),0) impressions, COALESCE(SUM(cd.clicks),0) clicks, COALESCE(SUM(cd.spend_cents),0) spend,
        COALESCE(SUM(CASE WHEN cd.day = ? THEN cd.spend_cents END),0) today_spend
       FROM campaigns c LEFT JOIN campaign_daily cd ON cd.campaign_id = c.id WHERE c.business_id = ? GROUP BY c.id ORDER BY c.created_at DESC`
    )
    .all(todayIso(), businessId) as {
    id: number;
    business_id: number;
    place_id: number;
    name: string;
    status: Campaign["status"];
    daily_budget_cents: number;
    cpc_cents: number;
    starts_at: string;
    ends_at: string | null;
    created_at: string;
    impressions: number;
    clicks: number;
    spend: number;
    today_spend: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    placeId: r.place_id,
    name: r.name,
    status: r.status,
    dailyBudgetCents: r.daily_budget_cents,
    cpcCents: r.cpc_cents,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    impressions: r.impressions,
    clicks: r.clicks,
    spendCents: r.spend,
    todaySpendCents: r.today_spend,
  }));
}

export function campaignDaily(businessId: number, days = 30) {
  return db()
    .prepare(
      `SELECT cd.day, SUM(cd.impressions) impressions, SUM(cd.clicks) clicks, SUM(cd.spend_cents) spend FROM campaign_daily cd
       JOIN campaigns c ON c.id = cd.campaign_id WHERE c.business_id = ? AND cd.day > date('now', ?) GROUP BY cd.day ORDER BY cd.day`
    )
    .all(businessId, `-${days} days`) as { day: string; impressions: number; clicks: number; spend: number }[];
}

export const MIN_CPC_CENTS = 25;
export const MIN_DAILY_BUDGET_CENTS = 500;

export function createCampaign(businessId: number, input: { name: string; dailyBudgetCents: number; cpcCents: number; days?: number | null }) {
  const b = getBusiness(businessId);
  if (!b || b.status !== "verified") throw new BusinessError("Verify your listing before advertising");
  if (input.cpcCents < MIN_CPC_CENTS) throw new BusinessError(`Minimum bid is $${(MIN_CPC_CENTS / 100).toFixed(2)} per click`);
  if (input.dailyBudgetCents < MIN_DAILY_BUDGET_CENTS) throw new BusinessError(`Minimum daily budget is $${MIN_DAILY_BUDGET_CENTS / 100}`);
  const id = Number(
    db()
      .prepare(
        "INSERT INTO campaigns (business_id, place_id, name, daily_budget_cents, cpc_cents, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, date('now'), CASE WHEN ? IS NULL THEN NULL ELSE date('now', ?) END)"
      )
      .run(businessId, b.placeId, input.name.slice(0, 80) || "Sponsored listing", input.dailyBudgetCents, input.cpcCents, input.days ?? null, `+${input.days ?? 0} days`).lastInsertRowid
  );
  return campaignsFor(businessId).find((c) => c.id === id)!;
}

export function updateCampaign(businessId: number, campaignId: number, patch: Partial<{ status: "active" | "paused" | "ended"; dailyBudgetCents: number; cpcCents: number }>) {
  const conn = db();
  const c = conn.prepare("SELECT * FROM campaigns WHERE id = ? AND business_id = ?").get(campaignId, businessId) as
    | { status: string; daily_budget_cents: number; cpc_cents: number }
    | undefined;
  if (!c) throw new BusinessError("Campaign not found");
  if (c.status === "ended") throw new BusinessError("This campaign has ended");
  if (patch.cpcCents != null && patch.cpcCents < MIN_CPC_CENTS) throw new BusinessError("Bid is below the minimum");
  if (patch.dailyBudgetCents != null && patch.dailyBudgetCents < MIN_DAILY_BUDGET_CENTS) throw new BusinessError("Budget is below the minimum");
  conn
    .prepare("UPDATE campaigns SET status = ?, daily_budget_cents = ?, cpc_cents = ? WHERE id = ?")
    .run(patch.status ?? c.status, patch.dailyBudgetCents ?? c.daily_budget_cents, patch.cpcCents ?? c.cpc_cents, campaignId);
  return campaignsFor(businessId).find((x) => x.id === campaignId)!;
}

/**
 * Picks sponsored listings for a results page: eligible campaigns with budget left today, ranked
 * by bid × quality (rating), so poorly-rated places can't simply buy the top slot. Sponsored slots
 * are always labelled and never change the organic ranking.
 */
export function pickSponsored(opts: { destinationId: number; type?: PlaceType; excludePlaceIds?: number[]; limit?: number; minRating?: number }) {
  const conn = db();
  const today = todayIso();
  const rows = conn
    .prepare(
      `SELECT c.id AS campaign_id, c.cpc_cents, c.daily_budget_cents, COALESCE(cd.spend_cents, 0) today_spend, p.id AS place_id, p.rating
       FROM campaigns c JOIN places p ON p.id = c.place_id JOIN businesses b ON b.id = c.business_id AND b.status = 'verified'
       LEFT JOIN campaign_daily cd ON cd.campaign_id = c.id AND cd.day = @today
       WHERE c.status = 'active' AND c.starts_at <= @today AND (c.ends_at IS NULL OR c.ends_at >= @today)
         AND p.destination_id = @dest AND (@type IS NULL OR p.type = @type) AND p.rating >= @minRating
         AND COALESCE(cd.spend_cents, 0) + c.cpc_cents <= c.daily_budget_cents`
    )
    .all({ today, dest: opts.destinationId, type: opts.type ?? null, minRating: opts.minRating ?? 3.5 }) as {
    campaign_id: number;
    cpc_cents: number;
    daily_budget_cents: number;
    today_spend: number;
    place_id: number;
    rating: number;
  }[];
  const exclude = new Set(opts.excludePlaceIds || []);
  const ranked = rows
    .filter((r) => !exclude.has(r.place_id))
    .map((r) => ({ ...r, score: r.cpc_cents * Math.pow(r.rating / 5, 3) * (0.85 + Math.random() * 0.3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 1);
  if (!ranked.length) return [];
  const imp = conn.prepare(
    "INSERT INTO campaign_daily (campaign_id, day, impressions) VALUES (?, ?, 1) ON CONFLICT(campaign_id, day) DO UPDATE SET impressions = impressions + 1"
  );
  for (const r of ranked) imp.run(r.campaign_id, today);
  const cards = conn
    .prepare(`${PLACE_SELECT} WHERE p.id IN (${ranked.map(() => "?").join(",")})`)
    .all(...ranked.map((r) => r.place_id)) as PlaceRow[];
  return ranked
    .map((r) => {
      const row = cards.find((c) => c.id === r.place_id);
      // Each impression gets its own signed click token, so a click can only be billed for an ad that was shown.
      return row ? { campaignId: r.campaign_id, token: signToken({ c: r.campaign_id, i: Math.random().toString(36).slice(2, 10) }, 6 * 3600), place: toCard(row) as PlaceCardData } : null;
    })
    .filter((x): x is { campaignId: number; token: string; place: PlaceCardData } => !!x);
}

/**
 * Charges a sponsored click at the bid price, capped by what is left of today's budget. Only clicks
 * that carry a valid impression token for an active, in-date campaign are billable, and repeat
 * clicks from the same visitor within 30 minutes are free.
 */
export function chargeSponsoredClick(token: string, visitor: string) {
  const payload = verifyToken<{ c: number; i: string }>(token);
  if (!payload) return null;
  const conn = db();
  const today = todayIso();
  const c = conn
    .prepare("SELECT c.id, c.cpc_cents, c.daily_budget_cents, c.status, c.starts_at, c.ends_at, p.slug FROM campaigns c JOIN places p ON p.id = c.place_id WHERE c.id = ?")
    .get(payload.c) as { id: number; cpc_cents: number; daily_budget_cents: number; status: string; starts_at: string; ends_at: string | null; slug: string } | undefined;
  if (!c) return null;
  const live = c.status === "active" && c.starts_at <= today && (!c.ends_at || c.ends_at >= today);
  if (live && billable(`${visitor}:${c.id}`)) {
    const spent = (conn.prepare("SELECT COALESCE(spend_cents,0) s FROM campaign_daily WHERE campaign_id = ? AND day = ?").get(c.id, today) as { s: number } | undefined)?.s ?? 0;
    const charge = Math.max(0, Math.min(c.cpc_cents, c.daily_budget_cents - spent));
    conn
      .prepare(
        "INSERT INTO campaign_daily (campaign_id, day, clicks, spend_cents) VALUES (?, ?, 1, ?) ON CONFLICT(campaign_id, day) DO UPDATE SET clicks = clicks + 1, spend_cents = spend_cents + excluded.spend_cents"
      )
      .run(c.id, today, charge);
  }
  return { slug: c.slug };
}

// ── Admin directory ─────────────────────────────────────────────────────────

export function businessDirectoryStats() {
  return db()
    .prepare(
      `SELECT COUNT(*) claimed, SUM(status = 'verified') verified, SUM(tier = 'insights') insights, SUM(tier = 'pro') pro,
        (SELECT COUNT(*) FROM campaigns WHERE status = 'active') activeCampaigns FROM businesses`
    )
    .get() as { claimed: number; verified: number; insights: number; pro: number; activeCampaigns: number };
}

export function placeSummary(placeId: number) {
  const r = db().prepare(`${PLACE_SELECT} WHERE p.id = ?`).get(placeId) as PlaceRow | undefined;
  return r ? (toCard(r) as PlaceCardData & { image: ImageRef | null }) : null;
}
