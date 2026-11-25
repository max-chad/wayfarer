import { ArrowLeft, ExternalLink, Handshake, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPlaceById } from "@/lib/data/places";
import { HOTEL_PARTNERS, hotelCpcCents, formatCents } from "@/lib/plans";
import { addDays } from "@/lib/pricing";
import { verifyToken } from "@/lib/sign";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Continue to partner", robots: { index: false } };

type Props = { params: Promise<{ partner: string }>; searchParams: Promise<{ t?: string }> };

/**
 * Demo hand-off page. In production /go/:token redirects straight to the partner's deep link with
 * Wayfarer's affiliate ID; here it explains what would happen, because the partners are fictional.
 */
export default async function PartnerHandoff({ params, searchParams }: Props) {
  const { partner } = await params;
  const { t } = await searchParams;
  const data = t ? verifyToken<{ pl: number; pk: string; pr: number; ci: string; n: number; g: number }>(t) : null;
  const p = HOTEL_PARTNERS.find((x) => x.key === partner);
  if (!data || !p) {
    return (
      <div className="container-page max-w-lg pt-20 text-center">
        <TimerOff className="mx-auto size-10 text-muted" />
        <h1 className="mt-3 font-display text-3xl font-semibold">This offer has expired</h1>
        <p className="mt-2 text-muted">Prices change quickly. Head back to the hotel page for live prices.</p>
        <Link href="/destinations" className="btn btn-dark mt-6">
          Browse destinations
        </Link>
      </div>
    );
  }
  const place = getPlaceById(data.pl);
  const cpc = place ? hotelCpcCents(place.priceLevel, p.key) : 0;
  return (
    <div className="container-page max-w-xl pt-14">
      <div className="card overflow-hidden">
        <div className="p-6 text-white" style={{ background: p.color }}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Demo booking partner</div>
          <div className="mt-1 font-display text-4xl font-semibold">{p.name}</div>
        </div>
        <div className="p-6">
          <h1 className="font-display text-2xl font-semibold">{place?.name ?? "Your hotel"}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(data.ci, { weekday: "short", month: "short", day: "numeric" })} → {formatDate(addDays(data.ci, data.n), { weekday: "short", month: "short", day: "numeric" })} · {data.n} night
            {data.n > 1 ? "s" : ""} · {data.g} guest{data.g > 1 ? "s" : ""}
          </p>
          <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-2 p-4">
            <span className="text-sm text-muted">Total quoted</span>
            <span className="font-display text-3xl font-semibold">{formatCents(data.pr)}</span>
          </div>
          <div className="mt-5 flex gap-3 rounded-xl border border-line p-4 text-sm">
            <Handshake className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <p className="text-ink-2">
              In production you&apos;d now be on {p.name}&apos;s booking page with these dates filled in. Wayfarer is paid about <strong>{formatCents(cpc, { decimals: true })}</strong> for this
              click by the partner. Fees are similar across partners and never change the order prices are shown in.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {place && (
              <Link href={`/place/${place.slug}#prices`} className="btn btn-dark">
                <ArrowLeft className="size-4" /> Back to {place.name}
              </Link>
            )}
            <Link href="/how-we-make-money" className="btn btn-outline">
              How we make money <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
