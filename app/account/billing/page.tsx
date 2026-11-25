import { BellRing, Crown, PartyPopper, Receipt, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountTabs } from "@/components/account/AccountTabs";
import { RemoveAlertButton, SubscriptionActions } from "@/components/billing/SubscriptionActions";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCurrentUser } from "@/lib/auth";
import { getPlan, invoicesFor, listSubscriptions, PAYMENTS_MODE, quotaStatus } from "@/lib/data/billing";
import { lowestStayPriceCents, userPriceAlerts } from "@/lib/data/commerce";
import { FEATURE_LABELS, formatCents } from "@/lib/plans";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/billing");
  const { welcome } = await searchParams;
  const plan = getPlan(user.id);
  const subs = listSubscriptions(user.id);
  const invoices = invoicesFor(user.id);
  const alerts = userPriceAlerts(user.id).map((a) => ({ ...a, nowCents: lowestStayPriceCents(a.placeId, { checkIn: a.checkIn, nights: a.nights, guests: a.guests }) }));
  const subject = `u:${user.id}`;
  const quotas = (["plan", "chat", "insights"] as const).map((f) => quotaStatus(subject, plan, f));
  const plusSub = subs.find((s) => s.product === "plus" && s.status === "active");

  return (
    <div className="container-page max-w-4xl pt-10">
      <h1 className="font-display text-4xl font-semibold">Plan & billing</h1>
      <p className="mt-1 text-muted">Your membership, AI usage, subscriptions and invoices.</p>
      <AccountTabs active="/account/billing" />

      {welcome === "plus" && plan === "plus" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl ai-gradient p-5 text-white">
          <PartyPopper className="mt-0.5 size-6 shrink-0" />
          <div>
            <div className="font-display text-xl font-semibold">Welcome to Wayfarer Plus!</div>
            <p className="text-sm text-white/90">Unlimited AI planning is on, sponsored listings are off, and you can now track hotel prices and export trips as GPX.</p>
          </div>
        </div>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className={cn("card p-5", plan === "plus" && "ring-1 ring-coral-300 dark:ring-coral-500/40")}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {plan === "plus" ? <Crown className="size-4 text-coral-500" /> : <Sparkles className="size-4" />} Current plan
          </div>
          <div className="mt-1 font-display text-3xl font-semibold">{plan === "plus" ? "Wayfarer Plus" : "Free"}</div>
          {plusSub ? (
            <p className="mt-1 text-sm text-muted">
              {formatCents(plusSub.priceCents)} / {plusSub.interval} ·{" "}
              {plusSub.cancelAtPeriodEnd ? `ends ${formatDate(plusSub.currentPeriodEnd)}` : `renews ${formatDate(plusSub.currentPeriodEnd)}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Reviews, summaries, smart search and trip editing are free forever.</p>
          )}
          <div className="mt-4">
            {plan === "plus" ? (
              plusSub && <SubscriptionActions id={plusSub.id} cancelAtPeriodEnd={plusSub.cancelAtPeriodEnd} periodEnd={plusSub.currentPeriodEnd} />
            ) : (
              <Link href="/pricing" className="btn btn-accent btn-sm">
                <Crown className="size-4" /> Upgrade to Plus
              </Link>
            )}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">AI usage</div>
          <div className="mt-3 space-y-4">
            {quotas.map((q) => {
              const pct = Math.min(100, (q.used / q.limit) * 100);
              return (
                <div key={q.feature}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{FEATURE_LABELS[q.feature].many}</span>
                    <span className="text-muted">
                      {plan === "plus" ? `${q.used} used · unlimited` : `${q.used} / ${q.limit} ${q.per === "day" ? "today" : "this month"}`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn("h-full rounded-full", pct >= 100 ? "bg-coral-500" : "bg-brand-500")} style={{ width: `${plan === "plus" ? Math.min(100, (q.used / 20) * 100) : pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="alerts" className="mt-10 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <BellRing className="size-5 text-brand-600" /> Price alerts
        </h2>
        {plan !== "plus" ? (
          <p className="mt-2 text-sm text-muted">
            Plus members can watch any hotel and get notified when the price for their dates drops by 5% or more. <Link href="/pricing" className="underline">See Plus</Link>
          </p>
        ) : alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No alerts yet — tap “Track price” on any hotel page.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="card flex items-center gap-3 p-3">
                <SmartImage image={a.image} alt={a.placeName} width={330} className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/place/${a.placeSlug}#prices`} className="block truncate font-semibold hover:underline">
                    {a.placeName}
                  </Link>
                  <div className="text-xs text-muted">
                    {formatDate(a.checkIn)} · {a.nights} night{a.nights > 1 ? "s" : ""} · {a.guests} guest{a.guests > 1 ? "s" : ""} · {a.destinationName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold">{a.nowCents != null ? formatCents(a.nowCents) : "—"}</div>
                  <div className="text-[11px] text-muted">lowest right now</div>
                </div>
                <RemoveAlertButton placeId={a.placeId} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Subscriptions</h2>
        {subs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No subscriptions.</p>
        ) : (
          <div className="card mt-4 divide-y divide-line">
            {subs.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {s.productName}
                    {s.placeName && (
                      <span className="font-normal text-muted">
                        {" "}
                        · <Link href={`/place/${s.placeSlug}`} className="hover:underline">{s.placeName}</Link>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {formatCents(s.priceCents)} / {s.interval} · started {formatDate(s.startedAt)} ·{" "}
                    {s.status === "canceled" ? `ended ${formatDate(s.currentPeriodEnd)}` : s.cancelAtPeriodEnd ? `ends ${formatDate(s.currentPeriodEnd)}` : `renews ${formatDate(s.currentPeriodEnd)}`}
                  </div>
                </div>
                <span className={cn("badge", s.status === "active" && !s.cancelAtPeriodEnd ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-surface-3 text-muted")}>
                  {s.status === "canceled" ? "Ended" : s.cancelAtPeriodEnd ? "Cancelling" : "Active"}
                </span>
                {s.status === "active" && <SubscriptionActions id={s.id} cancelAtPeriodEnd={s.cancelAtPeriodEnd} periodEnd={s.currentPeriodEnd} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Receipt className="size-5 text-brand-600" /> Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No invoices yet.</p>
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-muted">{formatDate(i.createdAt)}</td>
                    <td className="px-4 py-2.5">{i.description}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCents(i.amountCents, { decimals: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {PAYMENTS_MODE === "demo" && <p className="mt-2 text-xs text-muted">Demo mode: invoices are recorded but no payments are taken.</p>}
      </section>
    </div>
  );
}
