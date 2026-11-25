"use client";

import { History, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";

export interface RecentItem {
  slug: string;
  name: string;
  kind: "place" | "destination";
  image: string | null;
  subtitle: string;
  at: number;
}

const KEY = "wf-recent-v1";

export function readRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function TrackView({ item }: { item: Omit<RecentItem, "at"> }) {
  useEffect(() => {
    try {
      const list = readRecent().filter((r) => !(r.slug === item.slug && r.kind === item.kind));
      list.unshift({ ...item, at: Date.now() });
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug, item.kind]);
  return null;
}

export function RecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => setItems(readRecent()), []);
  if (!items.length) return null;
  return (
    <section className="container-page mt-16">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <History className="size-5 text-muted" /> Recently viewed
        </h2>
        <button
          className="flex items-center gap-1 text-xs text-muted hover:text-ink"
          onClick={() => {
            localStorage.removeItem(KEY);
            setItems([]);
          }}
        >
          <X className="size-3.5" /> Clear
        </button>
      </div>
      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
        {items.map((r) => (
          <Link key={`${r.kind}-${r.slug}`} href={r.kind === "place" ? `/place/${r.slug}` : `/destinations/${r.slug}`} className="card flex w-64 shrink-0 items-center gap-3 p-2.5 hover:shadow-lift">
            <SmartImage image={r.image} alt={r.name} width={330} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{r.name}</div>
              <div className="truncate text-xs text-muted">{r.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
