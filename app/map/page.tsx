import type { Metadata } from "next";
import { ExploreMap } from "@/components/map/ExploreMap";
import { listDestinations } from "@/lib/data/destinations";
import { mapPoints } from "@/lib/data/places";

export const metadata: Metadata = { title: "Explore map" };

export default function MapPage() {
  const dests = listDestinations().map((d) => ({ slug: d.slug, name: d.name, country: d.country, lat: d.lat, lng: d.lng, count: d.placeCount, rating: d.avgRating }));
  const places = mapPoints().map((p) => ({ ...p, image: p.image ? (JSON.parse(p.image) as { url: string }).url.replace("/1280px-", "/330px-") : null }));
  return <ExploreMap destinations={dests} places={places} />;
}
