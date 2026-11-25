import { seasonalFactor } from "@/lib/pricing";
import { MONTHS_SHORT, formatUsd } from "@/lib/utils";

/** Seasonal price estimate derived from destination seasonality (not live rates). */
export function PriceCalendar({ base, bestMonths, avoidMonths, eventMonths }: { base: number; bestMonths: number[]; avoidMonths: number[]; eventMonths: number[] }) {
  const prices = Array.from({ length: 12 }, (_, i) => Math.round(base * seasonalFactor(i + 1, { bestMonths, avoidMonths, eventMonths })));
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const cheapest = prices.map((p, i) => ({ p, i })).filter((x) => x.p === min).map((x) => MONTHS_SHORT[x.i]);
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {prices.map((p, i) => (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t ${p === min ? "bg-brand-500" : p === max ? "bg-coral-400" : "bg-surface-3 group-hover:bg-line-strong"}`}
              style={{ height: `${25 + ((p - min) / Math.max(1, max - min)) * 75}%` }}
              title={`${MONTHS_SHORT[i]}: ~${formatUsd(p)}/night`}
            />
            <span className="mt-1 text-[9px] text-muted">{MONTHS_SHORT[i][0]}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Best value: <strong className="text-brand-700 dark:text-brand-400">{cheapest.join(", ")}</strong> (~{formatUsd(min)}). Peak ~{formatUsd(max)}. Seasonal estimate, not live
        rates.
      </p>
    </div>
  );
}
