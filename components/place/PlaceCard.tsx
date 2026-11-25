import { Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { AwardList, PriceLevel } from "@/components/ui/Badges";
import { SmartImage } from "@/components/ui/SmartImage";
import { RatingPill } from "@/components/ui/Stars";
import type { PlaceCardData } from "@/lib/types";
import { cn, formatDuration, formatUsd, TYPE_LABELS } from "@/lib/utils";
import { SaveButton } from "./SaveButton";

export function PlaceCard({ place, layout = "vertical", rank, className = "" }: { place: PlaceCardData; layout?: "vertical" | "horizontal" | "compact"; rank?: number; className?: string }) {
  const price =
    place.type === "hotel" ? (
      <span>
        from <strong className="text-ink">{formatUsd(place.priceUsd)}</strong>/night
      </span>
    ) : place.type === "restaurant" ? (
      <PriceLevel level={place.priceLevel} />
    ) : place.priceUsd > 0 ? (
      <span>
        from <strong className="text-ink">{formatUsd(place.priceUsd)}</strong>
      </span>
    ) : (
      <span className="font-semibold text-brand-600 dark:text-brand-400">Free</span>
    );

  if (layout === "compact") {
    return (
      <Link href={`/place/${place.slug}`} className={cn("group flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2", className)}>
        <SmartImage image={place.image} alt={place.name} width={330} className="size-16 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold group-hover:text-brand-600">{place.name}</div>
          <div className="truncate text-xs text-muted">
            {place.category}
            {place.distanceKm != null && ` · ${place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`}`}
          </div>
          <RatingPill value={place.rating} count={place.reviewCount} className="mt-0.5 text-xs" />
        </div>
      </Link>
    );
  }

  if (layout === "horizontal") {
    return (
      <Link href={`/place/${place.slug}`} className={cn("card group flex overflow-hidden transition-shadow hover:shadow-lift", className)}>
        <SmartImage image={place.image} alt={place.name} width={500} className="w-36 shrink-0 sm:w-56">
          <div className="absolute right-2 top-2">
            <SaveButton placeId={place.id} name={place.name} />
          </div>
        </SmartImage>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400">
              {rank != null && <span className="mr-1 text-muted">{rank}.</span>}
              {place.name}
            </h3>
          </div>
          <RatingPill value={place.rating} count={place.reviewCount} />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{place.category}</span>
            {place.neighborhood && (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {place.neighborhood}
              </span>
            )}
            {place.details.durationMin ? (
              <span className="flex items-center gap-0.5">
                <Clock className="size-3" />
                {formatDuration(place.details.durationMin)}
              </span>
            ) : null}
            {place.ranking > 0 && (
              <span>
                #{place.ranking} of {place.rankingTotal} {TYPE_LABELS[place.type].plural.toLowerCase()}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-ink-2">{place.description}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-muted">
            {price}
            <AwardList awards={place.awards} max={2} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/place/${place.slug}`} className={cn("group flex flex-col", className)}>
      <SmartImage image={place.image} alt={place.name} width={500} className="aspect-[4/3] rounded-2xl" imgClassName="transition-transform duration-500 group-hover:scale-[1.04]">
        <div className="absolute right-2.5 top-2.5">
          <SaveButton placeId={place.id} name={place.name} />
        </div>
        {place.awards.length > 0 && (
          <div className="absolute left-2.5 top-2.5">
            <AwardList awards={place.awards} max={1} />
          </div>
        )}
      </SmartImage>
      <div className="mt-2.5 space-y-1 px-0.5">
        <h3 className="line-clamp-1 font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400">
          {rank != null && <span className="mr-1 text-muted">{rank}.</span>}
          {place.name}
        </h3>
        <RatingPill value={place.rating} count={place.reviewCount} />
        <div className="line-clamp-1 text-xs text-muted">
          {place.category} · {place.destinationName}
        </div>
        <div className="text-sm text-muted">{price}</div>
      </div>
    </Link>
  );
}
