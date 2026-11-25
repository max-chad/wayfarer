import { SearchX, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { AskButton } from "@/components/home/HeroPrompts";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { SponsoredCard } from "@/components/commerce/SponsoredCard";
import { ListingResults } from "@/components/listing/ListingResults";
import { AiBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/Section";
import { interpretQuery } from "@/lib/ai/features";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/data/billing";
import { pickSponsored } from "@/lib/data/business";
import { getDestination, listDestinations } from "@/lib/data/destinations";
import { listPlaces } from "@/lib/data/places";
import type { PlaceType } from "@/lib/types";
import { TYPE_LABELS, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

type SP = Promise<{ q?: string; type?: string; exact?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim().slice(0, 200);
  if (!q) {
    return (
      <div className="container-page max-w-3xl pt-16">
        <h1 className="font-display text-4xl font-semibold">Search Wayfarer</h1>
        <p className="mt-2 text-muted">Search in plain English — our AI understands vibes, budgets, dietary needs and neighbourhoods.</p>
        <div className="mt-6">
          <HeaderSearch large autoFocus />
        </div>
      </div>
    );
  }

  const parsed = sp.exact ? null : await interpretQuery(q);
  const typeOverride = sp.type as PlaceType | undefined;
  const dest = parsed?.destinationSlug ? getDestination(parsed.destinationSlug) : null;

  // special keyword shortcuts
  const award = /travel?ers.?choice/i.test(q) ? "travelers-choice" : /hidden gems?/i.test(q) ? "hidden-gem" : undefined;

  const run = (opts: { withTags?: boolean; withKeywords?: boolean; withPrice?: boolean }) =>
    listPlaces({
      destinationId: dest?.id,
      type: typeOverride || parsed?.type,
      tags: opts.withTags ? parsed?.tags.filter((t) => t !== "iconic") : undefined,
      priceLevels: opts.withPrice ? parsed?.priceLevels : undefined,
      minRating: parsed?.minRating,
      q: sp.exact ? q : opts.withKeywords ? parsed?.keywords : undefined,
      category: parsed?.category && /^[A-Z]/.test(parsed.category) ? parsed.category : undefined,
      award: award,
      sort: "rating",
      limit: 40,
    });

  let result = run({ withTags: true, withKeywords: true, withPrice: true });
  let relaxed: string | null = null;
  if (!result.total && parsed?.keywords) {
    result = run({ withTags: true, withKeywords: false, withPrice: true });
    relaxed = "keywords";
  }
  if (!result.total && parsed?.tags.length) {
    result = run({ withTags: false, withKeywords: false, withPrice: true });
    relaxed = "vibe tags";
  }
  if (!result.total && parsed?.priceLevels) {
    result = run({ withTags: false, withKeywords: false, withPrice: false });
    relaxed = "price";
  }
  if (!result.total) result = listPlaces({ q, sort: "rating", limit: 40 });

  const destMatches = listDestinations({ q }).slice(0, 4);
  const types: PlaceType[] = ["attraction", "hotel", "restaurant", "experience"];
  const counts = Object.fromEntries(types.map((t) => [t, result.items.filter((i) => i.type === t).length]));
  const shown = typeOverride ? result.items.filter((i) => i.type === typeOverride) : result.items;

  const user = await getCurrentUser();
  const sponsored =
    dest && shown.length && !(user && getPlan(user.id) === "plus")
      ? pickSponsored({ destinationId: dest.id, type: typeOverride || parsed?.type || undefined, excludePlaceIds: shown.slice(0, 3).map((i) => i.id), limit: 1 })
      : [];
  const hrefType = (t?: PlaceType) => `/search?q=${encodeURIComponent(q)}${t ? `&type=${t}` : ""}`;

  return (
    <div className="container-page pt-8">
      <div className="max-w-3xl">
        <HeaderSearch large placeholder={q} />
      </div>

      {parsed && (
        <div className="ai-border mt-6 flex flex-wrap items-center gap-3 p-4">
          <Sparkles className="size-5 text-coral-500" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">AI understood your search as</div>
            <div className="font-semibold">{parsed.interpretation || q}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dest && <span className="badge bg-surface-2 text-ink-2">📍 {dest.name}</span>}
              {parsed.type && <span className="badge bg-surface-2 text-ink-2">{TYPE_LABELS[parsed.type].plural}</span>}
              {parsed.tags.map((t) => (
                <span key={t} className="badge bg-surface-2 text-ink-2">
                  #{titleCase(t)}
                </span>
              ))}
              {parsed.priceLevels && <span className="badge bg-surface-2 text-ink-2">{parsed.priceLevels.map((l) => "$".repeat(l)).join(" / ")}</span>}
              {parsed.minRating && <span className="badge bg-surface-2 text-ink-2">★ {parsed.minRating}+</span>}
              {parsed.keywords && <span className="badge bg-surface-2 text-ink-2">“{parsed.keywords}”</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AiBadge provider={parsed.provider} />
            <Link href={`/search?q=${encodeURIComponent(q)}&exact=1`} className="text-xs text-muted underline">
              Search exact words
            </Link>
          </div>
        </div>
      )}

      {relaxed && (
        <p className="mt-3 text-sm text-muted">
          No exact matches, so we relaxed the <strong>{relaxed}</strong> filter to show the closest results.
        </p>
      )}

      {destMatches.length > 0 && !dest && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold">Destinations</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {destMatches.map((d) => (
              <DestinationCard key={d.slug} d={d} size="sm" />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Link href={hrefType()} className="chip" data-active={!typeOverride}>
          All ({result.items.length})
        </Link>
        {types.map((t) => (
          <Link key={t} href={hrefType(t)} className="chip" data-active={typeOverride === t}>
            {TYPE_LABELS[t].plural} ({counts[t]})
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {sponsored.map((s) => (
          <div key={s.campaignId} className="mb-3">
            <SponsoredCard token={s.token} place={s.place} />
          </div>
        ))}
        {shown.length ? (
          <ListingResults items={shown} />
        ) : (
          <EmptyState icon={<SearchX className="size-6" />} title={`No results for “${q}”`} action={<AskButton prompt={q} className="btn btn-primary">Ask the concierge instead</AskButton>}>
            Try fewer words, a different city, or let the concierge help.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
