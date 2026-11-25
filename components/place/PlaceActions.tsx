"use client";

import { CalendarPlus, Check, GitCompareArrows, PenLine, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCompare } from "@/components/compare/CompareTray";
import { useApp } from "@/components/providers/AppProviders";
import { AddToTripDialog } from "./AddToTripDialog";
import { SaveButton } from "./SaveButton";

export function PlaceActions({
  place,
}: {
  place: { id: number; slug: string; name: string; type: string; image: string | null; destinationSlug: string; destinationName: string };
}) {
  const { requireLogin, toast } = useApp();
  const [dialog, setDialog] = useState(false);
  const compare = useCompare();
  const inCompare = compare.has(place.id);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: place.name, text: `${place.name} on Wayfarer`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard");
      }
    } catch {}
  };

  return (
    <div className="flex flex-wrap gap-2">
      <SaveButton placeId={place.id} name={place.name} variant="button" />
      <button
        className="btn btn-outline"
        onClick={() => {
          if (requireLogin("Sign in to add places to your trips")) setDialog(true);
        }}
      >
        <CalendarPlus className="size-4" /> Add to trip
      </button>
      <button className="btn btn-outline" onClick={() => compare.toggle({ id: place.id, name: place.name, image: place.image, type: place.type })} aria-pressed={inCompare}>
        {inCompare ? <Check className="size-4 text-brand-600" /> : <GitCompareArrows className="size-4" />} {inCompare ? "Comparing" : "Compare"}
      </button>
      <button className="btn btn-outline" onClick={share}>
        <Share2 className="size-4" /> Share
      </button>
      <Link href={`/place/${place.slug}/review`} className="btn btn-dark">
        <PenLine className="size-4" /> Write a review
      </Link>
      {dialog && <AddToTripDialog place={place} onClose={() => setDialog(false)} />}
    </div>
  );
}
