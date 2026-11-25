import { Ban, BedDouble, Building2, Code2, Crown, HandCoins, Megaphone, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { revenueByDay } from "@/lib/data/revenue";
import { COMMISSION, PRODUCTS, STREAM_LABELS, formatCents, hotelCpcRangeCents, type RevenueStream } from "@/lib/plans";

export const metadata: Metadata = {
  title: "How Wayfarer makes money",
  description: "Every way Wayfarer earns money, what businesses can and can't pay for, and the rules that keep rankings and AI answers independent.",
};

const STREAMS: { id: string; icon: typeof BedDouble; title: string; body: React.ReactNode }[] = [
  {
    id: "partners",
    icon: BedDouble,
    title: "Hotel booking partners",
    body: (
      <>
        Hotel pages show prices from booking partners, sorted from cheapest to most expensive. When you click a deal, the partner pays us a small fee per click, between{" "}
        {formatCents(hotelCpcRangeCents().min, { decimals: true })} and {formatCents(hotelCpcRangeCents().max, { decimals: true })} depending on the hotel&apos;s price level and the partner. The
        fee doesn&apos;t change the order, and hotels on Business Insights can show a commission-free Book Direct link right alongside.
      </>
    ),
  },
  {
    id: "bookings",
    icon: Ticket,
    title: "Tours, tickets and tables",
    body: (
      <>
        When you book an experience or ticket on Wayfarer the operator pays us {Math.round(COMMISSION.experienceRate * 100)}% of the booking value. Restaurants pay{" "}
        {formatCents(COMMISSION.restaurantPerCoverCents, { decimals: true })} per seated guest for reservations. You pay the same price you&apos;d pay the venue directly.
      </>
    ),
  },
  {
    id: "sponsored",
    icon: Megaphone,
    title: "Sponsored listings",
    body: (
      <>
        Businesses rated 3.5★ or higher can pay per click to appear in one clearly labelled “Sponsored” slot above city rankings and in matching searches. Sponsored slots
        never move the organic list, never appear inside AI answers or itineraries, and are switched off for Plus members.
      </>
    ),
  },
  {
    id: "business",
    icon: Building2,
    title: "Business subscriptions",
    body: (
      <>
        Owners can claim their listing for free. Paid plans ({formatCents(PRODUCTS.business_insights.monthlyCents)} and {formatCents(PRODUCTS.business_pro.monthlyCents)} a month) add analytics, AI review insights,
        AI-drafted replies and competitor benchmarks. None of it affects rankings or moderation.
      </>
    ),
  },
  {
    id: "plus",
    icon: Crown,
    title: "Wayfarer Plus",
    body: (
      <>
        Travelers who plan a lot can pay {formatCents(PRODUCTS.plus.monthlyCents, { decimals: true })}/month or {formatCents(PRODUCTS.plus.yearlyCents!, { decimals: true })}/year for unlimited AI planning, price-drop
        alerts, GPX export and no sponsored listings. Everything needed to research a trip stays free.
      </>
    ),
  },
  {
    id: "api",
    icon: Code2,
    title: "API & data",
    body: <>Travel apps, tourism boards and publishers license our places data and AI review insights through the developer API. We never sell personal data.</>,
  },
];

const NEVER = [
  "Sell rankings, awards, review scores or a place in an AI answer.",
  "Let anyone pay to remove, hide or reorder reviews.",
  "Give advertising or commission data to the concierge or the planner.",
  "Sort prices by the commission we earn.",
  "Sell your personal data or use it for third-party advertising.",
];

export default function HowWeMakeMoney() {
  const days = revenueByDay(30);
  const totals: Partial<Record<RevenueStream, number>> = {};
  for (const d of days) for (const [k, v] of Object.entries(d.streams)) totals[k as RevenueStream] = (totals[k as RevenueStream] || 0) + (v || 0);
  const sum = Object.values(totals).reduce((s, v) => s + (v || 0), 0) || 1;
  const mix = (Object.keys(STREAM_LABELS) as RevenueStream[]).map((k) => ({ k, pct: ((totals[k] || 0) / sum) * 100 })).filter((x) => x.pct > 0);

  return (
    <div className="container-page max-w-4xl pt-12">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
        <HandCoins className="size-4" /> Transparency
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">How Wayfarer makes money</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Wayfarer is free because businesses pay us when travelers book, click through to a partner or choose to advertise. Here is every way we earn money — and the lines we
        won&apos;t cross, because a travel advisor is only useful if you can trust it.
      </p>

      <div className="card mt-8 p-5">
        <div className="text-sm font-semibold">Where our revenue came from in the last 30 days</div>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full">
          {mix.map((m) => (
            <div key={m.k} style={{ width: `${m.pct}%`, background: STREAM_LABELS[m.k].color }} title={`${STREAM_LABELS[m.k].label}: ${m.pct.toFixed(0)}%`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {mix.map((m) => (
            <span key={m.k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: STREAM_LABELS[m.k].color }} />
              {STREAM_LABELS[m.k].label} <strong>{m.pct.toFixed(0)}%</strong>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Computed live from this demo&apos;s (fictional) data.</p>
      </div>

      <div className="mt-10 space-y-6">
        {STREAMS.map((s) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-24 gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <s.icon className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
              <p className="mt-1 leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-2xl border-2 border-coral-200 bg-coral-50/50 p-6 dark:border-coral-500/30 dark:bg-coral-500/5">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Ban className="size-5 text-coral-500" /> What we never do
        </h2>
        <ul className="mt-4 space-y-2">
          {NEVER.map((n) => (
            <li key={n} className="flex gap-2 text-ink-2">
              <span className="text-coral-500">✕</span> {n}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm text-muted">
        More detail: <Link href="/trust" className="underline">Trust &amp; transparency report</Link> · <Link href="/legal/ai" className="underline">AI transparency</Link> ·{" "}
        <Link href="/legal/business-terms#ads" className="underline">Advertising policy</Link>
      </p>
    </div>
  );
}
