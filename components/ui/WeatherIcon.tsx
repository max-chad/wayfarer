import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import type { WeatherIcon as W } from "@/lib/services/weather";

const MAP = { sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };
const COLOR: Record<W, string> = {
  sun: "text-sun-500",
  "cloud-sun": "text-sun-400",
  cloud: "text-slate-400",
  fog: "text-slate-400",
  drizzle: "text-sky-400",
  rain: "text-sky-500",
  snow: "text-sky-300",
  storm: "text-violet-500",
};

export function WeatherIcon({ icon, className = "size-6" }: { icon: W; className?: string }) {
  const Icon = MAP[icon] || Cloud;
  return <Icon className={`${className} ${COLOR[icon] || ""}`} aria-hidden />;
}
