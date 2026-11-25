import { Award, CalendarDays, Crown, Globe2, MapPin, MessageSquareText, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LazyMap, TYPE_COLORS } from "@/components/map/LazyMap";
import { ReviewCard } from "@/components/review/ReviewCard";
import { Avatar } from "@/components/ui/Avatar";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/data/billing";
import { userReviews } from "@/lib/data/reviews";
import { listTrips } from "@/lib/data/trips";
import { getUserByUsername, reviewedPlacesMap, userStats } from "@/lib/data/users";
import { cn, formatDate } from "@/lib/utils";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = getUserByUsername(username);
  return { title: u ? `${u.displayName} (@${u.username})` : "Traveler" };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const u = getUserByUsername(username);
  if (!u) notFound();
  const me = await getCurrentUser();
  const isMe = me?.id === u.id;
  const stats = userStats(u.id);
  const reviews = userReviews(u.id, 30);
  const map = reviewedPlacesMap(u.id);
  const trips = listTrips(u.id).filter((t) => t.isPublic || isMe);

  return (
    <div>
      <div className="border-b border-line bg-gradient-to-br from-brand-50 via-bg to-coral-50/40 dark:from-brand-950/40 dark:via-bg dark:to-coral-700/10">
        <div className="container-page flex flex-wrap items-center gap-6 py-10">
          <Avatar name={u.displayName} color={u.avatarColor} size={96} className="shadow-lift ring-4 ring-surface" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-3 font-display text-4xl font-semibold">
              {u.displayName}
              {getPlan(u.id) === "plus" && (
                <span className="badge bg-sun-300/40 font-sans text-xs text-ink" title="Wayfarer Plus member">
                  <Crown className="size-3.5" /> Plus
                </span>
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span>@{u.username}</span>
              {u.homeCity && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {u.homeCity}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Joined {formatDate(u.createdAt, { month: "long", year: "numeric" })}
              </span>
            </div>
            {u.bio && <p className="mt-2 max-w-xl text-ink-2">{u.bio}</p>}
          </div>
          <div className="card w-full max-w-xs p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Level {stats.level} contributor</span>
              <span className="text-sm text-muted">{stats.points.toLocaleString("en-US")} pts</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="ai-gradient h-full rounded-full" style={{ width: `${Math.round(stats.progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted">{stats.nextLevelAt ? `${(stats.nextLevelAt - stats.points).toLocaleString("en-US")} pts to level ${stats.level + 1}` : "Max level reached 🏆"}</div>
            {isMe && (
              <Link href="/account" className="btn btn-outline btn-sm mt-3 w-full">
                Edit profile
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container-page mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [MessageSquareText, stats.reviews, "Reviews"],
              [ThumbsUp, stats.helpful, "Helpful votes"],
              [MapPin, stats.cities, "Cities"],
              [Globe2, stats.countries, "Countries"],
            ].map(([Icon, n, l]) => {
              const I = Icon as typeof MapPin;
              return (
                <div key={l as string} className="card p-4">
                  <I className="size-5 text-brand-600" />
                  <div className="mt-2 font-display text-2xl font-semibold">{(n as number).toLocaleString("en-US")}</div>
                  <div className="text-xs text-muted">{l as string}</div>
                </div>
              );
            })}
          </div>

          {map.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-2xl font-semibold">Travel map</h2>
              <LazyMap
                className="h-80"
                markers={map.map((m, i) => ({ id: i, lat: m.lat, lng: m.lng, title: m.name, subtitle: `${m.destination} · ★ ${m.rating}`, href: `/place/${m.slug}`, color: TYPE_COLORS[m.type], label: m.rating }))}
              />
            </div>
          )}

          <h2 className="mb-2 mt-10 font-display text-2xl font-semibold">Reviews</h2>
          {reviews.length ? (
            <div className="card px-5">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} showPlace />
              ))}
            </div>
          ) : (
            <p className="text-muted">{isMe ? "You haven't written any reviews yet." : "No reviews yet."}</p>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Award className="size-4 text-sun-500" /> Badges
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {stats.badges.map((b) => (
                <div key={b.id} className={cn("flex flex-col items-center rounded-xl p-2 text-center", b.earned ? "bg-surface-2" : "opacity-35 grayscale")} title={b.description}>
                  <span className="text-2xl">{b.emoji}</span>
                  <span className="mt-1 text-[11px] font-semibold leading-tight">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
          {trips.length > 0 && (
            <div className="card p-4">
              <h2 className="px-1 font-semibold">{isMe ? "My trips" : "Shared trips"}</h2>
              <div className="mt-3 space-y-2">
                {trips.map((t) => (
                  <Link key={t.id} href={isMe ? `/trips/${t.id}` : `/trips/share/${t.shareToken}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                    <SmartImage image={t.destination?.image} alt="" width={330} className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      <div className="text-xs text-muted">
                        {t.destination?.name} · {t.days} days
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
