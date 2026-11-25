import type { Metadata } from "next";
import { TravelTools } from "@/components/tools/TravelTools";
import { listDestinations, getDestination } from "@/lib/data/destinations";
import { HOME_CITIES } from "@/lib/seed/people";

export const metadata: Metadata = { title: "Travel tools", description: "Currency converter, world clock, packing lists, flight CO₂, plugs & tipping for every destination." };

export default function ToolsPage() {
  const dests = listDestinations({ sort: "name" }).map((d) => {
    const full = getDestination(d.slug)!;
    return {
      slug: d.slug,
      name: d.name,
      country: d.country,
      lat: d.lat,
      lng: d.lng,
      timezone: full.info.timezone,
      currency: full.info.currency,
      plug: full.info.plugType,
      voltage: full.info.voltage,
      tipping: full.info.tipping,
    };
  });
  return <TravelTools destinations={dests} cities={HOME_CITIES} />;
}
