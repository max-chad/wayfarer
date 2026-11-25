import { CalendarCheck, Ticket, Utensils } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountTabs } from "@/components/account/AccountTabs";
import { EmptyState } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { userBookings, type Booking } from "@/lib/data/commerce";
import { formatCents } from "@/lib/plans";
import { todayIso } from "@/lib/pricing";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My bookings" };

const KIND = { experience: { label: "Experience", icon: Ticket }, ticket: { label: "Tickets", icon: Ticket }, table: { label: "Table", icon: Utensils } } as const;

function Row({ b }: { b: Booking }) {
  const K = KIND[b.kind];
  return (
    <Link href={`/bookings/${b.ref}`} className={cn("card flex items-center gap-4 p-3 transition-shadow hover:shadow-lift", b.status === "canceled" && "opacity-60")}>
      <SmartImage image={b.place.image} alt={b.place.name} width={330} className="size-16 shrink-0 rounded-xl sm:size-20" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          <K.icon className="size-3.5" /> {K.label} · {b.place.destinationName}
        </div>
        <div className="truncate font-semibold">{b.place.name}</div>
        <div className="text-sm text-muted">
          {formatDate(b.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {b.time} · {b.party} {b.party === 1 ? "person" : "people"}
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <div className="font-mono text-xs tracking-wider text-muted">{b.ref}</div>
        <div className="font-semibold">{b.totalCents ? formatCents(b.totalCents) : "Pay at venue"}</div>
        {b.status === "canceled" && <span className="badge bg-surface-3 text-muted">Cancelled</span>}
      </div>
    </Link>
  );
}

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/bookings");
  const all = userBookings(user.id);
  const today = todayIso();
  const upcoming = all.filter((b) => b.date >= today && b.status === "confirmed").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = all.filter((b) => !(b.date >= today && b.status === "confirmed"));
  return (
    <div className="container-page max-w-4xl pt-10">
      <h1 className="font-display text-4xl font-semibold">My bookings</h1>
      <p className="mt-1 text-muted">Tours, tickets and tables you&apos;ve reserved through Wayfarer.</p>
      <AccountTabs active="/bookings" />
      {all.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<CalendarCheck className="size-6" />} title="No bookings yet" action={<Link href="/destinations" className="btn btn-dark">Find something to do</Link>}>
            Book experiences, skip-the-line tickets and restaurant tables right from a place&apos;s page — they&apos;ll show up here and on your trip.
          </EmptyState>
        </div>
      ) : (
        <>
          <h2 className="mt-8 font-display text-2xl font-semibold">Upcoming</h2>
          <div className="mt-3 space-y-3">{upcoming.length ? upcoming.map((b) => <Row key={b.id} b={b} />) : <p className="text-sm text-muted">Nothing coming up.</p>}</div>
          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-2xl font-semibold">Past & cancelled</h2>
              <div className="mt-3 space-y-3">
                {past.map((b) => (
                  <Row key={b.id} b={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
