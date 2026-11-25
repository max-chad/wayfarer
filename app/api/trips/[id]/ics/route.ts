import { getCurrentUser } from "@/lib/auth";
import { getTrip } from "@/lib/data/trips";
import { slugify } from "@/lib/utils";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

function stamp(date: Date, minutes: number) {
  const d = new Date(date.getTime() + minutes * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const trip = getTrip(Number(id));
  if (!trip || (!trip.isPublic && trip.userId !== user?.id)) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  // Floating local times: calendars show them in the traveller's current timezone, i.e. the destination's.
  const start = trip.startDate ? new Date(trip.startDate + "T00:00:00Z") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wayfarer//AI Travel Advisor//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(trip.title)}`,
  ];
  const dateOnly = (d: Date) => stamp(d, 0).slice(0, 8);
  for (const item of trip.items) {
    const dayStart = new Date(start.getTime() + (item.day - 1) * 86400000);
    let when: string[];
    if (item.position < 0) {
      // hotel: one all-day event spanning the whole stay
      when = [`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly(new Date(start.getTime() + trip.days * 86400000))}`];
    } else if (item.startTime) {
      const [h, m] = item.startTime.split(":").map(Number);
      when = [`DTSTART:${stamp(dayStart, h * 60 + m)}`, `DTEND:${stamp(dayStart, h * 60 + m + (item.durationMin || 60))}`];
    } else {
      // untimed stop: all-day event on its day
      when = [`DTSTART;VALUE=DATE:${dateOnly(dayStart)}`, `DTEND;VALUE=DATE:${dateOnly(new Date(dayStart.getTime() + 86400000))}`];
    }
    const where = item.place ? `${item.place.name}${item.place.neighborhood ? ", " + item.place.neighborhood : ""}, ${item.place.destinationName}` : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:wayfarer-${trip.id}-${item.id}@wayfarer.local`,
      `DTSTAMP:${stamp(new Date(), 0)}Z`,
      ...when,
      fold(`SUMMARY:${esc(item.position < 0 ? `Stay: ${item.title}` : item.title)}`),
      ...(where ? [fold(`LOCATION:${esc(where)}`)] : []),
      ...(item.place ? [`GEO:${item.place.lat};${item.place.lng}`] : []),
      fold(`DESCRIPTION:${esc([item.note, item.place ? `${origin}/place/${item.place.slug}` : ""].filter(Boolean).join("\n"))}`),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(trip.title) || "trip"}.ics"`,
    },
  });
}
