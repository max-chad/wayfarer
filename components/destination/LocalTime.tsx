"use client";

import { useEffect, useState } from "react";

export function LocalTime({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="inline-block h-4 w-12 skeleton" />;
  let time = "";
  let diff = "";
  try {
    time = now.toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    const there = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const here = new Date(now.toLocaleString("en-US"));
    const h = Math.round((there.getTime() - here.getTime()) / 3600000);
    diff = h === 0 ? "same as you" : `${h > 0 ? "+" : ""}${h}h from you`;
  } catch {
    time = "--:--";
  }
  return (
    <span>
      {time} <span className="text-xs text-muted">({diff})</span>
    </span>
  );
}
