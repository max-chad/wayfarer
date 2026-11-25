import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/data/billing";
import { getTrip } from "@/lib/data/trips";
import { slugify } from "@/lib/utils";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** GPX export (waypoints + one route per day) for offline map apps. A Wayfarer Plus feature. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const trip = getTrip(Number(id));
  if (!trip || (!trip.isPublic && trip.userId !== user?.id)) return new Response("Not found", { status: 404 });
  if (!user || getPlan(user.id) !== "plus") return Response.json({ error: "GPX export is a Wayfarer Plus feature.", upgrade: true }, { status: 402 });

  const stops = trip.items.filter((i) => i.place).sort((a, b) => a.day - b.day || a.position - b.position);
  const wpt = stops
    .map((i) => `  <wpt lat="${i.place!.lat}" lon="${i.place!.lng}"><name>${esc(i.place!.name)}</name><desc>${esc(`Day ${i.day}${i.startTime ? ` · ${i.startTime}` : ""} · ${i.place!.category}`)}</desc><type>${i.place!.type}</type></wpt>`)
    .join("\n");
  const days = [...new Set(stops.map((s) => s.day))];
  const rte = days
    .map(
      (d) =>
        `  <rte><name>${esc(`Day ${d}`)}</name>\n${stops
          .filter((s) => s.day === d)
          .map((s) => `    <rtept lat="${s.place!.lat}" lon="${s.place!.lng}"><name>${esc(s.place!.name)}</name></rtept>`)
          .join("\n")}\n  </rte>`
    )
    .join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wayfarer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(trip.title)}</name><time>${new Date().toISOString()}</time></metadata>
${wpt}
${rte}
</gpx>
`;
  return new Response(gpx, {
    headers: { "content-type": "application/gpx+xml; charset=utf-8", "content-disposition": `attachment; filename="${slugify(trip.title) || "trip"}.gpx"` },
  });
}
