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
import { getLocale, translateList, translatePlural, useT } from "@/lib/locale";
import { formatNumber, VIBE_EMOJI, VIBES } from "@/lib/utils";

export default async function HomePage() {
  const locale = await getLocale();
  const t = useT(locale);
  const MONTHS = translateList(locale, "months");
  const MONTHS_IN = translateList(locale, "monthsIn");
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
              {t("home.heroBadge")}
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.heroH1")}
              <br />
              <span className="ai-text">{t("home.heroH2")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t("home.heroSub", { count: dests.length })}</p>
            <div className="mt-7 max-w-2xl">
              <HeaderSearch large placeholder={t("home.heroSearch")} />
            </div>
            <HeroPrompts />
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                [formatNumber(stats.destinations), t("home.stats.destinations")],
                [formatNumber(stats.places), t("home.stats.places")],
                [formatNumber(stats.reviews), t("home.stats.reviews")],
                [formatNumber(stats.countries), t("home.stats.countries")],
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
                <Sparkles className="size-3.5" /> {t("home.aiSummary")}
              </div>
              <p className="mt-1.5 text-sm leading-snug">&ldquo;{t("home.aiSummaryText")}&rdquo;</p>
              <div className="mt-2 flex gap-1.5">
                <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">{t("home.views", { n: "4.9" })}</span>
                <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">{t("home.staff", { n: "4.8" })}</span>
                <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{t("home.access", { n: "3.1" })}</span>
              </div>
            </div>
            <div className="card absolute left-0 top-16 w-60 p-3.5 animate-fade-up [animation-delay:360ms]">
              <div className="text-xs font-semibold text-muted">{t("home.dayLabel")}</div>
              <ol className="mt-2 space-y-1.5 text-sm">
                {translateList(locale, "home.schedule").map((s) => (
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
            <h3 className="mt-4 font-display text-2xl font-semibold">{t("home.features.planner.title")}</h3>
            <p className="mt-2 text-sm text-white/75">{t("home.features.planner.text")}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              {t("home.features.planner.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <div className="group relative overflow-hidden rounded-3xl bg-coral-500 p-6 text-white shadow-lift">
            <div className="absolute -bottom-12 -right-6 size-44 rounded-full bg-coral-300/50 blur-2xl" />
            <MessagesSquare className="size-8 text-coral-100" />
            <h3 className="mt-4 font-display text-2xl font-semibold">{t("home.features.concierge.title")}</h3>
            <p className="mt-2 text-sm text-white/85">{t("home.features.concierge.text")}</p>
            <AskButton prompt={t("home.features.concierge.prompt")} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              {t("home.features.concierge.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </AskButton>
          </div>
          <Link href="/match" className="group relative overflow-hidden rounded-3xl bg-ink p-6 text-bg shadow-lift">
            <div className="absolute -left-10 -bottom-10 size-40 rounded-full bg-violet-500/30 blur-2xl" />
            <Compass className="size-8 text-violet-300" />
            <h3 className="mt-4 font-display text-2xl font-semibold">{t("home.features.matcher.title")}</h3>
            <p className="mt-2 text-sm opacity-75">{t("home.features.matcher.text")}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
              {t("home.features.matcher.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      <RecentlyViewed />

      {/* ───────────── TRENDING ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow={t("home.trending.eyebrow")} title={t("home.trending.title")} subtitle={t("home.trending.subtitle")} href="/destinations" linkLabel={t("home.trending.linkLabel")} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {dests.slice(0, 8).map((d, i) => (
            <DestinationCard key={d.slug} d={d} size={i === 0 ? "lg" : "md"} className={i === 0 ? "col-span-2 row-span-2" : ""} />
          ))}
        </div>
      </section>

      {/* ───────────── SEASONAL ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader
          eyebrow={t("home.seasonal.eyebrow", { month: MONTHS[nextMonth - 1] })}
          title={t("home.seasonal.title", { month: MONTHS_IN[nextMonth - 1] })}
          subtitle={t("home.seasonal.subtitle")}
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
                  <span>🌧 {translatePlural(locale, "home.rainyDaysPlural", d.rainyDays)}</span>
                </div>
              }
            />
          ))}
        </div>
      </section>

      {/* ───────────── TRAVELERS' CHOICE ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow={t("home.choice.eyebrow", { year: new Date().getFullYear() })} title={t("home.choice.title")} subtitle={t("home.choice.subtitle")} href="/search?q=travelers+choice" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {choice.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      </section>

      {/* ───────────── VIBES ───────────── */}
      <section className="container-page mt-20">
        <SectionHeader title={t("home.vibes.title")} subtitle={t("home.vibes.subtitle")} />
        <div className="flex flex-wrap gap-2.5">
          {VIBES.map((v) => (
            <Link key={v} href={`/destinations?vibe=${v}`} className="chip px-4 py-2.5 text-sm capitalize hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950">
              <span className="text-base">{VIBE_EMOJI[v]}</span> {t(`vibes.${v}`)}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── STAYS & EATS ───────────── */}
      <section className="container-page mt-20 grid gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader title={t("home.stays.title")} href="/search?q=best+hotels" />
          <div className="space-y-3">
            {stays.map((p) => (
              <PlaceCard key={p.id} place={p} layout="horizontal" />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title={t("home.eats.title")} href="/search?q=best+restaurants" />
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
            <SectionHeader eyebrow={t("home.gems.eyebrow")} title={t("home.gems.title")} subtitle={t("home.gems.subtitle")} />
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
        <SectionHeader eyebrow={t("home.how.eyebrow")} title={t("home.how.title")} />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: ScanSearch, title: t("home.how.f1t"), text: t("home.how.f1b") },
            { icon: ShieldCheck, title: t("home.how.f2t"), text: t("home.how.f2b") },
            { icon: MapIcon, title: t("home.how.f3t"), text: t("home.how.f3b") },
            { icon: Bot, title: t("home.how.f4t"), text: t("home.how.f4b") },
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
          <SectionHeader title={t("home.community.title")} subtitle={t("home.community.subtitle")} href="/leaderboard" linkLabel={t("home.community.linkLabel")} />
          <div className="card px-5">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} showPlace />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title={t("home.tripIdeas.title")} subtitle={t("home.tripIdeas.subtitle")} />
          <div className="space-y-3">
            {trips.map((tr) => (
              <Link key={tr.id} href={`/trips/share/${tr.shareToken}`} className="card group flex items-center gap-3 p-3 hover:shadow-lift">
                <SmartImage image={tr.destination?.image} alt={tr.destination?.name || tr.title} width={330} className="size-20 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <div className="truncate font-semibold group-hover:text-brand-700">{tr.title}</div>
                  <div className="text-xs text-muted">{t("home.tripMeta", { days: tr.days, place: tr.destination?.name ?? "", author: tr.owner?.displayName ?? "" })}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-ink-2">{tr.aiSummary}</div>
                </div>
              </Link>
            ))}
            <Link href="/plan" className="ai-border flex items-center justify-between p-4 hover:shadow-lift">
              <div>
                <div className="font-semibold">{t("home.tripIdeas.build")}</div>
                <div className="text-xs text-muted">{t("home.tripIdeas.buildSub")}</div>
              </div>
              <ArrowRight className="size-5 text-brand-600" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
