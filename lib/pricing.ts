import { rng } from "./utils";

/** Seasonal multiplier for hotel rates, from a destination's best/avoid/event months. */
export function seasonalFactor(month: number, season: { bestMonths: number[]; avoidMonths: number[]; eventMonths: number[] }) {
  const { bestMonths, avoidMonths, eventMonths } = season;
  let f = 1;
  if (bestMonths.includes(month)) f += 0.22;
  if (avoidMonths.includes(month)) f -= 0.18;
  if (eventMonths.includes(month)) f += 0.1;
  // shoulder months right before/after peak are a touch pricier
  if (!bestMonths.includes(month) && (bestMonths.includes((month % 12) + 1) || bestMonths.includes(((month + 10) % 12) + 1))) f += 0.05;
  return f;
}

/**
 * Deterministic nightly rate for a hotel on a given date. A small day-to-day drift (seeded by
 * today's date) makes prices move like a live market, which powers price-drop alerts.
 */
export function nightlyRate(opts: {
  placeId: number;
  baseUsd: number;
  date: string;
  guests: number;
  season: { bestMonths: number[]; avoidMonths: number[]; eventMonths: number[] };
  partnerKey: string;
  partnerBias: number;
  today?: string;
}) {
  const d = new Date(opts.date + "T12:00:00Z");
  const month = d.getUTCMonth() + 1;
  const dow = d.getUTCDay();
  const weekend = dow === 5 || dow === 6 ? 1.09 : 1;
  const extraGuests = Math.max(0, opts.guests - 2) * 0.16;
  const R = rng(`${opts.placeId}:${opts.partnerKey}:${opts.date}`);
  const partnerNoise = 0.95 + R.next() * 0.1;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const drift = 0.94 + rng(`${opts.placeId}:${opts.date}:${today}`).next() * 0.12;
  return opts.baseUsd * seasonalFactor(month, opts.season) * weekend * (1 + extraGuests) * opts.partnerBias * partnerNoise * drift;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
