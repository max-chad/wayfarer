import { cn } from "@/lib/utils";

/** Star rating display supporting fractional values. */
export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const star = (key: string) => (
    <svg key={key} viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" fill="currentColor" />
    </svg>
  );
  return (
    <span className={cn("relative inline-flex shrink-0 align-middle", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="flex gap-[1px] text-line-strong">{[0, 1, 2, 3, 4].map((i) => star(`b${i}`))}</span>
      <span className="absolute inset-0 flex gap-[1px] overflow-hidden text-sun-400" style={{ width: `${pct}%` }}>
        {[0, 1, 2, 3, 4].map((i) => star(`f${i}`))}
      </span>
    </span>
  );
}

export function RatingPill({ value, count, className = "" }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-xs font-bold text-white">{value.toFixed(1)}</span>
      <Stars value={value} size={13} />
      {count != null && <span className="text-muted">({count.toLocaleString("en-US")})</span>}
    </span>
  );
}
