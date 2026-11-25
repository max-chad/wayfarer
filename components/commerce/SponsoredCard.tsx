import { Info, MapPin } from "lucide-react";
import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { RatingPill } from "@/components/ui/Stars";
import type { PlaceCardData } from "@/lib/types";
import { formatUsd, priceSymbols } from "@/lib/utils";

/**
 * A clearly labelled paid placement. Clicks go through /go/ad/:token so the advertiser is charged.
 * A plain <a> on purpose: a prefetching <Link> would "click" the ad as soon as it scrolled into view.
 */
export function SponsoredCard({ token, place }: { token: string; place: PlaceCardData }) {
  const price = place.type === "hotel" ? `from ${formatUsd(place.priceUsd)}/night` : place.type === "restaurant" ? priceSymbols(place.priceLevel) : place.priceUsd ? `from ${formatUsd(place.priceUsd)}` : "Free";
  return (
    <div className="relative">
      <a href={`/go/ad/${token}`} rel="sponsored nofollow" className="card group flex overflow-hidden border-dashed transition-shadow hover:shadow-lift">
        <SmartImage image={place.image} alt={place.name} width={500} className="w-32 shrink-0 sm:w-48" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
          <span className="badge w-fit bg-surface-3 text-ink-2">Sponsored</span>
          <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400">{place.name}</h3>
          <RatingPill value={place.rating} count={place.reviewCount} />
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{place.category}</span>
            {place.neighborhood && (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {place.neighborhood}
              </span>
            )}
            <span>{price}</span>
          </div>
          <p className="line-clamp-1 text-sm text-ink-2">{place.description}</p>
        </div>
      </a>
      <Link
        href="/how-we-make-money#sponsored"
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[11px] text-muted backdrop-blur hover:text-ink"
        title="This business paid to be shown here. Sponsored listings never change organic rankings or AI answers, and only places rated 3.5+ can advertise."
      >
        <Info className="size-3" /> Why am I seeing this?
      </Link>
    </div>
  );
}
