import { CalendarHeart, Clock, Coins, Languages, MessageCircle, Plug, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiBrief, AiBriefSkeleton } from "@/components/destination/AiBrief";
import { BudgetCalculator } from "@/components/destination/BudgetCalculator";
import { ClimateChart } from "@/components/destination/ClimateChart";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { DestinationMap } from "@/components/destination/DestinationMap";
import { GettingThere } from "@/components/destination/GettingThere";
import { LocalTime } from "@/components/destination/LocalTime";
import { Phrasebook } from "@/components/destination/Phrasebook";
import { WeatherWidget } from "@/components/destination/WeatherWidget";
import { AskButton } from "@/components/home/HeroPrompts";
import { TrackView } from "@/components/home/RecentlyViewed";
import { PlaceCard } from "@/components/place/PlaceCard";
import { Gallery } from "@/components/ui/Gallery";
import { SectionHeader } from "@/components/ui/Section";
import { Stars } from "@/components/ui/Stars";
import { getCurrentUser } from "@/lib/auth";
import { getDestination, similarDestinations } from "@/lib/data/destinations";
import { listPlaces, mapPoints } from "@/lib/data/places";
import { HOME_CITIES } from "@/lib/seed/people";
import type { PlaceType } from "@/lib/types";
import { formatNumber, formatUsd, imgUrl, MONTHS, MONTHS_SHORT, TYPE_LABELS, VIBE_EMOJI } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = getDestination(slug);
  if (!d) return { title: "Destination not found" };
  return { title: `${d.name} travel guide`, description: `${d.tagline}. Things to do, hotels, restaurants, weather and AI trip planning for ${d.name}, ${d.country}.` };
}

