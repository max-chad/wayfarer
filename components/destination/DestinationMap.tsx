"use client";

import { useMemo, useState } from "react";
import { LazyMap, TYPE_COLORS } from "@/components/map/LazyMap";
import type { PlaceType } from "@/lib/types";
import { imgUrl, TYPE_LABELS } from "@/lib/utils";

export interface MapPoint {
  id: number;
  slug: string;
  name: string;
  type: PlaceType;
  category: string;
  lat: number;
  lng: number;
  rating: number;
  image: string | null;
}

export function DestinationMap({ points, className = "h-[460px]" }: { points: MapPoint[]; className?: string }) {
  const [types, setTypes] = useState<Set<PlaceType>>(new Set(["attraction", "hotel", "restaurant", "experience"]));
  const markers = useMemo(
    () =>
      points
        .filter((p) => types.has(p.type))
        .map((p) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.name,
          subtitle: `${TYPE_LABELS[p.type].singular} · ${p.category}`,
          href: `/place/${p.slug}`,
          image: p.image ? imgUrl(p.image, 330) : null,
          color: TYPE_COLORS[p.type],
          label: p.type === "hotel" ? "H" : p.type === "restaurant" ? "R" : p.type === "experience" ? "E" : "★",
          rating: p.rating,
        })),
    [points, types]
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["attraction", "hotel", "restaurant", "experience"] as PlaceType[]).map((t) => (
          <button
            key={t}
            onClick={() =>
              setTypes((s) => {
                const n = new Set(s);
                if (n.has(t)) n.delete(t);
                else n.add(t);
                return n;
              })
            }
            className="chip"
            data-active={types.has(t)}
          >
            <span className="size-2.5 rounded-full" style={{ background: TYPE_COLORS[t] }} />
            {TYPE_LABELS[t].plural} ({points.filter((p) => p.type === t).length})
          </button>
        ))}
      </div>
      <LazyMap markers={markers} className={className} />
    </div>
  );
}
