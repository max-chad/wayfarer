"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type MapViewType from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full min-h-60 w-full rounded-2xl" />,
});

export type { MapMarker, MapPolyline } from "./MapView";

export function LazyMap(props: ComponentProps<typeof MapViewType>) {
  return <MapView {...props} />;
}

export const TYPE_COLORS: Record<string, string> = {
  hotel: "#7c3aed",
  restaurant: "#ea580c",
  attraction: "#0f766e",
  experience: "#db2777",
  destination: "#11463b",
};
