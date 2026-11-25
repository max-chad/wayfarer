import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripEditor } from "@/components/trips/TripEditor";
import { getCurrentUser } from "@/lib/auth";
import { bookingsForTrip } from "@/lib/data/commerce";
import { getDestinationById } from "@/lib/data/destinations";
import { getTrip } from "@/lib/data/trips";
import { weatherForTrip } from "@/lib/services/weather";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = getTrip(Number(id));
  return { title: t ? t.title : "Trip" };
}

export default async function TripPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const trip = getTrip(Number(id));
  if (!trip || (trip.userId !== user?.id && !trip.isPublic)) notFound();
  const dest = trip.destinationId ? getDestinationById(trip.destinationId) : null;
  const weather = dest && trip.startDate ? await weatherForTrip(dest.lat, dest.lng, dest.climate, trip.startDate, trip.days) : [];
  return (
    <TripEditor
      initial={trip}
      editable={trip.userId === user?.id}
      bookings={user && trip.userId === user.id ? bookingsForTrip(user.id, trip.id).map((b) => ({ ref: b.ref, placeId: b.place.id, date: b.date, time: b.time, party: b.party })) : []}
      weather={weather}
      destination={dest ? { slug: dest.slug, name: dest.name, lat: dest.lat, lng: dest.lng, currency: dest.info.currency, dailyBudget: dest.info.dailyBudgetUSD } : null}
    />
  );
}
