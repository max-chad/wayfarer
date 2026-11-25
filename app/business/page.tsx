import { BadgeCheck, BarChart3, BookOpenCheck, Check, Megaphone, MessageCircleReply, Scale, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { businessDirectoryStats, isBusinessOwner, MIN_CPC_CENTS, MIN_DAILY_BUDGET_CENTS } from "@/lib/data/business";
import { funnel } from "@/lib/data/revenue";
import { siteStats } from "@/lib/data/misc";
import { BUSINESS_TIERS, formatCents } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Wayfarer for Business",
  description: "Claim your free listing, reply to reviews, see AI review insights and reach travelers while they plan. Rankings are never for sale.",
};

const VALUE = [
  [MessageCircleReply, "Reply to every review", "Thank happy guests and turn critics around in public. AI drafts a reply that addresses what the guest actually wrote — you edit and publish."],
  [Sparkles, "Know what to fix next", "Our AI reads every review and scores you on the things guests care about — cleanliness, service, value, noise — against the top places in your city."],
  [BookOpenCheck, "Book direct, commission-free", "Hotels on Insights get a Book Direct link right next to partner prices. Experiences and restaurants take bookings straight from your page."],
  [BarChart3, "See how travelers find you", "Page views, saves, partner clicks and bookings day by day, so you can see what's working."],
] as const;

export default async function BusinessLanding() {
  const user = await getCurrentUser();
  const owner = user ? isBusinessOwner(user.id) : false;
  const stats = siteStats();
  const dir = businessDirectoryStats();
  const f = funnel(30);
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="container-page grid grid-cols-1 gap-10 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <BadgeCheck className="size-4" /> Wayfarer for Business
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-6xl">Travelers ask AI where to go. Make sure it knows you.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              Claim your free listing to reply to reviews and keep your details right. Upgrade for AI review insights, a commission-free Book Direct link and analytics.
            </p>
            <form action="/business/claim" className="mt-8 flex w-full max-w-lg gap-2 rounded-full bg-white p-1.5 shadow-xl">
              <Search className="ml-3 size-5 self-center text-muted" />
              <input name="q" size={1} placeholder="Find your hotel, restaurant or tour" className="min-w-0 flex-1 bg-transparent px-1 text-ink outline-none placeholder:text-muted" aria-label="Business name" />
              <button className="btn btn-accent">Claim free</button>
            </form>
            {owner && (
              <Link href="/business/dashboard" className="mt-4 inline-block text-sm font-semibold text-white underline underline-offset-4">
                Go to your business dashboard →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            {[
              [f.views ? Math.round(f.views / 1000) + "k" : "—", "listing views in the last 30 days"],
              [stats.reviews.toLocaleString("en-US"), "reviews read by our AI"],
              [dir.claimed.toLocaleString("en-US"), "businesses already claimed"],
              [f.bookings ? f.bookings.toLocaleString("en-US") : "—", "bookings & reservations last 30 days"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                <div className="font-display text-3xl font-semibold">{n}</div>
                <div className="mt-1 text-sm text-white/75">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
        {VALUE.map(([Icon, title, body]) => (
          <div key={title} className="card flex gap-4 p-6">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <section id="plans" className="container-page mt-20 scroll-mt-24">
        <h2 className="text-center font-display text-4xl font-semibold tracking-tight">Plans for every kind of business</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">Start free. Upgrade a single listing when you&apos;re ready — month to month, cancel anytime.</p>
        <div className="mx-auto mt-10 grid grid-cols-1 max-w-5xl gap-5 lg:grid-cols-3">
          {BUSINESS_TIERS.map((t) => (
            <div key={t.id} className={cn("card flex flex-col p-6", t.id === "insights" && "ring-2 ring-brand-500")}>
              {t.id === "insights" && <span className="badge mb-2 w-fit bg-brand-600 text-white">Most popular</span>}
              <div className="font-display text-2xl font-semibold">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold">{t.monthlyCents ? formatCents(t.monthlyCents) : "Free"}</span>
                {t.monthlyCents > 0 && <span className="text-muted">/ month per listing</span>}
              </div>
              <p className="mt-2 text-sm text-muted">{t.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                    {x}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Link href={owner ? "/business/dashboard" : "/business/claim"} className={cn("btn w-full", t.id === "insights" ? "btn-primary" : "btn-outline")}>
                  {t.id === "free" ? "Claim your listing" : owner ? `Upgrade a listing` : "Claim, then upgrade"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="advertise" className="container-page mt-20 scroll-mt-24">
        <div className="card grid grid-cols-1 gap-8 overflow-hidden p-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-coral-600 dark:text-coral-400">
              <Megaphone className="size-4" /> Sponsored listings
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold">Be seen by travelers who are choosing right now</h2>
            <p className="mt-3 text-muted">
              Appear in one clearly labelled sponsored slot above your city&apos;s rankings and in matching searches. You set a daily budget and a maximum cost per click; you only pay when
              a traveler clicks.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                `From ${formatCents(MIN_CPC_CENTS, { decimals: true })} per click, ${formatCents(MIN_DAILY_BUDGET_CENTS)} minimum daily budget`,
                "Slots ranked by bid × rating — a well-reviewed place can win with a lower bid",
                "Repeat clicks from the same traveler within 30 minutes are free",
                "Live impressions, clicks and spend in your dashboard",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <TrendingUp className="mt-0.5 size-4 shrink-0 text-coral-500" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-surface-2 p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Scale className="size-5 text-brand-600" /> Our rules for paid placement
            </div>
            <ul className="mt-4 space-y-3 text-sm text-ink-2">
              {[
                "Money never changes organic rankings, review scores or awards.",
                "The AI concierge and planner never receive advertising data and never recommend a place because it paid.",
                "Sponsored slots are always labelled and explain why they're shown.",
                "Only places rated 3.5★ or higher can advertise.",
                "No business can pay to remove, hide or reorder reviews. Ever.",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  {x}
                </li>
              ))}
            </ul>
            <Link href="/how-we-make-money" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              Read how Wayfarer makes money →
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page mt-20 max-w-3xl">
        <h2 className="font-display text-3xl font-semibold">Questions owners ask</h2>
        <div className="mt-6 divide-y divide-line">
          {[
            ["Can I remove a negative review?", "No. You can reply publicly, and you can report a review that breaks our guidelines (for example a fake or conflict-of-interest review). Our trust team and authenticity model decide — paying customers get no special treatment."],
            ["Will upgrading improve my ranking?", "No. Rankings are a Bayesian score of published reviews that pass our authenticity checks. What paid plans give you is better information and a better way to convert the travelers who already find you."],
            ["How do bookings work?", "Experiences and restaurants can receive bookings directly from their Wayfarer page. We charge a commission only on completed bookings (8% of the booking value for tours and tickets, a per-guest fee for restaurant reservations)."],
            ["Can I cancel?", "Yes, anytime from your dashboard. You keep paid features until the end of the billing period."],
          ].map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
