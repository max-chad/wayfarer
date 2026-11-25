import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import type { DestinationSummary } from "@/lib/types";
import { cn, formatUsd, MONTHS_SHORT, VIBE_EMOJI } from "@/lib/utils";

export function DestinationCard({
  d,
  size = "md",
  extra,
  className = "",
}: {
  d: DestinationSummary;
  size?: "sm" | "md" | "lg";
  extra?: React.ReactNode;
  className?: string;
}) {
  const h = size === "lg" ? "aspect-[4/5] sm:aspect-[3/4]" : size === "sm" ? "aspect-[4/3]" : "aspect-[4/5]";
  return (
    <Link href={`/destinations/${d.slug}`} className={cn("group relative block overflow-hidden rounded-2xl", className)}>
      <SmartImage image={d.image} alt={d.name} width={size === "sm" ? 500 : 960} className={cn(h, "rounded-2xl")} imgClassName="transition-transform duration-700 group-hover:scale-[1.05]">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="text-xs font-medium uppercase tracking-wider text-white/75">{d.country}</div>
          <div className={cn("font-display font-semibold leading-tight", size === "lg" ? "text-3xl" : "text-2xl")}>{d.name}</div>
          {size !== "sm" && <p className="mt-1 line-clamp-2 text-sm text-white/85">{d.tagline}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {d.vibes.slice(0, 3).map((v) => (
              <span key={v} className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
                {VIBE_EMOJI[v]} {v}
              </span>
            ))}
          </div>
          {extra ?? (
            <div className="mt-2 flex items-center gap-3 text-xs text-white/80">
              <span>★ {d.avgRating.toFixed(1)}</span>
              <span>~{formatUsd(d.dailyBudgetUSD.midrange)}/day</span>
              <span>Best: {d.bestMonths.slice(0, 3).map((m) => MONTHS_SHORT[m - 1]).join(", ")}</span>
            </div>
          )}
        </div>
      </SmartImage>
    </Link>
  );
}
