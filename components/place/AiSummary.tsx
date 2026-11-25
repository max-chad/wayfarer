"use client";

import { Quote, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AiBadge } from "@/components/ui/Badges";
import type { ReviewSummary } from "@/lib/types";
import { cn, TRIP_TYPE_LABELS } from "@/lib/utils";

const TRIP_EMOJI: Record<string, string> = { couples: "💑", family: "👨‍👩‍👧", friends: "🧑‍🤝‍🧑", solo: "🎒", business: "💼" };

export function AiSummary({ placeId, reviewCount }: { placeId: number; reviewCount: number }) {
  const [data, setData] = useState<ReviewSummary | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`/api/ai/summary/${placeId}`)
      .then((r) => r.json())
      .then((j) => alive && setData(j.error ? null : j.summary)) // 402/429 from the quota gate must not hang the skeleton
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [placeId, reviewCount]);

  if (data === undefined) {
    return (
      <div className="ai-border p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 animate-pulse text-coral-500" /> Reading {reviewCount} reviews…
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="ai-border p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-coral-500" /> What travelers say
        </div>
        <AiBadge provider={data.provider} />
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{data.headline}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{data.summary}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-50/70 p-4 dark:bg-brand-950/40">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            <ThumbsUp className="size-3.5" /> Loved
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.pros.length ? data.pros.map((p) => <li key={p}>✓ {p}</li>) : <li className="text-muted">Not enough data yet</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-coral-50/80 p-4 dark:bg-coral-700/10">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-coral-700 dark:text-coral-300">
            <ThumbsDown className="size-3.5" /> Watch out for
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.cons.length ? data.cons.map((p) => <li key={p}>– {p}</li>) : <li className="text-muted">No consistent complaints 🎉</li>}
          </ul>
        </div>
      </div>

      {data.aspects.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mentioned most</div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.aspects.map((a) => (
              <div key={a.key} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn("h-full rounded-full", a.sentiment === "positive" ? "bg-brand-500" : a.sentiment === "mixed" ? "bg-sun-400" : "bg-coral-500")}
                    style={{ width: `${(a.score / 5) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold">{a.score.toFixed(1)}</span>
                <span className="w-10 text-right text-xs text-muted">{a.mentions}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.bestFor.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Best for</span>
          {data.bestFor.map((b) => (
            <span key={b.tripType} className="chip">
              {TRIP_EMOJI[b.tripType]} {TRIP_TYPE_LABELS[b.tripType]} <span className="text-muted">{b.share}%</span>
            </span>
          ))}
        </div>
      )}

      {data.quotes.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.quotes.slice(0, 2).map((q) => (
            <blockquote key={q.reviewId + q.text} className="relative rounded-xl border border-line bg-surface-2 p-4 pl-10 text-sm italic text-ink-2">
              <Quote className="absolute left-3 top-4 size-4 text-muted" />
              {q.text}
            </blockquote>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted">Summary of {data.basedOn} reviews. AI can make mistakes — check the reviews for details.</p>
    </div>
  );
}
