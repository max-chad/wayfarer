import { Accessibility, BadgeCheck, BookOpenText, Building2, CalendarClock, Clock, Megaphone, MapPin, ShieldCheck, Sparkles, Star, Tag, Ticket, Utensils } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/commerce/BookingWidget";
import { HotelOffers } from "@/components/commerce/HotelOffers";
import { TrackView } from "@/components/home/RecentlyViewed";
import { LazyMap, TYPE_COLORS } from "@/components/map/LazyMap";
import { AiSummary } from "@/components/place/AiSummary";
import { PlaceActions } from "@/components/place/PlaceActions";
import { PlaceCard } from "@/components/place/PlaceCard";
import { PriceCalendar } from "@/components/place/PriceCalendar";
import { QASection } from "@/components/place/QASection";
import { RatingBarButton, ReviewList } from "@/components/place/ReviewList";
import { AwardList, PriceLevel } from "@/components/ui/Badges";
import { Gallery } from "@/components/ui/Gallery";
import { SectionHeader } from "@/components/ui/Section";
import { Stars } from "@/components/ui/Stars";
import { getCurrentUser } from "@/lib/auth";
import { publicBusinessInfo } from "@/lib/data/business";
import { bookingKindFor, trackPlaceView } from "@/lib/data/commerce";
import { getDestinationById } from "@/lib/data/destinations";
import { listQuestions } from "@/lib/data/misc";
import { getPlace, nearbyPlaces, similarPlaces } from "@/lib/data/places";
import { reviewStats } from "@/lib/data/reviews";
import { listTrips } from "@/lib/data/trips";
import { formatDuration, formatUsd, imgUrl, ratingLabel, titleCase, TYPE_LABELS } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPlace(slug);
  if (!p) return { title: "Place not found" };
  return { title: `${p.name}, ${p.destinationName}`, description: `${p.name}: rated ${p.rating}/5 from ${p.reviewCount} reviews. ${p.description.slice(0, 140)}` };
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params;
  const p = getPlace(slug);
  if (!p) notFound();
  const dest = getDestinationById(p.destinationId)!;
  const stats = reviewStats(p.id);
  const questions = listQuestions(p.id);
  const nearAttractions = nearbyPlaces(p, { type: "attraction", limit: 4 });
  const nearFood = nearbyPlaces(p, { type: "restaurant", limit: 4 });
  const nearStays = p.type !== "hotel" ? nearbyPlaces(p, { type: "hotel", limit: 3 }) : [];
  const similar = similarPlaces(p, 4);
  const d = p.details;
  const label = TYPE_LABELS[p.type];
  const gallery = p.gallery.length ? p.gallery : p.image ? [p.image] : [];
  trackPlaceView(p.id);
  const owner = publicBusinessInfo(p.id);
  const bookingKind = bookingKindFor(p);
  const user = await getCurrentUser();
  const trips = user && bookingKind
    ? listTrips(user.id)
        .filter((t) => t.destinationId === p.destinationId)
        .map((t) => ({ id: t.id, title: t.title, startDate: t.startDate, days: t.days }))
    : [];

  const details: { icon: typeof Clock; label: string; value: React.ReactNode }[] = [];
  if (d.hours) details.push({ icon: Clock, label: "Hours", value: d.hours });
  if (d.durationMin) details.push({ icon: CalendarClock, label: "Suggested duration", value: formatDuration(d.durationMin) });
  if (d.bestTime && d.bestTime !== "any") details.push({ icon: Star, label: "Best time", value: titleCase(d.bestTime) });
  if (p.type === "attraction" || p.type === "experience") details.push({ icon: Ticket, label: "Price", value: p.priceUsd ? `from ${formatUsd(p.priceUsd)} per adult` : "Free" });
  if (d.signatureDish) details.push({ icon: Utensils, label: "Signature dish", value: d.signatureDish });
  if (d.meals?.length) details.push({ icon: Utensils, label: "Meals", value: d.meals.map(titleCase).join(", ") });
  if (d.dietary?.length) details.push({ icon: Tag, label: "Dietary", value: d.dietary.map(titleCase).join(", ") });
  if (d.accessibility) details.push({ icon: Accessibility, label: "Accessibility", value: titleCase(d.accessibility) });

  const mapMarkers = [
    { id: p.id, lat: p.lat, lng: p.lng, title: p.name, subtitle: p.category, color: TYPE_COLORS[p.type], label: "●" },
    ...[...nearAttractions, ...nearFood].slice(0, 8).map((n) => ({
      id: n.id,
      lat: n.lat,
      lng: n.lng,
      title: n.name,
      subtitle: `${n.category} · ${n.distanceKm! < 1 ? `${Math.round(n.distanceKm! * 1000)} m` : `${n.distanceKm!.toFixed(1)} km`}`,
      href: `/place/${n.slug}`,
      color: TYPE_COLORS[n.type],
      label: n.type === "restaurant" ? "R" : "★",
      image: n.image ? imgUrl(n.image, 330) : null,
    })),
  ];

  return (
    <div className="container-page pt-6">
      <TrackView item={{ slug: p.slug, name: p.name, kind: "place", image: p.image ? imgUrl(p.image, 330) : null, subtitle: `${p.category} · ${p.destinationName}` }} />
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/destinations" className="hover:underline">
          Destinations
        </Link>{" "}
        /{" "}
        <Link href={`/destinations/${p.destinationSlug}`} className="hover:underline">
          {p.destinationName}
        </Link>{" "}
        /{" "}
        <Link href={`/destinations/${p.destinationSlug}/${label.route}`} className="hover:underline">
          {label.plural}
        </Link>{" "}
        / <span className="text-ink">{p.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <AwardList awards={p.awards} max={3} />
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-sm font-bold text-white">{p.rating.toFixed(1)}</span>
              <Stars value={p.rating} size={16} />
              <a href="#reviews" className="font-medium underline-offset-2 hover:underline">
                {p.reviewCount} reviews
              </a>
            </span>
            <span className="text-muted">·</span>
            <span className="font-semibold">{ratingLabel(p.rating)}</span>
            {p.ranking > 0 && (
              <>
                <span className="text-muted">·</span>
                <Link href={`/destinations/${p.destinationSlug}/${label.route}`} className="hover:underline">
                  #{p.ranking} of {p.rankingTotal} {label.plural.toLowerCase()} in {p.destinationName}
                </Link>
              </>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {owner && (
              <span className="inline-flex items-center gap-1 font-medium text-brand-700 dark:text-brand-400" title="The owner has claimed and verified this listing">
                <BadgeCheck className="size-4" /> Verified owner
              </span>
            )}
            <span>{p.category}</span>
            {d.stars ? <span>{"★".repeat(d.stars)} hotel</span> : null}
            {p.type === "restaurant" && <PriceLevel level={p.priceLevel} />}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {p.neighborhood ? `${p.neighborhood}, ` : ""}
              {p.destinationName}, {p.country}
            </span>
          </div>
        </div>
      </div>

      {owner?.announcement && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-coral-500" />
          <div>
            <span className="font-semibold">From the owner:</span> {owner.announcement}
          </div>
        </div>
      )}

      <div className="mt-4">
        <PlaceActions place={{ id: p.id, slug: p.slug, name: p.name, type: p.type, image: p.image ? imgUrl(p.image, 330) : null, destinationSlug: p.destinationSlug, destinationName: p.destinationName }} />
      </div>

      <Gallery images={gallery} alt={p.name} className="mt-6 h-[280px] sm:h-[420px]" />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-12">
          {/* about */}
          <section>
            <h2 className="font-display text-2xl font-semibold">About</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{p.description}</p>
            {d.highlights?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {d.highlights.map((h) => (
                  <span key={h} className="badge bg-brand-50 px-3 py-1.5 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                    ✦ {h}
                  </span>
                ))}
              </div>
            ) : null}
            {details.length > 0 && (
              <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {details.map((x) => (
                  <div key={x.label} className="flex gap-3">
                    <x.icon className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{x.label}</dt>
                      <dd className="text-sm">{x.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
            {d.bookingTip && (
              <div className="mt-6 flex gap-3 rounded-2xl bg-sun-300/20 p-4 text-sm dark:bg-sun-500/10">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-sun-500" />
                <div>
                  <strong>Insider tip:</strong> {d.bookingTip}
                </div>
              </div>
            )}
            {d.includes?.length ? (
              <div className="mt-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">What&apos;s included</div>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {d.includes.map((i) => (
                    <li key={i} className="text-sm">
                      ✓ {i}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {p.amenities.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Amenities</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {p.amenities.map((a) => (
                    <span key={a} className="rounded-xl border border-line px-3 py-2 text-sm">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {p.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(`${t.replace(/-/g, " ")} ${label.plural.toLowerCase()} in ${p.destinationName}`)}`} className="chip text-xs capitalize">
                    #{t.replace(/-/g, " ")}
                  </Link>
                ))}
              </div>
            )}
            {p.wikiExtract && (
              <details className="card mt-6 p-4 text-sm">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                  <BookOpenText className="size-4" /> Background from Wikipedia
                </summary>
                <p className="mt-2 leading-relaxed text-muted">{p.wikiExtract}</p>
                <a href={p.wikiUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-700 underline dark:text-brand-400">
                  Wikipedia · CC BY-SA 4.0
                </a>
              </details>
            )}
          </section>

          {/* AI summary */}
          {p.reviewCount > 0 && (
            <section>
              <AiSummary placeId={p.id} reviewCount={p.reviewCount} />
            </section>
          )}

          {/* ratings + reviews */}
          <section id="reviews" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Reviews</h2>
              <Link href={`/place/${p.slug}/review`} className="btn btn-dark btn-sm">
                Write a review
              </Link>
            </div>
            <div className="card mt-4 grid gap-6 p-5 sm:grid-cols-[180px_1fr_1fr]">
              <div className="text-center sm:text-left">
                <div className="font-display text-5xl font-semibold">{p.rating.toFixed(1)}</div>
                <div className="font-semibold">{ratingLabel(p.rating)}</div>
                <Stars value={p.rating} size={16} className="mt-1" />
                <div className="mt-1 text-xs text-muted">{stats.total} reviews</div>
              </div>
              <div className="space-y-1.5">
                {stats.distribution.map((x) => (
                  <RatingBarButton key={x.rating} rating={x.rating} n={x.n} total={stats.total} />
                ))}
              </div>
              <div className="space-y-2">
                {Object.entries(p.aspectScores).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="w-24 truncate text-muted">{k}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${(v / 5) * 100}%` }} />
                    </div>
                    <span className="w-7 text-right font-semibold">{v.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="size-4 text-brand-600" />
              Every review is scored by our AI authenticity model (avg trust {stats.trustAvg}/100).
              {stats.flagged > 0 && ` ${stats.flagged} suspicious review${stats.flagged > 1 ? "s were" : " was"} held for moderation and excluded from the rating.`}
            </div>
            <div className="mt-6">
              <ReviewList placeId={p.id} distribution={stats.distribution} tripTypes={stats.tripTypes} hasForeign={stats.languages.some((l) => l.language !== "en")} />
            </div>
          </section>

          {/* Q&A */}
          <section id="questions" className="scroll-mt-24">
            <h2 className="mb-4 font-display text-2xl font-semibold">Questions & answers</h2>
            <QASection placeId={p.id} placeType={p.type} initial={questions} />
          </section>
        </div>

        {/* sidebar */}
        <aside className="min-w-0 space-y-6">
          <div className="card p-5">
            {p.type === "hotel" ? (
              <>
                <HotelOffers placeId={p.id} placeName={p.name} />
                <div className="mt-5 border-t border-line pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Typical nightly rate by month · from {formatUsd(p.priceUsd)}</div>
                  <PriceCalendar base={p.priceUsd} bestMonths={dest.info.bestMonths} avoidMonths={dest.info.avoidMonths || []} eventMonths={(dest.info.events || []).map((e) => e.month)} />
                </div>
              </>
            ) : bookingKind ? (
              <>
                <BookingWidget place={{ id: p.id, name: p.name, priceUsd: p.priceUsd }} kind={bookingKind} trips={trips} />
                {d.durationMin && bookingKind !== "table" ? <div className="mt-2 text-xs text-muted">Plan for about {formatDuration(d.durationMin)}</div> : null}
              </>
            ) : (
              <>
                <div className="text-sm text-muted">Entry</div>
                <div className="font-display text-3xl font-semibold">Free</div>
                {d.durationMin ? <div className="mt-1 text-sm text-muted">Plan for about {formatDuration(d.durationMin)}</div> : null}
              </>
            )}
            <div className="mt-5 grid gap-2">
              <Link href={`/plan?destination=${p.destinationSlug}&mustSee=${p.id}`} className="btn btn-primary w-full">
                <Sparkles className="size-4" /> Build a trip around this
              </Link>
              <Link href={`/destinations/${p.destinationSlug}`} className="btn btn-outline w-full">
                Explore {p.destinationName}
              </Link>
            </div>
          </div>

          <div className="card overflow-hidden">
            <LazyMap markers={mapMarkers} className="h-64 rounded-none border-0" zoom={15} />
            <div className="p-4">
              <div className="text-sm font-semibold">Location</div>
              <div className="text-sm text-muted">
                {p.neighborhood ? `${p.neighborhood}, ` : ""}
                {p.destinationName}
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                Open in OpenStreetMap ↗
              </a>
              {owner?.phone && <div className="mt-1 text-xs text-muted">☎ {owner.phone}</div>}
              {owner?.website && (
                <a href={owner.website} target="_blank" rel="nofollow noopener noreferrer" className="ml-3 mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
                  Official website ↗
                </a>
              )}
            </div>
          </div>

          {!owner && p.type !== "attraction" && (
            <Link href={`/business/claim?place=${p.id}`} className="card flex items-start gap-3 p-4 text-sm hover:border-line-strong">
              <Building2 className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <div className="font-semibold">Own or manage {p.name}?</div>
                <div className="text-muted">Claim this free listing to reply to reviews, update your details and see how travelers find you.</div>
              </div>
            </Link>
          )}

          {[
            ["Nearby sights", nearAttractions],
            ["Nearby restaurants", nearFood],
            ["Places to stay nearby", nearStays],
          ].map(([title, list]) =>
            (list as typeof nearFood).length ? (
              <div key={title as string} className="card p-3">
                <div className="px-2 pb-1 pt-1 text-sm font-semibold">{title as string}</div>
                {(list as typeof nearFood).map((n) => (
                  <PlaceCard key={n.id} place={n} layout="compact" />
                ))}
              </div>
            ) : null
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <SectionHeader title={`Similar ${label.plural.toLowerCase()} in ${p.destinationName}`} href={`/destinations/${p.destinationSlug}/${label.route}`} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {similar.map((s) => (
              <PlaceCard key={s.id} place={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
