import { GitCompareArrows } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CompareVerdict } from "@/components/compare/CompareVerdict";
import { AwardList, PriceLevel } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/SmartImage";
import { Stars } from "@/components/ui/Stars";
import { getPlaceById } from "@/lib/data/places";
import { formatDuration, formatUsd, TYPE_LABELS } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare places" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const places = (ids || "")
    .split(",")
    .map(Number)
    .filter(Boolean)
    .slice(0, 4)
    .map((id) => getPlaceById(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getPlaceById>>[];

  if (places.length < 2) {
    return (
      <div className="container-page max-w-2xl pt-16">
        <EmptyState icon={<GitCompareArrows className="size-6" />} title="Pick at least two places to compare" action={<Link href="/destinations" className="btn btn-dark">Browse places</Link>}>
          Tap <strong>Compare</strong> on any hotel, restaurant or attraction page — then come back here for a side-by-side view with an AI verdict.
        </EmptyState>
      </div>
    );
  }

  const aspectKeys = [...new Set(places.flatMap((p) => Object.keys(p.aspectScores)))];
  const allAmenities = [...new Set(places.flatMap((p) => p.amenities))];
  const best = (vals: number[], high = true) => (high ? Math.max(...vals) : Math.min(...vals));
  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: "Rating", cells: places.map((p) => <span key={p.id} className={p.rating === best(places.map((x) => x.rating)) ? "font-semibold text-brand-600" : ""}>★ {p.rating.toFixed(1)} ({p.reviewCount})</span>) },
    { label: "Ranking", cells: places.map((p) => `#${p.ranking} of ${p.rankingTotal} in ${p.destinationName}`) },
    {
      label: "Price",
      cells: places.map((p) =>
        p.type === "hotel" ? `${formatUsd(p.priceUsd)}/night` : p.type === "restaurant" ? <PriceLevel key={p.id} level={p.priceLevel} /> : p.priceUsd ? formatUsd(p.priceUsd) : "Free"
      ),
    },
    { label: "Type", cells: places.map((p) => `${TYPE_LABELS[p.type].singular} · ${p.category}`) },
    { label: "Area", cells: places.map((p) => p.neighborhood || p.destinationName) },
    ...(places.some((p) => p.details.durationMin) ? [{ label: "Time needed", cells: places.map((p) => (p.details.durationMin ? formatDuration(p.details.durationMin) : "—")) }] : []),
    ...aspectKeys.map((k) => ({
      label: k,
      cells: places.map((p) => {
        const v = p.aspectScores[k];
        if (v == null) return "—";
        const top = v === best(places.map((x) => x.aspectScores[k] ?? 0));
        return (
          <div key={p.id} className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
              <div className={top ? "h-full bg-brand-500" : "h-full bg-line-strong"} style={{ width: `${(v / 5) * 100}%` }} />
            </div>
            <span className={top ? "font-semibold text-brand-600" : ""}>{v.toFixed(1)}</span>
          </div>
        );
      }),
    })),
    ...(allAmenities.length
      ? [{ label: "Amenities", cells: places.map((p) => <div key={p.id} className="flex flex-wrap gap-1">{allAmenities.map((a) => <span key={a} className={`badge ${p.amenities.includes(a) ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-surface-2 text-muted line-through opacity-60"}`}>{a}</span>)}</div>) }]
      : []),
    { label: "Good for", cells: places.map((p) => p.tags.slice(0, 5).join(", ")) },
  ];

  return (
    <div className="container-page pt-10">
      <h1 className="font-display text-4xl font-semibold">Side-by-side comparison</h1>
      <p className="mt-1 text-muted">Best value in each row is highlighted.</p>
      <div className="mt-6">
        <CompareVerdict ids={places.map((p) => p.id)} names={Object.fromEntries(places.map((p) => [p.id, p.name]))} />
      </div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="w-40" />
              {places.map((p) => (
                <th key={p.id} className="px-3 pb-4 text-left align-top font-normal">
                  <Link href={`/place/${p.slug}`} className="group block">
                    <SmartImage image={p.image} alt={p.name} width={500} className="aspect-[4/3] rounded-xl" />
                    <div className="mt-2 font-display text-lg font-semibold group-hover:text-brand-700">{p.name}</div>
                  </Link>
                  <Stars value={p.rating} />
                  <div className="mt-1">
                    <AwardList awards={p.awards} max={1} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="border-t border-line py-3 pr-3 align-top font-semibold text-muted">{r.label}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="border-t border-line px-3 py-3 align-top">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
