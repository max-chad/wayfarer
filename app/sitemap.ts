import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL || "http://localhost:3000";
  const conn = db();
  const dests = conn.prepare("SELECT slug FROM destinations").all() as { slug: string }[];
  const places = conn.prepare("SELECT slug FROM places").all() as { slug: string }[];
  const now = new Date();
  return [
    ...["", "/destinations", "/plan", "/concierge", "/match", "/map", "/tools", "/leaderboard", "/about"].map((p) => ({ url: `${base}${p}`, lastModified: now, priority: p === "" ? 1 : 0.7 })),
    ...dests.flatMap((d) => [
      { url: `${base}/destinations/${d.slug}`, lastModified: now, priority: 0.9 },
      ...["hotels", "restaurants", "things-to-do", "experiences"].map((c) => ({ url: `${base}/destinations/${d.slug}/${c}`, lastModified: now, priority: 0.6 })),
    ]),
    ...places.map((p) => ({ url: `${base}/place/${p.slug}`, lastModified: now, priority: 0.5 })),
  ];
}
