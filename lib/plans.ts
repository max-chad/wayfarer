/**
 * Wayfarer's commercial model in one place: consumer plans, AI quotas, business tiers,
 * API plans, booking partners and commission rates. Safe to import from client components.
 */

export type ConsumerPlan = "anon" | "free" | "plus";
export type MeteredFeature = "plan" | "chat" | "insights";
export type BillingInterval = "month" | "year";

export interface Quota {
  limit: number;
  per: "day" | "month";
}

/** AI quotas. plan/chat are the big model calls; insights covers summaries, compare, Q&A, translate and review drafting. */
export const AI_QUOTAS: Record<ConsumerPlan, Record<MeteredFeature, Quota>> = {
  anon: { plan: { limit: 2, per: "day" }, chat: { limit: 15, per: "day" }, insights: { limit: 30, per: "day" } },
  free: { plan: { limit: 5, per: "month" }, chat: { limit: 40, per: "day" }, insights: { limit: 100, per: "day" } },
  // "Unlimited" with a fair-use ceiling that protects unit economics against scripted abuse.
  plus: { plan: { limit: 60, per: "day" }, chat: { limit: 400, per: "day" }, insights: { limit: 400, per: "day" } },
};

export const FEATURE_LABELS: Record<MeteredFeature, { one: string; many: string }> = {
  plan: { one: "AI trip plan", many: "AI trip plans" },
  chat: { one: "concierge message", many: "concierge messages" },
  insights: { one: "AI insight", many: "AI insights" },
};

// ── Products sold through checkout ──────────────────────────────────────────

export type ProductId = "plus" | "business_insights" | "business_pro" | "api_growth";
export type RevenueStream = "subscriptions" | "business" | "api" | "ads" | "affiliate" | "commission";

export interface Product {
  id: ProductId;
  name: string;
  tagline: string;
  stream: RevenueStream;
  monthlyCents: number;
  yearlyCents?: number;
  audience: "traveler" | "business" | "developer";
}

export const PRODUCTS: Record<ProductId, Product> = {
  plus: {
    id: "plus",
    name: "Wayfarer Plus",
    tagline: "Unlimited AI planning, price alerts and an ad-free Wayfarer",
    stream: "subscriptions",
    monthlyCents: 599,
    yearlyCents: 4799,
    audience: "traveler",
  },
  business_insights: {
    id: "business_insights",
    name: "Business Insights",
    tagline: "Analytics, AI review insights, AI replies and a Book Direct link",
    stream: "business",
    monthlyCents: 7900,
    yearlyCents: 79000,
    audience: "business",
  },
  business_pro: {
    id: "business_pro",
    name: "Business Pro",
    tagline: "Everything in Insights plus a competitor benchmark and an AI action plan",
    stream: "business",
    monthlyCents: 19900,
    yearlyCents: 199000,
    audience: "business",
  },
  api_growth: {
    id: "api_growth",
    name: "API Growth",
    tagline: "100,000 API calls a month, review insights and commercial use",
    stream: "api",
    monthlyCents: 29900,
    audience: "developer",
  },
};

export function priceFor(product: ProductId, interval: BillingInterval) {
  const p = PRODUCTS[product];
  return interval === "year" && p.yearlyCents ? p.yearlyCents : p.monthlyCents;
}

export function formatCents(cents: number, opts: { decimals?: boolean } = {}) {
  const decimals = opts.decimals ?? cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(cents / 100);
}

// ── Consumer plan features (pricing page + upsell dialog) ───────────────────

export const PLUS_FEATURES: { label: string; free: string | boolean; plus: string | boolean }[] = [
  { label: "AI review summaries, smart search & Q&A", free: true, plus: true },
  { label: "AI trip plans", free: "5 / month", plus: "Unlimited" },
  { label: "Concierge messages", free: "40 / day", plus: "Unlimited" },
  { label: "Trip editor, sharing & calendar export", free: true, plus: true },
  { label: "Hotel price-drop alerts", free: false, plus: true },
  { label: "GPX export for offline maps", free: false, plus: true },
  { label: "No sponsored listings", free: false, plus: true },
  { label: "Plus badge on your profile", free: false, plus: true },
];

// ── Business tiers ──────────────────────────────────────────────────────────

export type BusinessTier = "free" | "insights" | "pro";

