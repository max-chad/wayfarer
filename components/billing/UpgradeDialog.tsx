"use client";

import { Check, Crown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PLUS_FEATURES, PRODUCTS, formatCents } from "@/lib/plans";
import { cn } from "@/lib/utils";

export type UpgradeReason = "plan" | "chat" | "price_alerts" | "gpx" | "generic";

const HEADLINES: Record<UpgradeReason, string> = {
  plan: "Plan as many trips as you like",
  chat: "Keep the conversation going",
  price_alerts: "Never overpay for a hotel again",
  gpx: "Take your trip offline",
  generic: "Travel smarter with Wayfarer Plus",
};

export function UpgradeDialog({ open, reason, message, signedIn, onClose }: { open: boolean; reason: UpgradeReason; message?: string | null; signedIn: boolean; onClose: () => void }) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const plus = PRODUCTS.plus;
  const monthlyEquivalent = Math.round((plus.yearlyCents ?? 0) / 12);
  const saving = Math.round((1 - (plus.yearlyCents ?? 0) / (plus.monthlyCents * 12)) * 100);
  const checkout = `/checkout?product=plus&interval=${interval}`;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative m-0 w-full max-w-md overflow-hidden rounded-b-none p-0 animate-fade-up sm:m-4 sm:rounded-2xl">
        <div className="ai-gradient px-6 pb-5 pt-6 text-white">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Close">
            <X className="size-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/85">
            <Crown className="size-4" /> Wayfarer Plus
          </div>
          <h2 id="upgrade-title" className="mt-2 font-display text-2xl font-semibold leading-tight">
            {HEADLINES[reason]}
          </h2>
          {message && <p className="mt-2 text-sm text-white/90">{message}</p>}
        </div>
        <div className="p-6">
          <ul className="space-y-2 text-sm">
            {PLUS_FEATURES.filter((f) => f.plus !== f.free).map((f) => (
              <li key={f.label} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span>
                  {f.label}
                  {typeof f.plus === "string" && <span className="text-muted"> — {f.plus.toLowerCase()}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
            {(["year", "month"] as const).map((iv) => (
              <button
                key={iv}
                role="radio"
                aria-checked={interval === iv}
                onClick={() => setInterval(iv)}
                className={cn("rounded-xl border p-3 text-left transition-colors", interval === iv ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-line-strong")}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">{iv === "year" ? `Yearly · save ${saving}%` : "Monthly"}</div>
                <div className="mt-0.5 font-display text-xl font-semibold">
                  {iv === "year" ? formatCents(monthlyEquivalent, { decimals: true }) : formatCents(plus.monthlyCents)}
                  <span className="text-sm font-normal text-muted">/mo</span>
                </div>
                {iv === "year" && <div className="text-xs text-muted">{formatCents(plus.yearlyCents!)} billed yearly</div>}
              </button>
            ))}
          </div>
          {signedIn ? (
            <Link href={checkout} onClick={onClose} className="btn btn-primary mt-5 w-full">
              Continue to checkout
            </Link>
          ) : (
            <div className="mt-5 grid gap-2">
              <Link href={`/signup?next=${encodeURIComponent(checkout)}`} onClick={onClose} className="btn btn-primary w-full">
                Create an account to go Plus
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} onClick={onClose} className="btn btn-outline w-full">
                Or join free — 5 AI plans a month
              </Link>
            </div>
          )}
          <p className="mt-3 text-center text-xs text-muted">
            Cancel anytime. <Link href="/pricing" onClick={onClose} className="underline">Compare plans</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
