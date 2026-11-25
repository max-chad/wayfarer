"use client";

import { Check, Crown, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PLUS_FEATURES, PRODUCTS, formatCents } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PricingPlans({ current }: { current: "anon" | "free" | "plus" }) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const plus = PRODUCTS.plus;
  const perMonth = interval === "year" ? Math.round((plus.yearlyCents ?? 0) / 12) : plus.monthlyCents;
  const saving = Math.round((1 - (plus.yearlyCents ?? 0) / (plus.monthlyCents * 12)) * 100);
  const checkout = `/checkout?product=plus&interval=${interval}`;

  const cell = (v: string | boolean) =>
    v === true ? <Check className="mx-auto size-4 text-brand-600" aria-label="Included" /> : v === false ? <Minus className="mx-auto size-4 text-muted" aria-label="Not included" /> : <span className="text-sm font-medium">{v}</span>;

  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Billing period">
        {(["month", "year"] as const).map((iv) => (
          <button key={iv} role="radio" aria-checked={interval === iv} onClick={() => setInterval(iv)} className="chip border-0" data-active={interval === iv}>
            {iv === "month" ? "Monthly" : `Yearly · save ${saving}%`}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2">
        <div className="card flex flex-col p-6">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted">Free</div>
          <div className="mt-2 font-display text-4xl font-semibold">$0</div>
          <p className="mt-1 text-sm text-muted">Everything you need to research and plan a trip.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {PLUS_FEATURES.filter((f) => f.free).map((f) => (
              <li key={f.label} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span>
                  {f.label}
                  {typeof f.free === "string" && <span className="text-muted"> — {f.free}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            {current === "anon" ? (
              <Link href="/signup?next=/plan" className="btn btn-outline w-full">
                Create a free account
              </Link>
            ) : (
              <div className="btn btn-outline w-full cursor-default opacity-70">{current === "free" ? "Your current plan" : "Included"}</div>
            )}
          </div>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-2xl p-[1.5px] ai-gradient shadow-lift">
          <div className="flex h-full flex-col rounded-[calc(1rem-1.5px)] bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-coral-600 dark:text-coral-400">
                <Crown className="size-4" /> Plus
              </div>
              <span className="badge bg-coral-50 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300">Most popular</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-4xl font-semibold">{formatCents(perMonth, { decimals: true })}</span>
              <span className="text-muted">/ month</span>
            </div>
            <p className="mt-1 text-sm text-muted">{interval === "year" ? `${formatCents(plus.yearlyCents!)} billed once a year.` : "Billed monthly. Cancel anytime."}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {PLUS_FEATURES.map((f) => (
                <li key={f.label} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-coral-500" />
                  <span>
                    {f.label}
                    {typeof f.plus === "string" && <span className="font-semibold"> — {f.plus}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              {current === "plus" ? (
                <Link href="/account/billing" className="btn btn-dark w-full">
                  Manage your membership
                </Link>
              ) : (
                <Link href={current === "anon" ? `/signup?next=${encodeURIComponent(checkout)}` : checkout} className="btn btn-accent w-full">
                  Get Wayfarer Plus
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mx-auto mt-10 max-w-4xl overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Compare plans</th>
              <th className="w-32 px-4 py-3 text-center">Free</th>
              <th className="w-32 px-4 py-3 text-center">Plus</th>
            </tr>
          </thead>
          <tbody>
            {PLUS_FEATURES.map((f) => (
              <tr key={f.label} className={cn("border-b border-line last:border-0")}>
                <td className="px-4 py-3">{f.label}</td>
                <td className="px-4 py-3 text-center">{cell(f.free)}</td>
                <td className="px-4 py-3 text-center">{cell(f.plus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