export const BUSINESS_TIERS: { id: BusinessTier; product?: ProductId; name: string; monthlyCents: number; blurb: string; features: string[] }[] = [
  {
    id: "free",
    name: "Free listing",
    monthlyCents: 0,
    blurb: "Claim your page and join the conversation.",
    features: ["Verified owner badge", "Respond to reviews", "Update phone & website", "30-day page views"],
  },
  {
    id: "insights",
    product: "business_insights",
    name: "Business Insights",
    monthlyCents: PRODUCTS.business_insights.monthlyCents,
    blurb: "Turn reviews into decisions and lookers into bookers.",
    features: [
      "Everything in Free",
      "90-day analytics: views, saves, partner click-outs, bookings",
      "AI review insights: what guests love and what to fix",
      "AI-drafted owner replies",
      "Book Direct link next to partner prices (commission-free)",
      "Pinned announcement on your page",
    ],
  },
  {
    id: "pro",
    product: "business_pro",
    name: "Business Pro",
    monthlyCents: PRODUCTS.business_pro.monthlyCents,
    blurb: "For operators who compete on experience.",
    features: ["Everything in Insights", "Benchmark against your city's top 10, aspect by aspect", "AI action plan: what to fix first", "Priority support"],
  },
];

export function tierRank(t: BusinessTier) {
  return t === "pro" ? 2 : t === "insights" ? 1 : 0;
}

// ── Developer API ───────────────────────────────────────────────────────────

export const API_PLANS = [
  { id: "developer", name: "Developer", monthlyCents: 0, quota: 1000, blurb: "Prototype and personal projects", features: ["1,000 calls / month", "Destinations & places", "Non-commercial use"] },
  {
    id: "growth",
    name: "Growth",
    monthlyCents: PRODUCTS.api_growth.monthlyCents,
    quota: 100_000,
    blurb: "Production apps, DMOs and travel brands",
    features: ["100,000 calls / month", "AI review insights endpoint", "Commercial use & attribution-light"],
  },
  { id: "enterprise", name: "Enterprise", monthlyCents: -1, quota: 5_000_000, blurb: "Embedded concierge, bulk data, SLAs", features: ["Custom volume", "White-label AI concierge widget", "99.9% SLA & DPA"] },
] as const;

export type ApiPlanId = (typeof API_PLANS)[number]["id"];

// ── Booking partners & commissions ──────────────────────────────────────────

/**
 * Hotel booking partners. Fictional demo brands: in production these are affiliate/meta-search
 * integrations (CPC or CPA) with real OTAs and hotel chains.
 */
export const HOTEL_PARTNERS = [
  { key: "lodgely", name: "Lodgely", color: "#2563eb", cpcBias: 1.15, priceBias: 1.0, perks: ["Free cancellation"] },
  { key: "roomzoo", name: "Roomzoo", color: "#db2777", cpcBias: 0.9, priceBias: 0.985, perks: ["Pay at property"] },
  { key: "staysmith", name: "Staysmith", color: "#7c3aed", cpcBias: 1.0, priceBias: 1.03, perks: ["Breakfast included", "Free cancellation"] },
  { key: "bunkwise", name: "Bunkwise", color: "#ea580c", cpcBias: 0.8, priceBias: 0.97, perks: ["Non-refundable"] },
] as const;

export type PartnerKey = (typeof HOTEL_PARTNERS)[number]["key"] | "direct";

export const COMMISSION = {
  /** Share of an experience/ticket booking value paid by the activity marketplace. */
  experienceRate: 0.08,
  /** Per seated diner, paid by the restaurant for online reservations. */
  restaurantPerCoverCents: 150,
  /** Hotel meta-search: base CPC in cents, scaled by price level and partner. */
  hotelBaseCpcCents: 32,
  hotelCpcPerPriceLevel: 18,
};

export function hotelCpcCents(priceLevel: number, partnerKey: string) {
  const partner = HOTEL_PARTNERS.find((p) => p.key === partnerKey);
  if (!partner) return 0; // direct bookings pay no commission — the hotel pays a subscription instead
  return Math.round((COMMISSION.hotelBaseCpcCents + COMMISSION.hotelCpcPerPriceLevel * priceLevel) * partner.cpcBias);
}

/** Lowest and highest per-click fee across price levels 1–4 and all partners. */
export function hotelCpcRangeCents() {
  const all = HOTEL_PARTNERS.flatMap((p) => [1, 2, 3, 4].map((level) => hotelCpcCents(level, p.key)));
  return { min: Math.min(...all), max: Math.max(...all) };
}

export const STREAM_LABELS: Record<RevenueStream, { label: string; color: string }> = {
  affiliate: { label: "Hotel partner clicks (CPC)", color: "#2563eb" },
  commission: { label: "Booking commissions", color: "#13866a" },
  ads: { label: "Sponsored listings", color: "#fe5011" },
  subscriptions: { label: "Wayfarer Plus", color: "#7c3aed" },
  business: { label: "Business subscriptions", color: "#f59e0b" },
  api: { label: "API & data", color: "#0ea5e9" },
};
