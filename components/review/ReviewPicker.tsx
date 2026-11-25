"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { PlaceCardData } from "@/lib/types";
import { TYPE_LABELS } from "@/lib/utils";

export function ReviewPicker() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PlaceCardData[]>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(q)}&limit=8&sort=reviews`)
        .then((r) => r.json())
        .then((j) => setItems(j.items || []));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search for a hotel, restaurant or attraction…" className="input py-4 pl-12 text-lg" />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((p) => (
          <Link key={p.id} href={`/place/${p.slug}/review`} className="card flex items-center gap-3 p-3 hover:shadow-lift">
            <SmartImage image={p.image} alt="" width={330} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="truncate text-sm text-muted">
                {TYPE_LABELS[p.type].singular} · {p.category} · {p.destinationName}
              </div>
            </div>
            <span className="btn btn-outline btn-sm">Review</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
