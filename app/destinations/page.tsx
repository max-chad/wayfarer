import type { Metadata } from "next";
import Link from "next/link";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { EmptyState } from "@/components/ui/Section";
import { continents, listDestinations } from "@/lib/data/destinations";
import { cn, MONTHS, MONTHS_SHORT, VIBE_EMOJI, VIBES } from "@/lib/utils";

export const metadata: Metadata = { title: "Destinations", description: "Explore 32 destinations with AI-powered guides, climate charts and budgets." };

type SP = Promise<Record<string, string | undefined>>;

export default async function DestinationsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = sp.month ? Number(sp.month) : undefined;
  const filter = {
    continent: sp.continent,
    vibe: sp.vibe,
    month,
    budget: sp.budget as "budget" | "midrange" | "luxury" | undefined,
    sort: (sp.sort as "popular") || "popular",
  };
  const list = listDestinations(filter);
  const conts = continents();

  const href = (patch: Record<string, string | number | undefined>) => {
    const next = { ...sp, ...patch } as Record<string, string | number | undefined>;
    const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return `/destinations${q.toString() ? `?${q}` : ""}`;
  };

  return (
    <div className="container-page pt-10">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Where will you wander?</h1>
        <p className="mt-3 text-lg text-muted">
          {list.length} destination{list.length === 1 ? "" : "s"} with AI guides, live weather, climate charts, phrasebooks and budgets.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          <Link href={href({ continent: undefined })} className="chip" data-active={!sp.continent}>
            🌍 All continents
          </Link>
          {conts.map((c) => (
            <Link key={c.continent} href={href({ continent: c.continent })} className="chip" data-active={sp.continent === c.continent}>
              {c.continent} <span className="opacity-60">{c.n}</span>
            </Link>
          ))}
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {VIBES.map((v) => (
            <Link key={v} href={href({ vibe: sp.vibe === v ? undefined : v })} className="chip capitalize" data-active={sp.vibe === v}>
              {VIBE_EMOJI[v]} {v}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Best in</span>
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
            {MONTHS_SHORT.map((m, i) => (
              <Link key={m} href={href({ month: month === i + 1 ? undefined : i + 1 })} className={cn("chip px-2.5 py-1.5 text-xs")} data-active={month === i + 1}>
                {m}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {(["budget", "midrange", "luxury"] as const).map((b) => (
              <Link key={b} href={href({ budget: sp.budget === b ? undefined : b })} className="chip text-xs" data-active={sp.budget === b}>
                {b === "budget" ? "💸 Budget-friendly" : b === "midrange" ? "🧳 Mid-range" : "💎 Luxury"}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Sort:</span>
            {[
              ["popular", "Popular"],
              ["rating", "Top rated"],
              ["budget", "Cheapest"],
              ["warm", "Warmest"],
              ["name", "A–Z"],
            ].map(([k, l]) => (
              <Link key={k} href={href({ sort: k === "popular" ? undefined : k })} className="chip px-2.5 py-1.5 text-xs" data-active={(sp.sort || "popular") === k}>
                {l}
              </Link>
            ))}
          </div>
        </div>
        {(sp.continent || sp.vibe || month || sp.budget) && (
          <div className="text-sm text-muted">
            Showing destinations{sp.vibe ? ` for ${sp.vibe}` : ""}
            {sp.continent ? ` in ${sp.continent}` : ""}
            {month ? ` that are best in ${MONTHS[month - 1]}` : ""}
            {sp.budget ? ` (${sp.budget})` : ""}.{" "}
            <Link href="/destinations" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
              Clear filters
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8">
        {list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {list.map((d) => (
              <DestinationCard key={d.slug} d={d} />
            ))}
          </div>
        ) : (
          <EmptyState title="No destinations match those filters" action={<Link href="/destinations" className="btn btn-dark">Reset filters</Link>}>
            Try a different month or vibe — or ask the concierge for ideas.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
