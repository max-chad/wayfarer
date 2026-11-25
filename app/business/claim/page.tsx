import type { Metadata } from "next";
import Link from "next/link";
import { ClaimFlow } from "@/components/business/ClaimFlow";
import { getBusinessByPlace } from "@/lib/data/business";
import { getPlacesByIds } from "@/lib/data/places";

export const metadata: Metadata = { title: "Claim your listing" };

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ place?: string; q?: string }> }) {
  const sp = await searchParams;
  const placeId = Number(sp.place) || 0;
  const place = placeId ? getPlacesByIds([placeId])[0] ?? null : null;
  const claimed = place ? getBusinessByPlace(place.id) : null;
  return (
    <div className="container-page max-w-2xl pt-10">
      <Link href="/business" className="text-sm text-muted hover:underline">
        ← Wayfarer for Business
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Claim your free listing</h1>
      <p className="mt-2 text-muted">Takes about two minutes. You&apos;ll be able to reply to reviews and update your details straight away.</p>
      <div className="mt-8">
        {claimed && claimed.status === "verified" ? (
          <div className="card p-6 text-sm">
            <strong>{place!.name}</strong> has already been claimed and verified. If you believe that&apos;s a mistake, contact business support with proof that you manage it.
          </div>
        ) : (
          <ClaimFlow initialPlace={place && place.type !== "attraction" ? place : null} initialQuery={sp.q || ""} />
        )}
      </div>
    </div>
  );
}
