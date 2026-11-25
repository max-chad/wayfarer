import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingFilters, SortSelect } from "@/components/listing/ListingFilters";
import { SponsoredCard } from "@/components/commerce/SponsoredCard";
import { ListingResults } from "@/components/listing/ListingResults";
import { EmptyState } from "@/components/ui/Section";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/data/billing";
import { pickSponsored } from "@/lib/data/business";
import { getDestination } from "@/lib/data/destinations";
import { listPlaces, placeFacets } from "@/lib/data/places";
import { ROUTE_TO_TYPE, TYPE_LABELS } from "@/lib/utils";

type Props = { params: Promise<{ slug: string; category: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, category } = await params;
  const d = getDestination(slug);
  const type = ROUTE_TO_TYPE[category];
  if (!d || !type) return { title: "Not found" };
  return { title: `${TYPE_LABELS[type].plural} in ${d.name}` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug, category } = await params;
  const sp = await searchParams;
  const d = getDestination(slug);
  const type = ROUTE_TO_TYPE[category];
  if (!d || !type) notFound();
  const facets = placeFacets(d.id, type);
  const list = (k: string) => sp[k]?.split(",").filter(Boolean);
  const sort = (sp.sort as "ranking") || "ranking";
  const { items, total } = listPlaces({
    destinationId: d.id,
    type,
    minRating: sp.rating ? Number(sp.rating) : undefined,
    priceLevels: list("price")?.map(Number),
    tags: list("tags"),
    amenities: list("amenities"),
    category: sp.category,
    sort,
  });
  const label = TYPE_LABELS[type];
  // Plus members don't see sponsored listings; organic ranking is never affected either way.
  const user = await getCurrentUser();
  const sponsored = user && getPlan(user.id) === "plus" ? [] : pickSponsored({ destinationId: d.id, type, excludePlaceIds: items.slice(0, 3).map((i) => i.id), limit: 1 });

  return (
    <div className="container-page pt-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/destinations" className="hover:underline">
          Destinations
        </Link>{" "}
        /{" "}
        <Link href={`/destinations/${d.slug}`} className="hover:underline">
          {d.name}
        </Link>{" "}
        / <span className="text-ink">{label.plural}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {label.plural} in {d.name}
          </h1>
          <p className="mt-1 text-muted">
            {items.length === total ? total : `${items.length} of ${total}`} {label.plural.toLowerCase()} · ranked with a Bayesian score so a few glowing reviews can&apos;t game the list
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["attraction", "hotel", "restaurant", "experience"] as const)
            .filter((t) => t !== type)
            .map((t) => (
              <Link key={t} href={`/destinations/${d.slug}/${TYPE_LABELS[t].route}`} className="chip hidden text-xs md:inline-flex">
                {TYPE_LABELS[t].plural}
              </Link>
            ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <Suspense>
          <ListingFilters
            tags={facets.tags}
            amenities={facets.amenities}
            categories={facets.categories}
            showAmenities={type === "hotel"}
            destinationName={d.name}
            typeLabel={label.plural}
          />
        </Suspense>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{items.length} results</span>
            <Suspense>
              <SortSelect value={sort} />
            </Suspense>
          </div>
          {sponsored.map((s) => (
            <div key={s.campaignId} className="mb-3">
              <SponsoredCard token={s.token} place={s.place} />
            </div>
          ))}
          {items.length ? (
            <ListingResults items={items} />
          ) : (
            <EmptyState title="Nothing matches those filters" action={<Link href={`/destinations/${d.slug}/${category}`} className="btn btn-dark">Clear filters</Link>}>
              Loosen a filter or two — or ask the concierge for a recommendation.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
