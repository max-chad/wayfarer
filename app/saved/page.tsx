import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LazyMap, TYPE_COLORS } from "@/components/map/LazyMap";
import { PlaceCard } from "@/components/place/PlaceCard";
import { EmptyState } from "@/components/ui/Section";
import { getCurrentUser } from "@/lib/auth";
import { savedPlaces } from "@/lib/data/misc";
import { imgUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved places" };

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/saved");
  const saved = savedPlaces(user.id);
  const groups = new Map<string, typeof saved>();
  for (const s of saved) groups.set(s.destinationName, [...(groups.get(s.destinationName) || []), s]);

  return (
    <div className="container-page pt-10">
      <h1 className="font-display text-4xl font-semibold">Saved places</h1>
      <p className="mt-1 text-muted">
        {saved.length} saved across {groups.size} destination{groups.size === 1 ? "" : "s"}. Add them to a trip with one click.
      </p>
      {saved.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Heart className="size-6" />} title="Nothing saved yet" action={<Link href="/destinations" className="btn btn-dark">Start exploring</Link>}>
            Tap the heart on any place to build your wishlist.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-10">
            {[...groups.entries()].map(([dest, list]) => (
              <section key={dest}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-semibold">{dest}</h2>
                  <Link href={`/plan?destination=${list[0].destinationSlug}&mustSee=${list.filter((p) => p.type === "attraction" || p.type === "experience").map((p) => p.id).join(",")}`} className="btn btn-outline btn-sm">
                    Plan a trip with these
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                  {list.map((p) => (
                    <PlaceCard key={p.id} place={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <LazyMap
                className="h-[70vh]"
                markers={saved.map((p) => ({
                  id: p.id,
                  lat: p.lat,
                  lng: p.lng,
                  title: p.name,
                  subtitle: `${p.category} · ${p.destinationName}`,
                  href: `/place/${p.slug}`,
                  image: p.image ? imgUrl(p.image, 330) : null,
                  color: TYPE_COLORS[p.type],
                  label: "♥",
                }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
