"use client";

import { List, Map as MapIcon } from "lucide-react";
import { useState } from "react";
import { LazyMap, TYPE_COLORS } from "@/components/map/LazyMap";
import { PlaceCard } from "@/components/place/PlaceCard";
import type { PlaceCardData } from "@/lib/types";
import { cn, imgUrl } from "@/lib/utils";

export function ListingResults({ items, rankOffset = 0 }: { items: PlaceCardData[]; rankOffset?: number }) {
  const [view, setView] = useState<"split" | "list">("split");
  const [hover, setHover] = useState<number | null>(null);
  const markers = items.map((p, i) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: p.name,
    subtitle: p.category,
    href: `/place/${p.slug}`,
    image: p.image ? imgUrl(p.image, 330) : null,
    label: i + 1 + rankOffset,
    color: TYPE_COLORS[p.type],
    rating: p.rating,
  }));
  return (
    <div>
      <div className="mb-4 hidden justify-end gap-1 lg:flex">
        <button onClick={() => setView("split")} className="chip" data-active={view === "split"}>
          <MapIcon className="size-3.5" /> List + map
        </button>
        <button onClick={() => setView("list")} className="chip" data-active={view === "list"}>
          <List className="size-3.5" /> List only
        </button>
      </div>
      <div className={cn("grid gap-6", view === "split" && "lg:grid-cols-[1fr_0.85fr]")}>
        <div className="space-y-3">
          {items.map((p, i) => (
            <div key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
              <PlaceCard place={p} layout="horizontal" rank={i + 1 + rankOffset} />
            </div>
          ))}
        </div>
        {view === "split" && (
          <div className="hidden lg:block">
            <div className="sticky top-36">
              <LazyMap markers={markers} activeId={hover} className="h-[calc(100vh-11rem)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
