import { AlertTriangle, Sparkles } from "lucide-react";
import { AiBadge } from "@/components/ui/Badges";
import { destinationBrief } from "@/lib/ai/features";
import type { Destination } from "@/lib/types";

export async function AiBrief({ dest, topNames }: { dest: Destination; topNames: string[] }) {
  const brief = await destinationBrief(dest, topNames);
  return (
    <div className="ai-border p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-coral-500" /> AI travel brief
        </div>
        <AiBadge provider={brief.provider} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{brief.overview}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Perfect for</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brief.perfectFor.map((p) => (
              <span key={p} className="badge bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Don&apos;t miss</div>
          <ul className="mt-2 space-y-1 text-sm">
            {brief.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="text-coral-500">✦</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {brief.heads_up && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Heads-up:</strong> {brief.heads_up}
          </span>
        </div>
      )}
    </div>
  );
}

export function AiBriefSkeleton() {
  return (
    <div className="ai-border space-y-3 p-6">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-11/12" />
      <div className="skeleton h-4 w-3/4" />
    </div>
  );
}
