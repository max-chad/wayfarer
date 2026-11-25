import { ArrowRight, Bot, Compass, Map as MapIcon, MessagesSquare, ScanSearch, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { HeroPrompts, AskButton } from "@/components/home/HeroPrompts";
import { RecentlyViewed } from "@/components/home/RecentlyViewed";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { PlaceCard } from "@/components/place/PlaceCard";
import { ReviewCard } from "@/components/review/ReviewCard";
import { SectionHeader } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/SmartImage";
import { destinationsForMonth, listDestinations } from "@/lib/data/destinations";
import { siteStats } from "@/lib/data/misc";
import { topPlaces } from "@/lib/data/places";
import { recentReviews } from "@/lib/data/reviews";
import { publicTrips } from "@/lib/data/trips";
import { formatNumber, MONTHS, VIBE_EMOJI, VIBES } from "@/lib/utils";

export default function HomePage() {
  const dests = listDestinations();
  const stats = siteStats();
  const nextMonth = ((new Date().getMonth() + 1) % 12) + 1;
  const seasonal = destinationsForMonth(nextMonth, 8);
  const choice = topPlaces({ type: "attraction", award: "travelers-choice", limit: 8 });
  const gems = topPlaces({ award: "hidden-gem", limit: 4, minReviews: 3 });
  const stays = topPlaces({ type: "hotel", limit: 4 });
  const eats = topPlaces({ type: "restaurant", limit: 4 });
  const reviews = recentReviews(3);
  const trips = publicTrips(3);
  const heroes = ["santorini", "kyoto", "rio-de-janeiro", "reykjavik", "marrakech", "paris"]
    .map((s) => dests.find((d) => d.slug === s))
    .filter(Boolean)
    .slice(0, 3) as typeof dests;

  return (
    <div>
      {/* ───────────── HERO ───────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-brand-300/25 blur-3xl dark:bg-brand-700/20" />
          <div className="absolute -right-32 top-20 size-[420px] rounded-full bg-coral-300/25 blur-3xl dark:bg-coral-700/15" />
        </div>
        <div className="container-page grid items-center gap-10 pb-12 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-20 lg:pt-16">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 shadow-soft">
              <span className="ai-gradient grid size-5 place-items-center rounded-full">
                <Sparkles className="size-3 text-white" />
              </span>
              AI that has read every review, so you don&apos;t have to
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Travel smarter.
              <br />
              <span className="ai-text">Plan the trip you&apos;ll talk about.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Honest reviews summarised in seconds, day-by-day itineraries that respect geography and weather, and a 24/7 concierge for {dests.length} destinations
              worldwide.
            </p>
            <div className="mt-7 max-w-2xl">
              <HeaderSearch large placeholder="Try “quiet hotel near the beach in Bali under $200”" />
            </div>
            <HeroPrompts />
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                [formatNumber(stats.destinations), "destinations"],
                [formatNumber(stats.places), "places reviewed"],
                [formatNumber(stats.reviews), "traveler reviews"],
                [formatNumber(stats.countries), "countries"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd>
                    <span className="font-display text-2xl font-semibold">{n}</span> <span className="text-muted">{l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden h-[560px] lg:block">
            {heroes[0] && (
              <Link href={`/destinations/${heroes[0].slug}`} className="absolute right-0 top-0 h-[380px] w-[300px] overflow-hidden rounded-[2rem] shadow-lift animate-fade-up">
                <SmartImage image={heroes[0].image} alt={heroes[0].name} width={960} className="h-full w-full" priority>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 right-4 text-right text-white">
                    <div className="text-xs uppercase tracking-wider text-white/80">{heroes[0].country}</div>
                    <div className="font-display text-2xl font-semibold">{heroes[0].name}</div>
                  </div>
                </SmartImage>
              </Link>
            )}
            {heroes[1] && (
              <Link href={`/destinations/${heroes[1].slug}`} className="absolute bottom-0 left-4 h-[300px] w-[250px] overflow-hidden rounded-[2rem] shadow-lift animate-fade-up [animation-delay:120ms]">
                <SmartImage image={heroes[1].image} alt={heroes[1].name} width={500} className="h-full w-full" priority>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <div className="text-xs uppercase tracking-wider text-white/80">{heroes[1].country}</div>
                    <div className="font-display text-xl font-semibold">{heroes[1].name}</div>
                  </div>
                </SmartImage>
              </Link>
            )}
            <div className="card absolute bottom-24 right-6 w-72 p-4 animate-fade-up [animation-delay:240ms]">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                <Sparkles className="size-3.5" /> AI review summary
              </div>
              <p className="mt-1.5 text-sm leading-snug">
                &ldquo;Travelers love the <strong>sunset views</strong> and <strong>friendly staff</strong>; a few mention <strong>steep stairs</strong>.&rdquo;
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">Views 4.9</span>
                <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">Staff 4.8</span>
                <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Access 3.1</span>
              </div>
            </div>
            <div className="card absolute left-0 top-16 w-60 p-3.5 animate-fade-up [animation-delay:360ms]">
              <div className="text-xs font-semibold text-muted">Day 2 · Kyoto</div>
              <ol className="mt-2 space-y-1.5 text-sm">
                {["08:30 Fushimi Inari at dawn", "12:30 Lunch · soba", "15:00 Gion stroll", "19:30 Kaiseki dinner"].map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-coral-500" />
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── AI FEATURES ───────────── */}
      <section className="container-page">
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/plan" className="group relative overflow-hidden rounded-3xl bg-brand-900 p-6 text-white shadow-lift">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-500/40 blur-2xl transition-transform group-hover:scale-125" />
            <Wand2 className="size-8 text-brand-300" />
            <h3 className="mt-4 font-display text-2xl font-semibold">AI trip planner</h3>
            <p className="mt-2 text-sm text-white/75">Day-by-day plans clustered by neighbourhood, weather-aware, with meals, costs and a live map.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              Plan a trip <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <div className="group relative overflow-hidden rounded-3xl bg-coral-500 p-6 text-white shadow-lift">
            <div className="absolute -bottom-12 -right-6 size-44 rounded-full bg-coral-300/50 blur-2xl" />
            <MessagesSquare className="size-8 text-coral-100" />
            <h3 className="mt-4 font-display text-2xl font-semibold">Travel concierge</h3>
            <p className="mt-2 text-sm text-white/85">Ask anything — “rooftop bar near my hotel?”, “is Cusco safe?” — and get grounded answers with real places.</p>
            <AskButton prompt="What should I do on a rainy day in London?" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              Start chatting <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </AskButton>
          </div>
          <Link href="/match" className="group relative overflow-hidden rounded-3xl bg-ink p-6 text-bg shadow-lift">
            <div className="absolute -left-10 -bottom-10 size-40 rounded-full bg-violet-500/30 blur-2xl" />
            <Compass className="size-8 text-violet-300" />
            <h3 className="mt-4 font-display text-2xl font-semibold">Destination matcher</h3>
            <p className="mt-2 text-sm opacity-75">Six quick questions → your best-matched destinations with reasons, flight time and CO₂.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              Find my match <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      <RecentlyViewed />

      {/* ───────────── TRENDING ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Trending now" title="Destinations travelers love" subtitle="Ranked by review activity and ratings across Wayfarer." href="/destinations" linkLabel="All destinations" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {dests.slice(0, 8).map((d, i) => (
            <DestinationCard key={d.slug} d={d} size={i === 0 ? "lg" : "md"} className={i === 0 ? "col-span-2 row-span-2" : ""} />
          ))}
        </div>
      </section>

      {/* ───────────── SEASONAL ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader
          eyebrow={`Planning for ${MONTHS[nextMonth - 1]}?`}
          title={`Where to go in ${MONTHS[nextMonth - 1]}`}
          subtitle="Our climate model blends 3 years of weather data with local seasons."
          href={`/destinations?month=${nextMonth}`}
        />
        <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {seasonal.map((d) => (
            <DestinationCard
              key={d.slug}
              d={d}
              size="sm"
              className="w-64 shrink-0 snap-start"
              extra={
                <div className="mt-2 flex items-center gap-3 text-xs text-white/85">
                  <span>☀️ {Math.round(d.tmax)}°C</span>
                  <span>🌧 {d.rainyDays} rainy days</span>
                </div>
              }
            />
          ))}
        </div>
      </section>

      {/* ───────────── TRAVELERS' CHOICE ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Travelers' Choice 2026" title="The world's most-loved sights" subtitle="Top 20% of attractions by weighted traveler rating." href="/search?q=travelers+choice" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {choice.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      </section>

      {/* ───────────── VIBES ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader title="Explore by vibe" subtitle="What kind of trip are you in the mood for?" />
        <div className="flex flex-wrap gap-2.5">
          {VIBES.map((v) => (
            <Link key={v} href={`/destinations?vibe=${v}`} className="chip px-4 py-2.5 text-sm capitalize hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950">
              <span className="text-base">{VIBE_EMOJI[v]}</span> {v}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── STAYS & EATS ───────────── */}
      <section className="container-page mt-20 grid gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader title="Stays guests rave about" href="/search?q=best+hotels" />
          <div className="space-y-3">
            {stays.map((p) => (
              <PlaceCard key={p.id} place={p} layout="horizontal" />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title="Tables worth traveling for" href="/search?q=best+restaurants" />
          <div className="space-y-3">
            {eats.map((p) => (
              <PlaceCard key={p.id} place={p} layout="horizontal" />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── HIDDEN GEMS ───────────── */}
      {gems.length > 0 && (
        <section className="container-page mt-20">
          <div className="rounded-[2rem] bg-violet-50 p-6 dark:bg-violet-950/30 sm:p-10">
            <SectionHeader eyebrow="💎 Hidden gems" title="Under the radar, over the moon" subtitle="Rated 4.5+ with fewer reviews than their neighbours — before everyone finds out." />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {gems.map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── HOW AI WORKS ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Under the hood" title="An advisor, not just a directory" />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: ScanSearch, title: "Reads every review", text: "Aspect-level sentiment across 16k+ reviews: what's great, what's not, and who it's for." },
            { icon: ShieldCheck, title: "Flags fake reviews", text: "An authenticity model scores every review for spam patterns, rating mismatches and brand-new accounts." },
            { icon: MapIcon, title: "Plans like a local", text: "Clusters sights by neighbourhood, routes each day and moves museums to rainy days." },
            { icon: Bot, title: "Grounded answers", text: "The concierge only recommends places that really exist in our database — no invented venues." },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── COMMUNITY ───────────── */}
      <section className="container-page mt-20 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeader title="Fresh from the community" subtitle="Recent, highly-trusted reviews." href="/leaderboard" linkLabel="Top contributors" />
          <div className="card px-5">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} showPlace />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title="Trip ideas" subtitle="Itineraries shared by travelers." />
          <div className="space-y-3">
            {trips.map((t) => (
              <Link key={t.id} href={`/trips/share/${t.shareToken}`} className="card group flex items-center gap-3 p-3 hover:shadow-lift">
                <SmartImage image={t.destination?.image} alt={t.destination?.name || t.title} width={330} className="size-20 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <div className="truncate font-semibold group-hover:text-brand-700">{t.title}</div>
                  <div className="text-xs text-muted">
                    {t.days} days · {t.destination?.name} · by {t.owner?.displayName}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-ink-2">{t.aiSummary}</div>
                </div>
              </Link>
            ))}
            <Link href="/plan" className="ai-border flex items-center justify-between p-4 hover:shadow-lift">
              <div>
                <div className="font-semibold">Build your own in 30 seconds</div>
                <div className="text-xs text-muted">The AI planner does the heavy lifting.</div>
              </div>
              <ArrowRight className="size-5 text-brand-600" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
