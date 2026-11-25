// Exchange rates: live from open.er-api.com (free, no key) with a static fallback table.

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.88,
  GBP: 0.75,
  CHF: 0.83,
  CZK: 21.5,
  DKK: 6.58,
  SEK: 9.4,
  NOK: 10.1,
  PLN: 3.7,
  HUF: 322,
  ISK: 124,
  TRY: 41,
  MAD: 9.1,
  EGP: 48,
  ZAR: 17.6,
  AED: 3.67,
  JPY: 147,
  CNY: 6.7,
  HKD: 7.85,
  KRW: 1380,
  IDR: 16300,
  THB: 32.5,
  SGD: 1.29,
  VND: 26200,
  INR: 88,
  AUD: 1.44,
  NZD: 1.7,
  CAD: 1.42,
  MXN: 18.4,
  BRL: 5.2,
  ARS: 1380,
  PEN: 3.5,
  CLP: 950,
  COP: 3900,
};

let cached: { at: number; rates: Record<string, number>; source: "live" | "fallback"; updated: string } | null = null;

export async function getRates() {
  if (cached && Date.now() - cached.at < 6 * 3600_000) return cached;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const j = (await res.json()) as { result: string; rates: Record<string, number>; time_last_update_utc: string };
    if (j.result !== "success") throw new Error("bad response");
    cached = { at: Date.now(), rates: j.rates, source: "live", updated: j.time_last_update_utc };
  } catch {
    cached = { at: Date.now() - 5.5 * 3600_000, rates: FALLBACK_USD_RATES, source: "fallback", updated: "offline reference rates" };
  }
  return cached;
}

export async function convertCurrency(amount: number, from: string, to: string) {
  const { rates, source, updated } = await getRates();
  if (!rates[from] || !rates[to]) return null;
  const value = (amount / rates[from]) * rates[to];
  return { amount, from, to, result: Math.round(value * 100) / 100, rate: Math.round((rates[to] / rates[from]) * 1e6) / 1e6, source, updated };
}
