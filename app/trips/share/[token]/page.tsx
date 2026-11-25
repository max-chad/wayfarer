import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripEditor } from "@/components/trips/TripEditor";
import { getCurrentUser } from "@/lib/auth";
import { getDestinationById } from "@/lib/data/destinations";
import { getTripByShareToken } from "@/lib/data/trips";
import { weatherForTrip } from "@/lib/services/weather";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const t = getTripByShareToken(token);
  return { title: t ? `${t.title} — shared itinerary` : "Shared trip" };
}

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params;
  const trip = getTripByShareToken(token);
  if (!trip) notFound();
  const user = await getCurrentUser();
  const dest = trip.destinationId ? getDestinationById(trip.destinationId) : null;
  const weather = dest && trip.startDate ? await weatherForTrip(dest.lat, dest.lng, dest.climate, trip.startDate, trip.days) : [];
  return (
    <TripEditor
      initial={trip}
      editable={trip.userId === user?.id}
      shared
      weather={weather}
      destination={dest ? { slug: dest.slug, name: dest.name, lat: dest.lat, lng: dest.lng, currency: dest.info.currency, dailyBudget: dest.info.dailyBudgetUSD } : null}
    />
  );
}
