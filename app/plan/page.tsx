import type { Metadata } from "next";
import { Planner } from "@/components/planner/Planner";
import { getCurrentUser } from "@/lib/auth";
import { listDestinations } from "@/lib/data/destinations";
import { imgUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "AI trip planner", description: "Generate a day-by-day itinerary with maps, meals, costs and weather in seconds." };

type SP = Promise<Record<string, string | undefined>>;

export default async function PlanPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const dests = listDestinations({ sort: "name" }).map((d) => ({
    slug: d.slug,
    name: d.name,
    country: d.country,
    image: d.image ? imgUrl(d.image, 330) : null,
    bestMonths: d.bestMonths,
    vibes: d.vibes,
  }));
  const initial = {
    destinationSlug: sp.destination && dests.some((d) => d.slug === sp.destination) ? sp.destination : "",
    days: sp.days ? Math.min(14, Math.max(1, Number(sp.days) || 3)) : 3,
    travelers: sp.travelers ? Math.min(12, Math.max(1, Number(sp.travelers) || 2)) : 2,
    budget: (["budget", "midrange", "luxury"].includes(sp.budget || "") ? sp.budget : "midrange") as "budget" | "midrange" | "luxury",
    pace: (["relaxed", "balanced", "packed"].includes(sp.pace || "") ? sp.pace : "balanced") as "relaxed" | "balanced" | "packed",
    interests: sp.interests ? sp.interests.split(",").filter(Boolean) : user?.interests?.length ? user.interests : ["culture", "food"],
    mustSee: sp.mustSee ? sp.mustSee.split(",").map(Number).filter(Boolean) : [],
    autostart: sp.autostart === "1",
  };
  return <Planner destinations={dests} initial={initial} signedIn={!!user} />;
}
