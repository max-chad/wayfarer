import { BadgeCheck, Building2, Clock, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/SmartImage";
import { RatingPill } from "@/components/ui/Stars";
import { getCurrentUser } from "@/lib/auth";
import { businessesForUser, placeAnalytics, responseStats } from "@/lib/data/business";
import { BUSINESS_TIERS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Business dashboard" };

export default async function BusinessDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/business/dashboard");
  const listings = businessesForUser(user.id);
  return (
    <div className="container-page max-w-5xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
            <Building2 className="size-4" /> Wayfarer for Business
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold">Your listings</h1>
        </div>
        <Link href="/business/claim" className="btn btn-dark">
          <Plus className="size-4" /> Claim a listing
        </Link>
      </div>
      {listings.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Building2 className="size-6" />} title="No listings yet" action={<Link href="/business/claim" className="btn btn-primary">Claim your business</Link>}>
            Own a hotel, restaurant or tour? Claim it to reply to reviews and see how travelers find you.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {listings.map((l) => {
            const a = placeAnalytics(l.id, 30);
            const views = a.totals.find((t) => t.key === "views")!;
            const rs = responseStats(l.id);
            const tier = BUSINESS_TIERS.find((t) => t.id === l.tier)!;
            return (
              <Link key={l.businessId} href={`/business/${l.businessId}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
                <div className="flex gap-4 p-4">
                  <SmartImage image={l.image} alt={l.name} width={330} className="size-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("badge", l.status === "verified" ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-sun-300/30 text-ink")}>
                        {l.status === "verified" ? <BadgeCheck className="size-3" /> : <Clock className="size-3" />}
                        {l.status === "verified" ? "Verified" : "Pending verification"}
                      </span>
                      <span className="badge bg-surface-3 text-ink-2">{tier.name}</span>
                    </div>
                    <div className="mt-1 truncate font-display text-xl font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-400">{l.name}</div>
                    <div className="truncate text-xs text-muted">
                      {l.category} · {l.destinationName}
                    </div>
                    <RatingPill value={l.rating} count={l.reviewCount} className="mt-1" />
                  </div>
                </div>
                <div className="mt-auto grid grid-cols-3 border-t border-line text-center text-sm">
                  <div className="p-3">
                    <div className="font-semibold">{views.value.toLocaleString("en-US")}</div>
                    <div className="text-[11px] text-muted">views · 30d</div>
                  </div>
                  <div className="border-x border-line p-3">
                    <div className="font-semibold">{l.ranking ? `#${l.ranking}` : "—"}</div>
                    <div className="text-[11px] text-muted">of {l.rankingTotal}</div>
                  </div>
                  <div className="p-3">
                    <div className="font-semibold">{rs.total ? Math.round((rs.answered / rs.total) * 100) : 0}%</div>
                    <div className="text-[11px] text-muted">reviews answered</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
