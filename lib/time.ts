/**
 * Converts a wall-clock time at a destination ("2026-10-10", "19:00", "Asia/Tokyo") into a UTC
 * timestamp. Two passes of Intl offset lookup handle DST transitions correctly.
 */
export function localToUtcMs(dateIso: string, time: string, timeZone: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - offsetMs(wall, timeZone);
  guess = wall - offsetMs(guess, timeZone);
  return guess;
}

/** The zone's UTC offset at a given instant, in ms (positive east of Greenwich). */
function offsetMs(utcMs: number, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  } catch {
    return 0; // unknown zone: treat as UTC
  }
}

/** Today's date (YYYY-MM-DD) and current time (HH:MM) at a destination. */
export function nowAt(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
  } catch {
    const iso = new Date().toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}
