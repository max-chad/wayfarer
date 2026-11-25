import type { ClimateMonth } from "../types";

export interface ForecastDay {
  date: string;
  tmax: number;
  tmin: number;
  precipProb: number;
  code: number;
  summary: string;
  icon: WeatherIcon;
  uv: number;
  sunrise: string;
  sunset: string;
}

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  summary: string;
  icon: WeatherIcon;
  isDay: boolean;
  time: string;
}

export type WeatherIcon = "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function describeWeatherCode(code: number): { summary: string; icon: WeatherIcon } {
  if (code === 0) return { summary: "Clear sky", icon: "sun" };
  if (code <= 2) return { summary: "Partly cloudy", icon: "cloud-sun" };
  if (code === 3) return { summary: "Overcast", icon: "cloud" };
  if (code <= 48) return { summary: "Fog", icon: "fog" };
  if (code <= 57) return { summary: "Drizzle", icon: "drizzle" };
  if (code <= 67) return { summary: code >= 65 ? "Heavy rain" : "Rain", icon: "rain" };
  if (code <= 77) return { summary: "Snow", icon: "snow" };
  if (code <= 82) return { summary: "Rain showers", icon: "rain" };
  if (code <= 86) return { summary: "Snow showers", icon: "snow" };
  return { summary: "Thunderstorms", icon: "storm" };
}

const cache = new Map<string, { at: number; value: { days: ForecastDay[]; current: CurrentWeather | null } | null }>();
const TTL = 30 * 60_000;

/** Bounded insert: Map keeps insertion order, so dropping the front evicts the oldest entry. */
function cacheSet(key: string, value: { at: number; value: { days: ForecastDay[]; current: CurrentWeather | null } | null }) {
  if (cache.size >= 500) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
}

async function fetchForecast(lat: number, lng: number) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto&forecast_days=16`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as {
      daily: Record<string, (number | string)[]>;
      current?: Record<string, number | string>;
    };
    const d = j.daily;
    const days: ForecastDay[] = (d.time as string[]).map((date, i) => {
      const code = Number(d.weather_code[i]);
      return {
        date,
        tmax: Math.round(Number(d.temperature_2m_max[i])),
        tmin: Math.round(Number(d.temperature_2m_min[i])),
        precipProb: Math.round(Number(d.precipitation_probability_max[i] ?? 0)),
        code,
        uv: Math.round(Number(d.uv_index_max[i] ?? 0)),
        sunrise: String(d.sunrise[i]).slice(11, 16),
        sunset: String(d.sunset[i]).slice(11, 16),
        ...describeWeatherCode(code),
      };
    });
    const c = j.current;
    const current: CurrentWeather | null = c
      ? {
          temp: Math.round(Number(c.temperature_2m)),
          feelsLike: Math.round(Number(c.apparent_temperature)),
          humidity: Math.round(Number(c.relative_humidity_2m)),
          wind: Math.round(Number(c.wind_speed_10m)),
          code: Number(c.weather_code),
          isDay: Number(c.is_day) === 1,
          time: String(c.time),
          ...describeWeatherCode(Number(c.weather_code)),
        }
      : null;
    const value = { days, current };
    cacheSet(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.warn(`[weather] forecast unavailable for ${key}: ${(e as Error).message}`);
    cacheSet(key, { at: Date.now() - TTL + 60_000, value: null }); // retry in a minute
    return null;
  }
}

export async function getForecast(lat: number, lng: number, _tz?: string): Promise<ForecastDay[] | null> {
  return (await fetchForecast(lat, lng))?.days ?? null;
}

export async function getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather | null> {
  return (await fetchForecast(lat, lng))?.current ?? null;
}

export function describeClimateMonth(c: ClimateMonth | undefined) {
  if (!c) return {};
  const feel = c.tmax >= 30 ? "hot" : c.tmax >= 24 ? "warm" : c.tmax >= 17 ? "mild" : c.tmax >= 9 ? "cool" : "cold";
  const wet = c.rainyDays >= 14 ? "very wet" : c.rainyDays >= 9 ? "fairly wet" : c.rainyDays >= 5 ? "some rain" : "mostly dry";
  return {
    avgHighC: c.tmax,
    avgLowC: c.tmin,
    rainyDays: c.rainyDays,
    precipitationMm: c.precip,
    sunHoursPerDay: c.sunHours,
    feel: `${feel}, ${wet}`,
  };
}

/** Weather for specific trip dates: live forecast inside the 16-day window, climate normals otherwise. */
export async function weatherForTrip(
  lat: number,
  lng: number,
  climate: ClimateMonth[],
  startDate: string | null | undefined,
  days: number
): Promise<{ date: string; tmax: number; tmin: number; precipProb: number; summary: string; icon: WeatherIcon; source: "forecast" | "climate" }[]> {
  const start = startDate ? new Date(startDate + "T12:00:00Z") : null;
  if (!start || Number.isNaN(start.getTime())) return [];
  const fc = await getForecast(lat, lng);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const f = fc?.find((x) => x.date === iso);
    if (f) {
      out.push({ date: iso, tmax: f.tmax, tmin: f.tmin, precipProb: f.precipProb, summary: f.summary, icon: f.icon, source: "forecast" as const });
    } else {
      const c = climate[d.getUTCMonth()];
      const prob = Math.round(Math.min(95, ((c?.rainyDays ?? 8) / 30) * 100));
      out.push({
        date: iso,
        tmax: Math.round(c?.tmax ?? 20),
        tmin: Math.round(c?.tmin ?? 12),
        precipProb: prob,
        summary: prob > 45 ? "Showers likely (avg)" : prob > 25 ? "Mixed (avg)" : "Mostly dry (avg)",
        icon: (prob > 45 ? "rain" : prob > 25 ? "cloud-sun" : "sun") as WeatherIcon,
        source: "climate" as const,
      });
    }
  }
  return out;
}
