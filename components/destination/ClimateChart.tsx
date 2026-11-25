import type { ClimateMonth } from "@/lib/types";
import { MONTHS_SHORT } from "@/lib/utils";

/** Monthly climate: rain bars + high/low temperature lines, best months highlighted. */
export function ClimateChart({ climate, bestMonths, currentMonth }: { climate: ClimateMonth[]; bestMonths: number[]; currentMonth?: number }) {
  if (!climate.length) return null;
  const W = 720;
  const H = 260;
  const pad = { l: 36, r: 36, t: 20, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const tMin = Math.floor(Math.min(...climate.map((c) => c.tmin)) / 5) * 5 - 5;
  const tMax = Math.ceil(Math.max(...climate.map((c) => c.tmax)) / 5) * 5 + 5;
  const pMax = Math.max(60, ...climate.map((c) => c.precip));
  const x = (i: number) => pad.l + (i + 0.5) * (iw / 12);
  const yT = (t: number) => pad.t + ih - ((t - tMin) / (tMax - tMin)) * ih;
  const yP = (p: number) => pad.t + ih - (p / pMax) * ih * 0.75;
  const bw = (iw / 12) * 0.5;
  const line = (key: "tmax" | "tmin") => climate.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yT(c[key]).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => tMin + ((tMax - tMin) / 4) * i);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Average monthly temperature and rainfall">
        {climate.map((c, i) =>
          bestMonths.includes(c.month) ? <rect key={`b${i}`} x={pad.l + i * (iw / 12)} y={pad.t} width={iw / 12} height={ih} className="fill-brand-400/10" /> : null
        )}
        {currentMonth && <rect x={pad.l + (currentMonth - 1) * (iw / 12)} y={pad.t} width={iw / 12} height={ih} className="fill-none stroke-coral-400" strokeDasharray="4 4" />}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={yT(t)} y2={yT(t)} className="stroke-line" strokeWidth={1} />
            <text x={pad.l - 6} y={yT(t) + 4} textAnchor="end" className="fill-muted text-[10px]">
              {Math.round(t)}°
            </text>
          </g>
        ))}
        {climate.map((c, i) => (
          <g key={`p${i}`}>
            <rect x={x(i) - bw / 2} y={yP(c.precip)} width={bw} height={pad.t + ih - yP(c.precip)} rx={3} className="fill-sky-400/45 dark:fill-sky-500/40">
              <title>{`${MONTHS_SHORT[i]}: ${c.precip} mm rain, ${c.rainyDays} rainy days`}</title>
            </rect>
          </g>
        ))}
        <path d={line("tmax")} className="fill-none stroke-coral-500" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={line("tmin")} className="fill-none stroke-brand-600 dark:stroke-brand-400" strokeWidth={2.5} strokeLinejoin="round" />
        {climate.map((c, i) => (
          <g key={`d${i}`}>
            <circle cx={x(i)} cy={yT(c.tmax)} r={3.5} className="fill-coral-500">
              <title>{`${MONTHS_SHORT[i]} high ${c.tmax}°C`}</title>
            </circle>
            <circle cx={x(i)} cy={yT(c.tmin)} r={3.5} className="fill-brand-600 dark:fill-brand-400">
              <title>{`${MONTHS_SHORT[i]} low ${c.tmin}°C`}</title>
            </circle>
            <text x={x(i)} y={H - 12} textAnchor="middle" className={`text-[11px] ${bestMonths.includes(c.month) ? "fill-brand-700 font-semibold dark:fill-brand-300" : "fill-muted"}`}>
              {MONTHS_SHORT[i]}
            </text>
          </g>
        ))}
        <text x={W - pad.r + 6} y={pad.t + 8} className="fill-muted text-[10px]">
          mm
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-coral-500" /> Avg high
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-brand-600" /> Avg low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-sky-400/45" /> Rainfall
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-brand-400/20" /> Best months
        </span>
        <span>Source: Open-Meteo, 2023–2025 averages</span>
      </figcaption>
    </figure>
  );
}
