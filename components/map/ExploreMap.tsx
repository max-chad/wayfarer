"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { List, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaceType } from "@/lib/types";
import { cn, TYPE_LABELS } from "@/lib/utils";
import { TYPE_COLORS } from "./LazyMap";

interface Dest {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  rating: number;
}
interface P {
  id: number;
  slug: string;
  name: string;
  type: PlaceType;
  category: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  image: string | null;
  destinationName: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function ExploreMap({ destinations, places }: { destinations: Dest[]; places: P[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerRefs = useRef(new Map<number, Leaflet.Marker>());
  const [zoom, setZoom] = useState(2);
  const [bounds, setBounds] = useState<Leaflet.LatLngBounds | null>(null);
  const [types, setTypes] = useState<Set<PlaceType>>(new Set(["attraction", "hotel", "restaurant", "experience"]));
  const [minRating, setMinRating] = useState(0);
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const DETAIL_ZOOM = 10;

  const filtered = useMemo(() => places.filter((p) => types.has(p.type) && p.rating >= minRating), [places, types, minRating]);
  const visible = useMemo(() => (bounds && zoom >= DETAIL_ZOOM ? filtered.filter((p) => bounds.contains([p.lat, p.lng])).sort((a, b) => b.rating - a.rating) : []), [filtered, bounds, zoom]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, { worldCopyJump: true, minZoom: 2 }).setView([25, 10], 2);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      const sync = () => {
        setZoom(map.getZoom());
        setBounds(map.getBounds());
      };
      map.on("moveend zoomend", sync);
      sync();
      ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      ro.observe(el.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // draw markers for current zoom level
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    markerRefs.current.clear();
    if (zoom < DETAIL_ZOOM) {
      for (const d of destinations) {
        const size = 34 + Math.min(20, d.count / 3);
        const icon = L.divIcon({
          className: "",
          html: `<div class="wf-marker" style="width:${size}px;height:${size}px;background:#11463b;font-size:11px;flex-direction:column;line-height:1">${d.count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([d.lat, d.lng], { icon, title: d.name })
          .bindTooltip(`<strong>${esc(d.name)}</strong><br/>${d.count} places · ★ ${d.rating.toFixed(1)}`, { direction: "top", offset: [0, -size / 2] })
          .on("click", () => map.flyTo([d.lat, d.lng], 13, { duration: 1.2 }))
          .addTo(layer);
      }
    } else {
      for (const p of filtered) {
        const icon = L.divIcon({
          className: "",
          html: `<div class="wf-marker" style="background:${TYPE_COLORS[p.type]}">${p.type === "hotel" ? "H" : p.type === "restaurant" ? "R" : p.type === "experience" ? "E" : "★"}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -14],
        });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name, riseOnHover: true })
          .bindPopup(
            `<div style="display:flex;gap:10px;align-items:center;min-width:200px">${p.image ? `<img src="${esc(p.image)}" style="width:56px;height:56px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer"/>` : ""}<div><a href="/place/${esc(p.slug)}" style="font-weight:600;color:inherit">${esc(p.name)}</a><div style="font-size:12px;opacity:.7">${esc(p.category)}</div><div style="font-size:12px">★ ${p.rating.toFixed(1)} (${p.reviewCount})</div></div></div>`
          )
          .addTo(layer);
        markerRefs.current.set(p.id, m);
      }
    }
  }, [zoom >= DETAIL_ZOOM, filtered, destinations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    markerRefs.current.forEach((m, id) => m.getElement()?.querySelector(".wf-marker")?.setAttribute("data-active", String(id === hover)));
  }, [hover]);

  const jump = (d: Dest) => {
    mapRef.current?.flyTo([d.lat, d.lng], 13, { duration: 1.2 });
    setQ("");
  };
  const matches = q.trim().length > 1 ? destinations.filter((d) => `${d.name} ${d.country}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div ref={el} className="absolute inset-0 z-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 p-3">
        <div className="pointer-events-auto relative w-72">
          <div className="card flex items-center gap-2 px-3 py-2">
            <Search className="size-4 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a destination…" className="w-full bg-transparent text-sm outline-none" />
          </div>
          {matches.length > 0 && (
            <div className="card absolute mt-1 w-full p-1">
              {matches.map((d) => (
                <button key={d.slug} onClick={() => jump(d)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                  <strong>{d.name}</strong> <span className="text-muted">{d.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card pointer-events-auto flex flex-wrap items-center gap-1.5 p-1.5">
          {(["attraction", "hotel", "restaurant", "experience"] as PlaceType[]).map((t) => (
            <button
              key={t}
              onClick={() =>
                setTypes((s) => {
                  const n = new Set(s);
                  if (n.has(t)) n.delete(t);
                  else n.add(t);
                  return n;
                })
              }
              className="chip py-1.5 text-xs"
              data-active={types.has(t)}
            >
              <span className="size-2 rounded-full" style={{ background: TYPE_COLORS[t] }} /> {TYPE_LABELS[t].plural}
            </button>
          ))}
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="rounded-full border border-line bg-surface px-2 py-1.5 text-xs" aria-label="Minimum rating">
            <option value={0}>Any rating</option>
            <option value={4}>★ 4.0+</option>
            <option value={4.5}>★ 4.5+</option>
          </select>
        </div>
      </div>

      {zoom < DETAIL_ZOOM && (
        <div className="card pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 px-4 py-2 text-sm">Click a destination bubble to explore its places</div>
      )}

      {zoom >= DETAIL_ZOOM && (
        <div className={cn("absolute bottom-24 right-3 top-20 z-10 flex w-80 flex-col transition-transform", !listOpen && "translate-x-[calc(100%+12px)]")}>
          <button onClick={() => setListOpen((o) => !o)} className="card absolute -left-12 top-0 grid size-10 place-items-center" aria-label="Toggle list">
            {listOpen ? <X className="size-4" /> : <List className="size-4" />}
          </button>
          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">{visible.length} places in view</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {visible.slice(0, 60).map((p) => (
                <Link
                  key={p.id}
                  href={`/place/${p.slug}`}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2"
                >
                  {p.image ? <img src={p.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <div className="img-fallback size-12 shrink-0 rounded-lg" />}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted">
                      <span className="mr-1 inline-block size-2 rounded-full" style={{ background: TYPE_COLORS[p.type] }} />
                      {p.category} · ★ {p.rating.toFixed(1)}
                    </div>
                  </div>
                </Link>
              ))}
              {!visible.length && <p className="p-4 text-center text-sm text-muted">Nothing here — zoom out or change filters.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
