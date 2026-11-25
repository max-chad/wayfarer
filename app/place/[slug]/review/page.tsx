import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewComposer } from "@/components/review/ReviewComposer";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { getPlace } from "@/lib/data/places";
import { SUB_RATINGS } from "@/lib/review-meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPlace(slug);
  return { title: p ? `Review ${p.name}` : "Write a review" };
}

export default async function WriteReviewPage({ params }: Props) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/place/${slug}/review`);
  return (
    <div className="container-page max-w-5xl pt-8">
      <Link href={`/place/${place.slug}`} className="card flex items-center gap-4 p-3 hover:shadow-lift">
        <SmartImage image={place.image} alt={place.name} width={330} className="size-16 shrink-0 rounded-xl" />
        <div>
          <div className="text-xs text-muted">You&apos;re reviewing</div>
          <div className="font-display text-xl font-semibold">{place.name}</div>
          <div className="text-sm text-muted">
            {place.category} · {place.destinationName}
          </div>
        </div>
      </Link>
      <ReviewComposer place={{ id: place.id, slug: place.slug, name: place.name, type: place.type }} subRatings={SUB_RATINGS[place.type].map(([label]) => label)} />
    </div>
  );
}
