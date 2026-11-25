import { CalendarDays, CheckCircle2, Clock, MapPin, ShieldCheck, Users, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CancelBookingButton } from "@/components/commerce/CancelBookingButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { getBooking, isCancellable } from "@/lib/data/commerce";
import { formatCents } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/bookings/${ref}`);
  const b = getBooking(ref, user.id);
  if (!b) notFound();
  const cancellable = isCancellable(b);
  const canceled = b.status === "canceled";
  return (
    <div className="container-page max-w-2xl pt-10">
      <Link href="/bookings" className="text-sm text-muted hover:underline">
        ← All bookings
      </Link>
      <div className="card mt-4 overflow-hidden">
        <SmartImage image={b.place.image} alt={b.place.name} width={960} className="h-44 w-full sm:h-56" />
        <div className="p-6">
          <div className={`flex items-center gap-2 text-sm font-semibold ${canceled ? "text-muted" : "text-brand-700 dark:text-brand-400"}`}>
            {canceled ? <XCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
            {canceled ? "Cancelled" : b.kind === "table" ? "Table reserved" : "Confirmed"}
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold">{b.place.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {b.place.neighborhood ? `${b.place.neighborhood}, ` : ""}
            {b.place.destinationName}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              [CalendarDays, "Date", formatDate(b.date, { weekday: "short", month: "short", day: "numeric" })],
              [Clock, "Time", b.time || "—"],
              [Users, b.kind === "table" ? "Guests" : "Travelers", String(b.party)],
              [ShieldCheck, "Reference", b.ref],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Clock;
              return (
                <div key={label as string}>
                  <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    <I className="size-3.5" /> {label as string}
                  </dt>
                  <dd className="mt-0.5 font-semibold">{value as string}</dd>
                </div>
              );
            })}
          </dl>
          <div className="mt-6 flex items-center justify-between rounded-xl bg-surface-2 p-4 text-sm">
            <span className="text-muted">{b.kind === "table" ? "Paid at the restaurant" : "Total (pay later)"}</span>
            <span className="font-display text-xl font-semibold">{b.totalCents ? formatCents(b.totalCents) : "—"}</span>
          </div>
          {b.contactName && <p className="mt-3 text-sm text-muted">Booked under {b.contactName}{b.notes ? ` · “${b.notes}”` : ""}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/place/${b.place.slug}`} className="btn btn-dark btn-sm">
              View place
            </Link>
            {b.tripId && (
              <Link href={`/trips/${b.tripId}`} className="btn btn-outline btn-sm">
                Open trip
              </Link>
            )}
            {cancellable && <CancelBookingButton bookingRef={b.ref} />}
          </div>
          {!canceled && !cancellable && <p className="mt-3 text-xs text-muted">Free cancellation has ended — contact the venue to change this booking.</p>}
          <p className="mt-6 text-xs text-muted">Demo booking: no payment was taken and the venue is fictional.</p>
        </div>
      </div>
    </div>
  );
}
