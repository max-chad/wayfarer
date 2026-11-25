"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AiBadge } from "@/components/ui/Badges";

export function CompareVerdict({ ids, names }: { ids: number[]; names: Record<number, string> }) {
  const [data, setData] = useState<{ verdict: string; picks: { placeId: number; bestFor: string }[]; provider: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    fetch("/api/ai/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: key.split(",").map(Number) }) })
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setData(j))); // the quota gate (402/429) must surface, not hang the skeleton
  }, [key]);
  if (error) {
    return (
      <div className="ai-border p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-coral-500" /> AI verdict
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ai-border space-y-2 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 animate-pulse text-coral-500" /> Weighing up the options…
        </div>
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    );
  }
  return (
    <div className="ai-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-coral-500" /> AI verdict
        </div>
        <AiBadge provider={data.provider} />
      </div>
      <p className="mt-2 text-[15px] leading-relaxed">{data.verdict}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.picks.map((p) => (
          <span key={p.placeId} className="chip">
            <strong>{names[p.placeId]}</strong> — {p.bestFor}
          </span>
        ))}
      </div>
    </div>
  );
}
