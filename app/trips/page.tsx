import { CalendarDays, Globe2, Lock, Map, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewTripButton, PendingPlanImporter } from "@/components/trips/TripListClient";
import { EmptyState } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { allDestinationNames } from "@/lib/data/destinations";
import { listTrips } from "@/lib/data/trips";
import { formatDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/trips");
  const trips = listTrips(user.id);
  const dests = allDestinationNames().map((d) => ({ slug: d.slug, name: d.name }));
  return (
    <div className="container-page pt-10">
      <PendingPlanImporter />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">My trips</h1>
          <p className="mt-1 text-muted">Plan, reorder, share and export your itineraries.</p>
        </div>
        <div className="flex gap-2">
          <NewTripButton destinations={dests} />
          <Link href="/plan" className="btn btn-primary">
            <Sparkles className="size-4" /> Plan with AI
          </Link>
        </div>
      </div>

      <div className="mt-8">
        {trips.length === 0 ? (
          <EmptyState icon={<Map className="size-6" />} title="No trips yet" action={<Link href="/plan" className="btn btn-primary">Plan your first trip</Link>}>
            Generate a full itinerary with the AI planner, or add places to a trip from any listing.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="card group overflow-hidden transition-shadow hover:shadow-lift">
                <SmartImage image={t.destination?.image} alt={t.destination?.name || t.title} width={500} className="h-44" imgClassName="transition-transform duration-500 group-hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-3 top-3">
                    <span className="badge bg-white/90 text-ink backdrop-blur dark:bg-black/60 dark:text-white">
                      {t.isPublic ? <Globe2 className="size-3" /> : <Lock className="size-3" />} {t.isPublic ? "Shared" : "Private"}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="text-xs text-white/80">{t.destination?.name || "No destination"}</div>
                    <div className="truncate font-display text-xl font-semibold">{t.title}</div>
                  </div>
                </SmartImage>
                <div className="flex items-center justify-between p-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted">
                    <CalendarDays className="size-4" />
                    {t.startDate ? formatDate(t.startDate, { month: "short", day: "numeric", year: "numeric" }) : "Dates TBD"} · {t.days} days
                  </span>
                  <span className="text-xs text-muted">
                    {t.itemCount} stops · edited {timeAgo(t.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
            <Link href="/plan" className="grid min-h-60 place-items-center rounded-2xl border-2 border-dashed border-line-strong text-muted transition-colors hover:border-brand-400 hover:text-brand-700">
              <span className="flex flex-col items-center gap-2 text-sm font-semibold">
                <Plus className="size-6" /> New AI itinerary
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
