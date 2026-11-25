import { ArrowLeft, Bot, Building2, Crown, DollarSign, MousePointerClick, ShoppingBag, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StackedBars } from "@/components/business/Charts";
import { getCurrentUser } from "@/lib/auth";
import { businessDirectoryStats } from "@/lib/data/business";
import { aiCostEstimate, funnel, mrr, partnerSplit, recentBookings, revenueByDay, subscriptionMovement, topEarners } from "@/lib/data/revenue";
import { HOTEL_PARTNERS, STREAM_LABELS, formatCents, type RevenueStream } from "@/lib/plans";
import { formatDate, TYPE_LABELS } from "@/lib/utils";

export const metadata: Metadata = { title: "Revenue", robots: { index: false } };

const ORDER: RevenueStream[] = ["commission", "affiliate", "ads", "business", "api", "subscriptions"];

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/revenue");
  if (user.role !== "admin") redirect("/");
  const { days: d } = await searchParams;
  const days = [30, 90].includes(Number(d)) ? Number(d) : 30;

  const series = revenueByDay(days);
  const prev = revenueByDay(days * 2).slice(0, days);
  const total = series.reduce((s, x) => s + x.total, 0);
  const prevTotal = prev.reduce((s, x) => s + x.total, 0);
  const byStream = ORDER.map((k) => ({ k, cents: series.reduce((s, x) => s + (x.streams[k] || 0), 0) }));
  const m = mrr();
  const mv = subscriptionMovement(30);
  const f = funnel(days);
  const top = topEarners(days, 8);
  const partners = partnerSplit(30);
  const bookings = recentBookings(8);
  const ai = aiCostEstimate(days);
  const dir = businessDirectoryStats();
  const growth = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const runRate = (total / days) * 365;

  return (
    <div className="container-page pt-10">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:underline">
        <ArrowLeft className="size-3.5" /> Admin & moderation
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Revenue</h1>
          <p className="mt-1 text-muted">All six revenue streams, live from the database. Demo data — partners and businesses are fictional.</p>
        </div>
        <div className="flex gap-1">
          {[30, 90].map((n) => (
            <Link key={n} href={`/admin/revenue?days=${n}`} className="chip" data-active={days === n}>
              {n} days
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          [DollarSign, formatCents(total, { decimals: false }), `Revenue · ${days}d`, growth ? `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth).toFixed(0)}% vs prior ${days}d` : ""],
          [TrendingUp, formatCents(Math.round(runRate), { decimals: false }), "Annualised run-rate", ""],
          [Crown, formatCents(m.totalCents, { decimals: false }), "MRR (subscriptions)", `${m.list.reduce((s, x) => s + x.subscribers, 0)} subscribers`],
          [MousePointerClick, f.clickouts.toLocaleString("en-US"), `Partner clicks · ${days}d`, f.hotelViews ? `${((f.clickouts / f.hotelViews) * 100).toFixed(1)}% of hotel views` : ""],
          [ShoppingBag, f.bookings.toLocaleString("en-US"), `Bookings · ${days}d`, ""],
        ].map(([Icon, n, l, sub]) => {
          const I = Icon as typeof DollarSign;
          return (
            <div key={l as string} className="card p-4">
              <I className="size-5 text-brand-600" />
              <div className="mt-2 font-display text-2xl font-semibold">{n as string}</div>
              <div className="text-xs text-muted">{l as string}</div>
              {sub ? <div className="mt-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400">{sub as string}</div> : null}
            </div>
          );
        })}
      </div>

      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold">Daily revenue by stream</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {ORDER.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: STREAM_LABELS[k].color }} /> {STREAM_LABELS[k].label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <StackedBars days={series.map((s) => ({ day: s.day, values: s.streams as Record<string, number> }))} series={ORDER.map((k) => ({ key: k, color: STREAM_LABELS[k].color, label: STREAM_LABELS[k].label }))} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <div className="font-semibold">Revenue mix · {days}d</div>
          <div className="mt-4 space-y-3">
            {byStream.map(({ k, cents }) => (
              <div key={k}>
                <div className="flex justify-between text-sm">
                  <span>{STREAM_LABELS[k].label}</span>
                  <span className="font-semibold">{formatCents(cents)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${total ? (cents / total) * 100 : 0}%`, background: STREAM_LABELS[k].color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="font-semibold">Recurring revenue</div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {m.list.map((x) => (
                <tr key={x.product} className="border-b border-line last:border-0">
                  <td className="py-2">{x.name}</td>
                  <td className="py-2 text-right text-muted">{x.subscribers}</td>
                  <td className="py-2 text-right font-semibold">{formatCents(x.mrrCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-surface-2 p-2">
              <div className="font-display text-lg font-semibold">{mv.activePlus}</div>
              Plus members
            </div>
            <div className="rounded-xl bg-surface-2 p-2">
              <div className="font-display text-lg font-semibold text-brand-600">+{mv.newPlus}</div>
              new · 30d
            </div>
            <div className="rounded-xl bg-surface-2 p-2">
              <div className="font-display text-lg font-semibold text-coral-600">−{mv.churnedPlus}</div>
              cancelled · 30d
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4 text-brand-600" /> Business side
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[
              ["Claimed listings", dir.claimed],
              ["Verified", dir.verified],
              ["Insights plans", dir.insights],
              ["Pro plans", dir.pro],
              ["Active ad campaigns", dir.activeCampaigns],
              ["Paid share", dir.verified ? `${Math.round(((dir.insights + dir.pro) / dir.verified) * 100)}%` : "—"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-muted">{k as string}</dt>
                <dd className="font-display text-xl font-semibold">{v as string | number}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="font-semibold">Top-earning places · {days}d</div>
          <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Place</th>
                <th className="pb-2 text-right font-medium">Clicks</th>
                <th className="pb-2 text-right font-medium">Bookings</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="max-w-[220px] truncate py-1.5">
                    <Link href={`/place/${t.slug}`} className="hover:underline">
                      {t.name}
                    </Link>
                    <span className="text-xs text-muted"> · {TYPE_LABELS[t.type as keyof typeof TYPE_LABELS].singular}, {t.destination}</span>
                  </td>
                  <td className="py-1.5 text-right">{t.clickouts.toLocaleString("en-US")}</td>
                  <td className="py-1.5 text-right">{t.bookings.toLocaleString("en-US")}</td>
                  <td className="py-1.5 text-right font-semibold">{formatCents(t.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="font-semibold">Hotel partners · 30d</div>
            <div className="mt-3 space-y-2">
              {partners.map((p) => {
                const info = HOTEL_PARTNERS.find((x) => x.key === p.partner);
                return (
                  <div key={p.partner} className="flex items-center gap-3 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: info?.color || "#13866a" }} />
                    <span className="w-28">{info?.name || "Book direct"}</span>
                    <span className="flex-1 text-muted">{p.clicks.toLocaleString("en-US")} clicks</span>
                    <span className="font-semibold">{formatCents(p.cents)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="size-4 text-brand-600" /> AI cost vs revenue · {days}d
            </div>
            <p className="mt-2 text-sm text-muted">
              {ai.calls.toLocaleString("en-US")} AI calls ({ai.claudeCalls} via Claude, {(ai.input / 1000).toFixed(0)}k in / {(ai.output / 1000).toFixed(0)}k out tokens) ≈{" "}
              <strong className="text-ink">{formatCents(ai.cents, { decimals: true })}</strong> at ${ai.inRate}/${ai.outRate} per million tokens —{" "}
              {total ? `${((ai.cents / total) * 100).toFixed(2)}% of revenue` : "no revenue yet"}. Local-engine calls cost nothing.
            </p>
          </div>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <div className="font-semibold">Latest bookings</div>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No bookings yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.ref} className="border-t border-line first:border-0">
                    <td className="py-1.5 font-mono text-xs">{b.ref}</td>
                    <td className="py-1.5">
                      <Link href={`/place/${b.slug}`} className="hover:underline">
                        {b.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-muted">
                      {formatDate(b.date)} · {b.party}p
                    </td>
                    <td className="py-1.5 text-muted">{b.status}</td>
                    <td className="py-1.5 text-right">{b.totalCents ? formatCents(b.totalCents) : "—"}</td>
                    <td className="py-1.5 text-right font-semibold text-brand-600 dark:text-brand-400">+{formatCents(b.commissionCents, { decimals: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
