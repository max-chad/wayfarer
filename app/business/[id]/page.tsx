import { BadgeCheck, BarChart3, Clock, Crown, ExternalLink, Lock, Megaphone, MessageCircleReply, PartyPopper, Settings2, Sparkles, Target, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubscriptionActions } from "@/components/billing/SubscriptionActions";
import { CampaignManager } from "@/components/business/CampaignManager";
import { DayAxis, Delta, MiniBars } from "@/components/business/Charts";
import { ListingEditor, VerifyForm } from "@/components/business/ListingEditor";
import { ReviewResponder } from "@/components/business/ReviewResponder";
import { SmartImage } from "@/components/ui/SmartImage";
import { getReviewSummary } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { activeSubscription } from "@/lib/data/billing";
import {
  campaignDaily,
  campaignsFor,
  competitorBenchmark,
  MIN_CPC_CENTS,
  MIN_DAILY_BUDGET_CENTS,
  ownedBusiness,
  placeAnalytics,
  ratingTrend,
  responseStats,
  reviewsForOwner,
} from "@/lib/data/business";
import { getPlaceById } from "@/lib/data/places";
import { BUSINESS_TIERS, formatCents, tierRank, type BusinessTier } from "@/lib/plans";
import { cn, formatMonthYear } from "@/lib/utils";

export const metadata: Metadata = { title: "Business console", robots: { index: false } };

const TABS = [
  ["overview", "Overview", BarChart3],
  ["reviews", "Reviews", MessageCircleReply],
  ["insights", "AI insights", Sparkles],
  ["ads", "Sponsored", Megaphone],
  ["profile", "Profile", Settings2],
  ["plan", "Plan", Crown],
] as const;

type Tab = (typeof TABS)[number][0];

