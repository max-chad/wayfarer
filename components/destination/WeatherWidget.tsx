import { Droplets, Sunrise, Sunset, Wind } from "lucide-react";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { getCurrentWeather, getForecast } from "@/lib/services/weather";

export async function WeatherWidget({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [days, current] = await Promise.all([getForecast(lat, lng), getCurrentWeather(lat, lng)]);
  if (!days || !current) {
    return <div className="card p-5 text-sm text-muted">Live weather for {name} is unavailable right now — check the climate chart below.</div>;
  }
  const week = days.slice(0, 7);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-sky-50 to-brand-50 p-5 dark:from-sky-950/40 dark:to-brand-950/40">
        <div className="flex items-center gap-4">
          <WeatherIcon icon={current.icon} className="size-14" />
          <div>
            <div className="font-display text-4xl font-semibold">{current.temp}°C</div>
            <div className="text-sm text-muted">
              {current.summary} · feels like {current.feelsLike}°
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-2">
          <span className="flex items-center gap-1.5">
            <Droplets className="size-4 text-sky-500" /> {current.humidity}% humidity
          </span>
          <span className="flex items-center gap-1.5">
            <Wind className="size-4 text-slate-400" /> {current.wind} km/h
          </span>
          <span className="flex items-center gap-1.5">
            <Sunrise className="size-4 text-sun-500" /> {week[0].sunrise}
          </span>
          <span className="flex items-center gap-1.5">
            <Sunset className="size-4 text-coral-400" /> {week[0].sunset}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-line">
        {week.map((d, i) => (
          <div key={d.date} className="px-1 py-3 text-center">
            <div className="text-xs font-medium text-muted">
              {i === 0 ? "Today" : new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
            </div>
            <WeatherIcon icon={d.icon} className="mx-auto my-1.5 size-6" />
            <div className="text-sm font-semibold">{d.tmax}°</div>
            <div className="text-xs text-muted">{d.tmin}°</div>
            <div className={`mt-1 text-[10px] ${d.precipProb >= 50 ? "font-semibold text-sky-600 dark:text-sky-400" : "text-muted"}`}>💧{d.precipProb}%</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Live forecast by Open-Meteo · updates every 30 min</div>
    </div>
  );
}
