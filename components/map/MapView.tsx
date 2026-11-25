"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef } from "react";

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
  image?: string | null;
  label?: string | number;
  color?: string;
  rating?: number;
}

export interface MapPolyline {
  points: [number, number][];
  color: string;
  dashed?: boolean;
}

export const TYPE_COLORS: Record<string, string> = {
  hotel: "#7c3aed",
  restaurant: "#ea580c",
  attraction: "#0f766e",
  experience: "#db2777",
  destination: "#11463b",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function MapView({
  markers,
  polylines = [],
  center,
  zoom = 13,
  className = "h-80",
  activeId,
  onMarkerClick,
  fit = true,
  scrollWheelZoom = false,
}: {
  markers: MapMarker[];
  polylines?: MapPolyline[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  activeId?: string | number | null;
  onMarkerClick?: (id: string | number) => void;
  fit?: boolean;
  scrollWheelZoom?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const tileRef = useRef<Leaflet.TileLayer | null>(null);
  const markerRefs = useRef(new Map<string | number, Leaflet.Marker>());
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  // init
  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, { zoomControl: true, scrollWheelZoom, attributionControl: true }).setView(center || [20, 0], center ? zoom : 2);
      mapRef.current = map;
      // OpenStreetMap standard tiles (no key); dark mode is handled with a CSS filter on the tile pane.
      tileRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      // Leaflet measures its container once; keep it in sync with layout changes.
      resizeObs = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resizeObs.observe(el.current);
      setTimeout(() => map.invalidateSize({ pan: false }), 60);
      draw();
    })();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    markerRefs.current.clear();
    for (const pl of polylines) {
      if (pl.points.length > 1) L.polyline(pl.points, { color: pl.color, weight: 3.5, opacity: 0.8, dashArray: pl.dashed ? "6 8" : undefined }).addTo(layer);
    }
    for (const m of markers) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="wf-marker" data-active="${m.id === activeId}" style="background:${m.color || "#0f766e"}">${m.label != null ? esc(String(m.label)) : "•"}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });
      const popup = `<div style="display:flex;gap:10px;align-items:center;min-width:190px">${
        m.image ? `<img src="${esc(m.image)}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:8px" referrerpolicy="no-referrer"/>` : ""
      }<div><div style="font-weight:600;line-height:1.25">${m.href ? `<a href="${esc(m.href)}" style="color:inherit">${esc(m.title)}</a>` : esc(m.title)}</div>${
        m.subtitle ? `<div style="font-size:12px;opacity:.7;margin-top:2px">${esc(m.subtitle)}</div>` : ""
      }${m.rating ? `<div style="font-size:12px;margin-top:2px">★ ${m.rating.toFixed(1)}</div>` : ""}</div></div>`;
      const mk = L.marker([m.lat, m.lng], { icon, title: m.title, riseOnHover: true }).bindPopup(popup).addTo(layer);
      mk.on("click", () => clickRef.current?.(m.id));
      markerRefs.current.set(m.id, mk);
    }
    if (fit && markers.length) {
      const pts = [...markers.map((m) => [m.lat, m.lng] as [number, number]), ...polylines.flatMap((p) => p.points)];
      if (pts.length === 1) map.setView(pts[0], zoom);
      else map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 15 });
    } else if (center) map.setView(center, zoom);
  };

  // redraw when data changes
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers.map((m) => [m.id, m.lat, m.lng, m.label, m.color])), JSON.stringify(polylines)]);

  // highlight active marker
  useEffect(() => {
    markerRefs.current.forEach((mk, id) => {
      const node = mk.getElement()?.querySelector(".wf-marker");
      if (node) node.setAttribute("data-active", String(id === activeId));
    });
    if (activeId != null) {
      const mk = markerRefs.current.get(activeId);
      if (mk && mapRef.current) mapRef.current.panTo(mk.getLatLng(), { animate: true });
    }
  }, [activeId]);

  return <div ref={el} className={`relative z-0 overflow-hidden rounded-2xl border border-line ${className}`} />;
}