function Locked({ need, placeId, children }: { need: BusinessTier; placeId: number; children: React.ReactNode }) {
  const tier = BUSINESS_TIERS.find((t) => t.id === need)!;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-bg/40 p-4">
        <div className="card max-w-sm p-5 text-center">
          <Lock className="mx-auto size-6 text-brand-600" />
          <div className="mt-2 font-semibold">Part of {tier.name}</div>
          <p className="mt-1 text-sm text-muted">{tier.blurb}</p>
          <Link href={`/checkout?product=${tier.product}&place=${placeId}`} className="btn btn-primary btn-sm mt-3">
            Upgrade for {formatCents(tier.monthlyCents)}/mo
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function BusinessConsole({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; filter?: string; upgraded?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/business/${id}`);
  const biz = ownedBusiness(Number(id), user);
  if (!biz) notFound();
  const place = getPlaceById(biz.placeId);
  if (!place) notFound();
  const tab: Tab = (TABS.find((t) => t[0] === sp.tab)?.[0] as Tab) || "overview";
  const rank = tierRank(biz.tier);
  const tier = BUSINESS_TIERS.find((t) => t.id === biz.tier)!;
  const rs = responseStats(place.id);

  const header = (
    <div className="flex flex-wrap items-center gap-4">
      <SmartImage image={place.image} alt={place.name} width={330} className="size-16 shrink-0 rounded-2xl sm:size-20" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("badge", biz.status === "verified" ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-sun-300/30 text-ink")}>
            {biz.status === "verified" ? <BadgeCheck className="size-3" /> : <Clock className="size-3" />}
            {biz.status === "verified" ? "Verified owner" : "Pending verification"}
          </span>
          <span className="badge bg-surface-3 text-ink-2">{tier.name}</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">{place.name}</h1>
        <div className="text-sm text-muted">
          {place.category} · {place.destinationName} · ★ {place.rating.toFixed(1)} ({place.reviewCount}){place.ranking ? ` · #${place.ranking} of ${place.rankingTotal}` : ""}
        </div>
      </div>
      <Link href={`/place/${place.slug}`} className="btn btn-outline btn-sm">
        Public page <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );

  if (biz.status !== "verified") {
    return (
      <div className="container-page max-w-5xl pt-10">
        <Link href="/business/dashboard" className="text-sm text-muted hover:underline">
          ← Your listings
        </Link>
        <div className="mt-4">{header}</div>
        <div className="card mt-8 max-w-xl p-6">
          <div className="font-semibold">Verify that you manage {place.name}</div>
          <p className="mt-1 text-sm text-muted">Enter the 6-digit code we sent to the phone number and email on file for this business.</p>
          <div className="mt-4">
            <VerifyForm businessId={biz.id} placeId={place.id} contactName={biz.contactName} contactRole={biz.contactRole || "Owner"} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-6xl pt-10">
      <Link href="/business/dashboard" className="text-sm text-muted hover:underline">
        ← Your listings
      </Link>
      <div className="mt-4">{header}</div>

      {sp.upgraded && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-brand-600 p-4 text-white">
          <PartyPopper className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <strong>{tier.name} is active.</strong> AI insights, analytics and new profile options are unlocked for this listing.
          </div>
        </div>
      )}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line scrollbar-none" aria-label="Business console">
        {TABS.map(([k, label, Icon]) => (
          <Link
            key={k}
            href={`/business/${biz.id}?tab=${k}`}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium", tab === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
            aria-current={tab === k ? "page" : undefined}
          >
            <Icon className="size-4" />
            {label}
            {k === "reviews" && rs.unansweredRecent > 0 && <span className="badge bg-coral-500 text-white">{rs.unansweredRecent}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <Overview placeId={place.id} placeType={place.type} rank={rank} rating={place.rating} ranking={place.ranking} rankingTotal={place.rankingTotal} rs={rs} businessId={biz.id} />}

        {tab === "reviews" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(["unanswered", "negative", "all"] as const).map((f) => (
                <Link key={f} href={`/business/${biz.id}?tab=reviews&filter=${f}`} className="chip capitalize" data-active={(sp.filter || "unanswered") === f}>
                  {f === "negative" ? "3★ and below" : f}
                </Link>
              ))}
              <span className="ml-auto text-sm text-muted">
                {rs.answered} of {rs.total} reviews answered
              </span>
            </div>
            {(() => {
              const list = reviewsForOwner(place.id, (sp.filter as "all") || "unanswered", 25);
              return list.length ? (
                <ReviewResponder businessId={biz.id} reviews={list} canUseAi={rank >= 1} />
              ) : (
                <div className="card p-10 text-center text-sm text-muted">Nothing here — you&apos;re all caught up. 🎉</div>
              );
            })()}
          </div>
        )}

        {tab === "insights" && (rank >= 1 ? <Insights placeId={place.id} rank={rank} /> : <Locked need="insights" placeId={place.id}><InsightsTeaser /></Locked>)}

        {tab === "ads" && <Ads businessId={biz.id} />}

        {tab === "profile" && (
          <div className="max-w-3xl">
            <p className="mb-4 text-sm text-muted">These details appear on your public page next to the Verified owner badge.</p>
            <ListingEditor businessId={biz.id} initial={{ website: biz.website, phone: biz.phone, bookingUrl: biz.bookingUrl, announcement: biz.announcement }} paid={rank >= 1} />
            {place.type !== "hotel" && rank >= 1 && <p className="mt-3 text-xs text-muted">Book Direct links are shown on hotel pages. Experiences and restaurants take bookings through Wayfarer automatically.</p>}
          </div>
        )}

        {tab === "plan" && <PlanTab placeId={place.id} userId={user.id} current={biz.tier} />}
      </div>
    </div>
  );
}

function Overview({
  placeId,
  placeType,
  rank,
  rating,
  ranking,
  rankingTotal,
  rs,
  businessId,
}: {
  placeId: number;
  placeType: string;
  rank: number;
  rating: number;
  ranking: number;
  rankingTotal: number;
  rs: { total: number; answered: number; unansweredRecent: number };
  businessId: number;
}) {
  const days = rank >= 1 ? 90 : 30;
  const a = placeAnalytics(placeId, days);
  const t = Object.fromEntries(a.totals.map((x) => [x.key, x])) as unknown as Record<"views" | "saves" | "clickouts" | "bookings", { value: number; previous: number }>;
  const conversion = placeType === "hotel" ? "clickouts" : "bookings";
  const trend = ratingTrend(placeId);
  // Conversions are a handful a day, so weekly totals read better than daily bars.
  const weekly: { day: string; value: number }[] = [];
  for (let end = a.series.length; end > 0; end -= 7) {
    const chunk = a.series.slice(Math.max(0, end - 7), end);
    weekly.unshift({ day: chunk[0].day, value: chunk.reduce((s, d) => s + d[conversion], 0) });
  }
  const kpis = [
    { label: "Page views · 30d", value: t.views.value, prev: t.views.previous, locked: false },
    { label: "Saves to wishlists", value: t.saves.value, prev: t.saves.previous, locked: rank < 1 },
    { label: placeType === "hotel" ? "Clicks to booking partners" : "Bookings via Wayfarer", value: t[conversion].value, prev: t[conversion].previous, locked: rank < 1 },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-muted">{k.label}</div>
            {k.locked ? (
              <Link href={`/business/${businessId}?tab=plan`} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400">
                <Lock className="size-4" /> Insights
              </Link>
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold">{k.value.toLocaleString("en-US")}</span>
                <Delta value={k.value} previous={k.prev} />
              </div>
            )}
          </div>
        ))}
        <div className="card p-4">
          <div className="text-xs text-muted">Rating & rank</div>
          <div className="mt-1 font-display text-2xl font-semibold">★ {rating.toFixed(2)}</div>
          <div className="text-xs text-muted">{ranking ? `#${ranking} of ${rankingTotal} in town` : "Not ranked yet"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          <div className="font-semibold">Daily page views · {days} days</div>
          <MiniBars className="mt-4" data={a.series.map((d) => ({ label: d.day, value: d.views }))} height={150} />
          <DayAxis days={a.series.map((d) => d.day)} />
        </div>
        <div className="card p-5">
          <div className="font-semibold">{placeType === "hotel" ? "Clicks to booking partners" : "Bookings via Wayfarer"} · by week</div>
          {rank >= 1 ? (
            <>
              <MiniBars className="mt-4" data={weekly.map((w) => ({ label: `Week of ${w.day}`, value: w.value }))} color="bg-coral-500/85" height={150} />
              <DayAxis days={weekly.map((w) => w.day)} />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              <Lock className="mr-1 inline size-3.5" />
              See how many travelers click through or book each day with Business Insights.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="font-semibold">Review replies</div>
          <p className="mt-1 text-sm text-muted">Travelers are more likely to book places that reply to reviews — especially the critical ones.</p>
          <div className="mt-4 flex items-end gap-6">
            <div>
              <div className="font-display text-4xl font-semibold">{rs.total ? Math.round((rs.answered / rs.total) * 100) : 0}%</div>
              <div className="text-xs text-muted">answered overall</div>
            </div>
            <div>
              <div className="font-display text-4xl font-semibold text-coral-600">{rs.unansweredRecent}</div>
              <div className="text-xs text-muted">unanswered in the last 90 days</div>
            </div>
          </div>
          <Link href={`/business/${businessId}?tab=reviews`} className="btn btn-dark btn-sm mt-4">
            <MessageCircleReply className="size-4" /> Reply now
          </Link>
        </div>
        <div className="card p-5">
          <div className="font-semibold">Rating by month</div>
          {rank >= 1 ? (
            trend.length ? (
              <div className="mt-4 space-y-1.5">
                {trend.slice(-8).map((m) => (
                  <div key={m.ym} className="flex items-center gap-3 text-sm">
                    <span className="w-28 text-muted">{formatMonthYear(m.ym)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${(m.avg / 5) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right font-semibold">{m.avg.toFixed(1)}</span>
                    <span className="w-10 text-right text-xs text-muted">{m.n}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">No reviews in the last year.</p>
            )
          ) : (
            <p className="mt-2 text-sm text-muted">
              <Lock className="mr-1 inline size-3.5" />
              Monthly rating trends are part of Business Insights. <Link href={`/business/${businessId}?tab=plan`} className="underline">Compare plans</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function Insights({ placeId, rank }: { placeId: number; rank: number }) {
  const place = getPlaceById(placeId)!;
  const summary = place.reviewCount ? await getReviewSummary(place) : null;
  const bench = competitorBenchmark(placeId);
  const weakest = bench?.aspects.filter((x) => x.delta < 0).slice(0, 3) ?? [];
  const strongest = bench ? [...bench.aspects].sort((a, b) => b.delta - a.delta).filter((x) => x.delta > 0).slice(0, 2) : [];
  return (
    <div className="space-y-6">
      {summary ? (
        <div className="ai-border p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-coral-500" /> AI review insights · based on {summary.basedOn} reviews · {summary.provider === "claude" ? "Claude" : "local AI"}
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{summary.headline}</div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{summary.summary}</p>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400">
                <ThumbsUp className="size-4" /> What guests love
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {summary.pros.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-coral-600">
                <ThumbsDown className="size-4" /> What to work on
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {summary.cons.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
                {!summary.cons.length && <li className="text-muted">No recurring complaints in recent reviews — nice work.</li>}
              </ul>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {summary.aspects.slice(0, 8).map((a) => (
              <div key={a.key} className="flex items-center gap-2 text-sm">
                <span className="w-28 truncate text-muted">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", a.sentiment === "positive" ? "bg-brand-500" : a.sentiment === "negative" ? "bg-coral-500" : "bg-sun-400")} style={{ width: `${(a.score / 5) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-semibold">{a.score.toFixed(1)}</span>
                <span className="w-12 text-right text-xs text-muted">{a.mentions}×</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-sm text-muted">Insights appear once you have a few reviews.</div>
      )}

      {bench && (rank >= 2 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Target className="size-4 text-brand-600" /> You vs. the top 10 in town
            </div>
            <p className="mt-1 text-xs text-muted">
              Aspect scores from review text. Peer median rating ★ {bench.peerMedianRating} from a median of {bench.peerMedianReviews} reviews.
            </p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Aspect</th>
                  <th className="pb-2 text-right font-medium">You</th>
                  <th className="pb-2 text-right font-medium">Top-10 median</th>
                  <th className="pb-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {bench.aspects.map((x) => (
                  <tr key={x.aspect} className="border-t border-line">
                    <td className="py-1.5 capitalize">{x.aspect}</td>
                    <td className="py-1.5 text-right font-semibold">{x.mine.toFixed(1)}</td>
                    <td className="py-1.5 text-right text-muted">{x.peers ? x.peers.toFixed(1) : "—"}</td>
                    <td className={cn("py-1.5 text-right font-semibold", x.delta < 0 ? "text-coral-600" : "text-brand-600 dark:text-brand-400")}>
                      {x.delta > 0 ? "+" : ""}
                      {x.delta.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ai-border p-5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4 text-coral-500" /> AI action plan
            </div>
            <ol className="mt-3 space-y-3 text-sm">
              {weakest.map((w, i) => (
                <li key={w.aspect}>
                  <strong>
                    {i + 1}. Fix {w.aspect}
                  </strong>{" "}
                  — guests score it {Math.abs(w.delta).toFixed(1)} below the city&apos;s best. It&apos;s your biggest gap, so it&apos;s where new reviews can move your rating most.
                </li>
              ))}
              {strongest.map((s) => (
                <li key={s.aspect}>
                  <strong>Promote your {s.aspect}</strong> — you beat the top-10 median by {s.delta.toFixed(1)}. Mention it in your announcement and replies.
                </li>
              ))}
              {!weakest.length && !strongest.length && <li>You&apos;re level with the best in town on every aspect — keep replying to reviews to stay there.</li>}
            </ol>
          </div>
        </div>
      ) : (
        <Locked need="pro" placeId={placeId}>
          <div className="card h-56 p-5">
            <div className="font-semibold">You vs. the top 10 in town</div>
            <div className="mt-4 space-y-2">
              {[70, 55, 82, 40, 64].map((w, i) => (
                <div key={i} className="h-3 rounded-full bg-surface-3" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </Locked>
      ))}
    </div>
  );
}

function InsightsTeaser() {
  return (
    <div className="card h-72 p-6">
      <div className="h-6 w-2/3 rounded bg-surface-3" />
      <div className="mt-3 h-4 w-full rounded bg-surface-2" />
      <div className="mt-2 h-4 w-5/6 rounded bg-surface-2" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-3 rounded-full bg-surface-3" />
        ))}
      </div>
    </div>
  );
}

function Ads({ businessId }: { businessId: number }) {
  const campaigns = campaignsFor(businessId);
  const daily = campaignDaily(businessId, 30);
  const totals = daily.reduce((s, d) => ({ impressions: s.impressions + d.impressions, clicks: s.clicks + d.clicks, spend: s.spend + d.spend }), { impressions: 0, clicks: 0, spend: 0 });
  return (
    <div className="space-y-6">
      {daily.length > 0 && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Sponsored performance · 30 days</div>
            <div className="flex gap-4 text-sm">
              <span>
                <strong>{totals.impressions.toLocaleString("en-US")}</strong> <span className="text-muted">impressions</span>
              </span>
              <span>
                <strong>{totals.clicks.toLocaleString("en-US")}</strong> <span className="text-muted">clicks</span>
              </span>
              <span>
                <strong>{formatCents(totals.spend)}</strong> <span className="text-muted">spent</span>
              </span>
              <span>
                <strong>{totals.clicks ? formatCents(Math.round(totals.spend / totals.clicks), { decimals: true }) : "—"}</strong> <span className="text-muted">avg CPC</span>
              </span>
            </div>
          </div>
          <MiniBars className="mt-4" data={daily.map((d) => ({ label: d.day, value: d.spend }))} color="bg-coral-400" format={(n) => formatCents(n)} height={110} />
          <DayAxis days={daily.map((d) => d.day)} />
        </div>
      )}
      <CampaignManager businessId={businessId} campaigns={campaigns} minCpc={MIN_CPC_CENTS} minBudget={MIN_DAILY_BUDGET_CENTS} />
      <p className="text-xs text-muted">
        Sponsored placements are labelled, never affect organic rankings or AI answers, and are only shown for places rated 3.5★+. See the{" "}
        <Link href="/legal/business-terms#ads" className="underline">
          advertising policy
        </Link>
        .
      </p>
    </div>
  );
}

function PlanTab({ placeId, userId, current }: { placeId: number; userId: number; current: BusinessTier }) {
  const sub = activeSubscription(userId, current === "pro" ? "business_pro" : "business_insights", placeId);
  return (
    <div id="plan" className="space-y-6">
      {sub && current !== "free" && (
        <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
          <div className="flex-1">
            <strong>{sub.productName}</strong> · {formatCents(sub.priceCents)} / {sub.interval} · {sub.cancelAtPeriodEnd ? "ends" : "renews"} {sub.currentPeriodEnd.slice(0, 10)}
          </div>
          <SubscriptionActions id={sub.id} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} periodEnd={sub.currentPeriodEnd} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {BUSINESS_TIERS.map((t) => {
          const isCurrent = t.id === current;
          return (
            <div key={t.id} className={cn("card flex flex-col p-5", isCurrent && "ring-2 ring-brand-500")}>
              <div className="flex items-center justify-between">
                <div className="font-display text-xl font-semibold">{t.name}</div>
                {isCurrent && <span className="badge bg-brand-600 text-white">Current</span>}
              </div>
              <div className="mt-1 font-display text-3xl font-semibold">
                {t.monthlyCents ? formatCents(t.monthlyCents) : "Free"}
                {t.monthlyCents > 0 && <span className="text-sm font-normal text-muted">/mo</span>}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {t.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                {isCurrent ? (
                  <div className="btn btn-outline w-full cursor-default opacity-70">Your plan</div>
                ) : t.product && tierRank(t.id) > tierRank(current) ? (
                  <Link href={`/checkout?product=${t.product}&place=${placeId}`} className="btn btn-primary w-full">
                    Upgrade
                  </Link>
                ) : (
                  <div className="text-center text-xs text-muted">Cancel your current plan to move down a tier.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Plans are per listing and never change rankings. <Link href="/legal/business-terms" className="underline">Business terms</Link>
      </p>
    </div>
  );
}
