import { cn, formatDate } from "@/lib/utils";

/** Lightweight bar chart (server-rendered, no JS). Optional second series is drawn as an inner bar. */
export function MiniBars({
  data,
  height = 140,
  color = "bg-brand-500/80",
  overlayColor = "bg-coral-500",
  format = (n: number) => n.toLocaleString("en-US"),
  className,
}: {
  data: { label: string; value: number; overlay?: number }[];
  height?: number;
  color?: string;
  overlayColor?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-[2px]", className)} style={{ height }} role="img" aria-label="Chart">
      {data.map((d) => (
        <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}${d.overlay != null ? ` · ${format(d.overlay)}` : ""}`}>
          <div className={cn("relative w-full rounded-t-[3px] transition-opacity group-hover:opacity-80", color)} style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}>
            {d.overlay != null && d.value > 0 && <div className={cn("absolute inset-x-0 bottom-0 rounded-t-[3px]", overlayColor)} style={{ height: `${Math.min(100, (d.overlay / d.value) * 100)}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DayAxis({ days }: { days: string[] }) {
  if (!days.length) return null;
  const pick = [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]];
  return (
    <div className="mt-1 flex justify-between text-[10px] text-muted">
      {pick.map((d, i) => (
        <span key={i}>{formatDate(d, { month: "short", day: "numeric" })}</span>
      ))}
    </div>
  );
}

/** Stacked daily bars for several series (used by the revenue dashboard). */
export function StackedBars({ days, series, height = 180 }: { days: { day: string; values: Record<string, number> }[]; series: { key: string; color: string; label: string }[]; height?: number }) {
  const totals = days.map((d) => series.reduce((s, x) => s + (d.values[x.key] || 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label="Stacked chart">
        {days.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 flex-col-reverse"
            title={`${d.day}: ${series.map((s) => `${s.label} $${((d.values[s.key] || 0) / 100).toFixed(0)}`).join(" · ")}`}
          >
            {series.map((s) => {
              const v = d.values[s.key] || 0;
              return v ? <div key={s.key} style={{ height: `${(v / max) * 100}%`, background: s.color }} className="w-full first:rounded-b-none last:rounded-t-[3px]" /> : null;
            })}
            <span className="sr-only">{totals[i]}</span>
          </div>
        ))}
      </div>
      <DayAxis days={days.map((d) => d.day)} />
    </div>
  );
}

export function Delta({ value, previous, invert = false }: { value: number; previous: number; invert?: boolean }) {
  if (!previous) return <span className="text-xs text-muted">new</span>;
  const pct = Math.round(((value - previous) / previous) * 100);
  const good = invert ? pct < 0 : pct >= 0;
  return (
    <span className={cn("text-xs font-semibold", good ? "text-brand-600 dark:text-brand-400" : "text-coral-600")}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}
