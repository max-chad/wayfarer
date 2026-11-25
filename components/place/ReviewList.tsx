"use client";

import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewCard } from "@/components/review/ReviewCard";
import type { Review } from "@/lib/types";
import { TRIP_TYPE_LABELS } from "@/lib/utils";

interface Page {
  items: Review[];
  total: number;
  page: number;
  pages: number;
}

export function ReviewList({ placeId, distribution, tripTypes, hasForeign }: { placeId: number; distribution: { rating: number; n: number }[]; tripTypes: { tripType: string; n: number }[]; hasForeign: boolean }) {
  const [rating, setRating] = useState<number[]>([]);
  const [trip, setTrip] = useState<string[]>([]);
  const [lang, setLang] = useState<"all" | "en" | "other">("all");
  const [season, setSeason] = useState("");
  const [photos, setPhotos] = useState(false);
  const [sort, setSort] = useState("recent");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [rating, trip, lang, season, photos, sort, qDebounced]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort, lang });
    if (rating.length) params.set("rating", rating.join(","));
    if (trip.length) params.set("trip", trip.join(","));
    if (season) params.set("season", season);
    if (photos) params.set("photos", "1");
    if (qDebounced) params.set("q", qDebounced);
    const r = await fetch(`/api/places/${placeId}/reviews?${params}`);
    setData(await r.json());
    setLoading(false);
  }, [placeId, page, sort, lang, rating, trip, season, photos, qDebounced]);

  useEffect(() => {
    load();
  }, [load]);

  // allow the rating overview bars to filter this list
  useEffect(() => {
    const onFilter = (e: Event) => {
      const r = (e as CustomEvent<number>).detail;
      setRating((cur) => (cur.length === 1 && cur[0] === r ? [] : [r]));
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("wf-filter-rating", onFilter);
    return () => window.removeEventListener("wf-filter-rating", onFilter);
  }, []);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div ref={topRef} className="scroll-mt-32">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews — e.g. “breakfast”, “noise”, “view”" className="input pl-10" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {distribution.map((d) => (
            <button key={d.rating} onClick={() => toggle(rating, d.rating, setRating)} className="chip text-xs" data-active={rating.includes(d.rating)}>
              {d.rating}★ <span className="opacity-60">{d.n}</span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {tripTypes.map((t) => (
            <button key={t.tripType} onClick={() => toggle(trip, t.tripType, setTrip)} className="chip text-xs" data-active={trip.includes(t.tripType)}>
              {TRIP_TYPE_LABELS[t.tripType]} <span className="opacity-60">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={season} onChange={(e) => setSeason(e.target.value)} className="input w-auto py-1.5 text-sm" aria-label="Time of year">
            <option value="">Any time of year</option>
            <option value="spring">Mar–May</option>
            <option value="summer">Jun–Aug</option>
            <option value="autumn">Sep–Nov</option>
            <option value="winter">Dec–Feb</option>
          </select>
          {hasForeign && (
            <select value={lang} onChange={(e) => setLang(e.target.value as "all")} className="input w-auto py-1.5 text-sm" aria-label="Language">
              <option value="all">All languages</option>
              <option value="en">English</option>
              <option value="other">Other languages</option>
            </select>
          )}
          <button onClick={() => setPhotos((p) => !p)} className="chip text-xs" data-active={photos}>
            📷 With photos
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input ml-auto w-auto py-1.5 text-sm" aria-label="Sort reviews">
            <option value="recent">Most recent</option>
            <option value="helpful">Most helpful</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>
      </div>

      <div className="relative mt-2 min-h-40">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-start justify-center bg-bg/40 pt-10">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        )}
        {data && data.items.length === 0 && !loading && <p className="py-12 text-center text-muted">No reviews match these filters.</p>}
        {data?.items.map((r) => (
          <ReviewCard key={r.id} review={r} highlight={qDebounced} onDeleted={load} />
        ))}
      </div>

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted">
            {(data.page - 1) * 8 + 1}–{Math.min(data.total, data.page * 8)} of {data.total}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline btn-icon" aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, data.pages - 4));
              const n = start + i;
              return (
                <button key={n} onClick={() => setPage(n)} className="chip min-w-9 justify-center" data-active={n === page}>
                  {n}
                </button>
              );
            })}
            <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-icon" aria-label="Next page">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RatingBarButton({ rating, n, total }: { rating: number; n: number; total: number }) {
  return (
    <button onClick={() => window.dispatchEvent(new CustomEvent("wf-filter-rating", { detail: rating }))} className="group flex w-full items-center gap-3 text-sm" title={`Show ${rating}-star reviews`}>
      <span className="w-12 text-left text-muted group-hover:text-ink">{["", "Terrible", "Poor", "Average", "Very good", "Excellent"][rating]}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-brand-500 transition-all group-hover:bg-brand-600" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
      </div>
      <span className="w-10 text-right text-muted">{n}</span>
    </button>
  );
}