const NAV = [
  ["overview", "Overview"],
  ["things-to-do", "Things to do"],
  ["hotels", "Hotels"],
  ["restaurants", "Restaurants"],
  ["experiences", "Experiences"],
  ["map", "Map"],
  ["weather", "Weather"],
  ["budget", "Budget"],
  ["local-guide", "Local guide"],
];

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const d = getDestination(slug);
  if (!d) notFound();
  const user = await getCurrentUser();
  const info = d.info;
  const byType = (type: PlaceType, n = 4) => listPlaces({ destinationId: d.id, type, sort: "ranking", limit: n });
  const attractions = byType("attraction", 8);
  const hotels = byType("hotel");
  const restaurants = byType("restaurant");
  const experiences = byType("experience");
  const points = mapPoints({ destinationId: d.id }).map((p) => ({ ...p, image: p.image ? (JSON.parse(p.image) as { url: string }).url : null }));
  const similar = similarDestinations(d, 4);
  const month = new Date().getMonth() + 1;
  const inSeason = info.bestMonths.includes(month);

  const facts = [
    { icon: CalendarHeart, label: "Best time", value: info.bestMonths.map((m) => MONTHS_SHORT[m - 1]).join(", ") },
    { icon: Wallet, label: "Mid-range budget", value: `${formatUsd(info.dailyBudgetUSD.midrange)}/day` },
    { icon: Coins, label: "Currency", value: `${info.currency.name} (${info.currency.symbol})` },
    { icon: Languages, label: "Language", value: info.languages.join(", ") },
    { icon: Clock, label: "Local time", value: <LocalTime timezone={info.timezone} /> },
    { icon: Plug, label: "Power", value: `${info.plugType} · ${info.voltage}` },
    { icon: ShieldCheck, label: "Safety", value: `${info.safety.score}/5` },
  ];

  return (
    <div>
      <TrackView item={{ slug: d.slug, name: d.name, kind: "destination", image: d.image ? imgUrl(d.image, 330) : null, subtitle: d.country }} />
      <div className="container-page pt-6">
        <nav className="mb-3 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/destinations" className="hover:underline">
            Destinations
          </Link>{" "}
          / <Link href={`/destinations?continent=${encodeURIComponent(d.continent)}`} className="hover:underline">{d.continent}</Link> / <span className="text-ink">{d.name}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{d.name}</h1>
            <p className="mt-1 text-lg text-muted">
              {d.region ? `${d.region}, ` : ""}
              {d.country} · {d.tagline}
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Stars value={d.avgRating} />
              <span className="font-semibold">{d.avgRating.toFixed(1)}</span>
              <span className="text-muted">from {formatNumber(d.reviewCount)} reviews of {d.placeCount} places</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/plan?destination=${d.slug}`} className="btn btn-primary">
              <Sparkles className="size-4" /> Plan a trip here
            </Link>
            <AskButton prompt={`What are the must-knows before visiting ${d.name}?`}>
              <MessageCircle className="size-4" /> Ask the concierge
            </AskButton>
          </div>
        </div>
        <Gallery images={d.gallery.length ? d.gallery : d.image ? [d.image] : []} alt={d.name} className="mt-6 h-[300px] sm:h-[440px]" />
      </div>

      <div className="sticky top-16 z-30 mt-6 border-y border-line bg-bg/90 backdrop-blur">
        <div className="container-page scrollbar-none flex gap-1 overflow-x-auto py-2">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="container-page">
        {/* overview */}
        <section id="overview" className="scroll-mt-32 pt-10">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {d.vibes.map((v) => (
                  <Link key={v} href={`/destinations?vibe=${v}`} className="chip capitalize">
                    {VIBE_EMOJI[v]} {v}
                  </Link>
                ))}
                <span className={`badge ${inSeason ? "bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200" : "bg-surface-2 text-muted"}`}>
                  {inSeason ? `✓ ${MONTHS[month - 1]} is a great time to go` : `Best from ${MONTHS[info.bestMonths[0] - 1]}`}
                </span>
              </div>
              <div className="prose-travel text-[16px] text-ink-2">
                {d.description.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <Suspense fallback={<AiBriefSkeleton />}>
                <AiBrief dest={d} topNames={attractions.items.slice(0, 5).map((a) => a.name)} />
              </Suspense>
            </div>
            <aside className="space-y-4">
              <div className="card divide-y divide-line">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center gap-3 px-5 py-3">
                    <f.icon className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                    <span className="text-sm text-muted">{f.label}</span>
                    <span className="ml-auto text-right text-sm font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="card p-5 text-sm">
                <div className="font-semibold">Safety</div>
                <p className="mt-1 text-muted">{info.safety.notes}</p>
                <div className="mt-3 font-semibold">Getting around</div>
                <p className="mt-1 text-muted">{info.gettingAround}</p>
                <div className="mt-3 font-semibold">Tipping</div>
                <p className="mt-1 text-muted">{info.tipping}</p>
              </div>
            </aside>
          </div>
        </section>

        {/* places */}
        {(
          [
            ["things-to-do", "attraction", attractions, "Top things to do"],
            ["hotels", "hotel", hotels, "Where to stay"],
            ["restaurants", "restaurant", restaurants, "Where to eat"],
            ["experiences", "experience", experiences, "Tours & experiences"],
          ] as const
        ).map(([id, type, list, title]) => (
          <section key={id} id={id} className="scroll-mt-32 pt-16">
            <SectionHeader
              title={`${title} in ${d.name}`}
              subtitle={`${list.total} ${TYPE_LABELS[type].plural.toLowerCase()} ranked by traveler reviews`}
              href={`/destinations/${d.slug}/${TYPE_LABELS[type].route}`}
              linkLabel={`All ${TYPE_LABELS[type].plural.toLowerCase()}`}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {list.items.map((p, i) => (
                <PlaceCard key={p.id} place={p} rank={i + 1} />
              ))}
            </div>
            <Link href={`/destinations/${d.slug}/${TYPE_LABELS[type].route}`} className="btn btn-outline mt-6 sm:hidden">
              See all {TYPE_LABELS[type].plural.toLowerCase()}
            </Link>
          </section>
        ))}

        {/* map */}
        <section id="map" className="scroll-mt-32 pt-16">
          <SectionHeader title={`${d.name} on the map`} subtitle="Every place we cover, colour-coded by type." href="/map" linkLabel="Full-screen map" />
          <DestinationMap points={points} />
        </section>

        {/* weather */}
        <section id="weather" className="scroll-mt-32 pt-16">
          <SectionHeader title="Weather & best time to visit" subtitle={`Live conditions and the ${d.name} year at a glance.`} />
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <Suspense fallback={<div className="skeleton h-64 w-full" />}>
              <WeatherWidget lat={d.lat} lng={d.lng} name={d.name} />
            </Suspense>
            <div className="card p-5">
              <ClimateChart climate={d.climate} bestMonths={info.bestMonths} currentMonth={month} />
            </div>
          </div>
          {info.events?.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[...info.events]
                .sort((a, b) => ((a.month - month + 12) % 12) - ((b.month - month + 12) % 12))
                .map((e) => (
                  <div key={e.name} className="card p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-coral-600">{MONTHS[e.month - 1]}</div>
                    <div className="mt-1 font-semibold">{e.name}</div>
                    <p className="mt-1 text-sm text-muted">{e.description}</p>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* budget */}
        <section id="budget" className="scroll-mt-32 pt-16">
          <SectionHeader title="Budget & getting there" subtitle="Real-world prices, live exchange rates and your flight's footprint." />
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <BudgetCalculator info={info} name={d.name} />
            <GettingThere dest={{ name: d.name, lat: d.lat, lng: d.lng }} cities={HOME_CITIES} defaultCity={user?.homeCity} airport={info.airport} />
          </div>
        </section>

        {/* local guide */}
        <section id="local-guide" className="scroll-mt-32 pt-16">
          <SectionHeader title="Local guide" subtitle="Neighbourhoods, food, customs and phrases from people who know." />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {info.neighborhoods.map((n) => (
              <div key={n.name} className="card p-5">
                <div className="font-display text-lg font-semibold">{n.name}</div>
                <p className="mt-1 text-sm text-muted">{n.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {n.bestFor.map((b) => (
                    <span key={b} className="badge bg-surface-2 capitalize text-ink-2">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-display text-xl font-semibold">Must-try food & drink</h3>
              <div className="card divide-y divide-line">
                {info.dishes.map((dish) => (
                  <div key={dish.name} className="px-5 py-3">
                    <div className="font-semibold">{dish.name}</div>
                    <p className="text-sm text-muted">{dish.description}</p>
                  </div>
                ))}
              </div>
              <h3 className="mb-3 mt-8 font-display text-xl font-semibold">Insider tips</h3>
              <ul className="space-y-2">
                {info.tips.map((t, i) => (
                  <li key={i} className="card flex gap-3 p-4 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-coral-100 text-xs font-bold text-coral-700 dark:bg-coral-700/30 dark:text-coral-200">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-display text-xl font-semibold">Phrasebook</h3>
              <Phrasebook phrases={info.phrases} countryCode={d.countryCode} language={info.languages[0]} />
              <h3 className="mb-3 mt-8 font-display text-xl font-semibold">Etiquette</h3>
              <ul className="card divide-y divide-line">
                {info.etiquette.map((e, i) => (
                  <li key={i} className="px-5 py-3 text-sm text-ink-2">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {d.wikiExtract && (
            <details className="card mt-8 p-5 text-sm">
              <summary className="cursor-pointer font-semibold">From Wikipedia</summary>
              <p className="mt-2 leading-relaxed text-muted">{d.wikiExtract}</p>
              <a href={d.wikiUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-brand-700 underline dark:text-brand-400">
                Read more on Wikipedia (CC BY-SA 4.0)
              </a>
            </details>
          )}
        </section>

        <section className="pt-16">
          <SectionHeader title="Travelers who like this also like" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {similar.map((s) => (
              <DestinationCard key={s.slug} d={s} size="sm" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
