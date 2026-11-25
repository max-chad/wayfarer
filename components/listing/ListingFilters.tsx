"use client";

import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn, titleCase } from "@/lib/utils";

interface Facet {
  value: string;
  n: number;
}

export function ListingFilters({
  tags,
  amenities,
  categories,
  showAmenities,
  destinationName,
  typeLabel,
}: {
  tags: Facet[];
  amenities: Facet[];
  categories: Facet[];
  showAmenities: boolean;
  destinationName: string;
  typeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ai, setAi] = useState("");

  const getList = (k: string) => sp.get(k)?.split(",").filter(Boolean) || [];
  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const toggleIn = (k: string, v: string) => {
    const cur = getList(k);
    update(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };
  const active = ["price", "rating", "tags", "amenities", "category"].some((k) => sp.get(k));

  const body = (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ai.trim()) router.push(`/search?q=${encodeURIComponent(`${ai} ${typeLabel.toLowerCase()} in ${destinationName}`)}`);
        }}
        className="ai-border p-3"
      >
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5 text-coral-500" /> Describe what you want
        </label>
        <input value={ai} onChange={(e) => setAi(e.target.value)} placeholder="e.g. quiet, near the river, good breakfast" className="mt-2 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
      </form>

      <div>
        <div className="label">Traveler rating</div>
        <div className="flex flex-wrap gap-1.5">
          {["4.5", "4", "3.5"].map((r) => (
            <button key={r} onClick={() => update("rating", sp.get("rating") === r ? null : r)} className="chip" data-active={sp.get("rating") === r}>
              ★ {r}+
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label">Price</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((p) => (
            <button key={p} onClick={() => toggleIn("price", String(p))} className="chip" data-active={getList("price").includes(String(p))}>
              {"$".repeat(p)}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div>
          <div className="label">Type</div>
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 10).map((c) => (
              <button key={c.value} onClick={() => update("category", sp.get("category") === c.value ? null : c.value)} className="chip text-xs" data-active={sp.get("category") === c.value}>
                {c.value} <span className="opacity-50">{c.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showAmenities && amenities.length > 0 && (
        <div>
          <div className="label">Amenities</div>
          <div className="space-y-1.5">
            {amenities.slice(0, 10).map((a) => (
              <label key={a.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={getList("amenities").includes(a.value)} onChange={() => toggleIn("amenities", a.value)} className="size-4 accent-brand-600" />
                {a.value}
                <span className="ml-auto text-xs text-muted">{a.n}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="label">Good for</div>
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 14).map((t) => (
            <button key={t.value} onClick={() => toggleIn("tags", t.value)} className="chip text-xs" data-active={getList("tags").includes(t.value)}>
              {titleCase(t.value)}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <button onClick={() => router.push(pathname)} className="flex items-center gap-1 text-sm font-semibold text-coral-600 hover:underline">
          <X className="size-4" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <button onClick={() => setMobileOpen(true)} className={cn("btn btn-outline", active && "border-brand-500")}>
          <SlidersHorizontal className="size-4" /> Filters{active ? " •" : ""}
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-[70] flex items-end bg-black/40" onClick={() => setMobileOpen(false)}>
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-xl font-semibold">Filters</span>
                <button onClick={() => setMobileOpen(false)} className="btn btn-dark btn-sm">
                  Done
                </button>
              </div>
              {body}
            </div>
          </div>
        )}
      </div>
      <aside className="hidden lg:block">{body}</aside>
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set("sort", e.target.value);
        router.push(`${pathname}?${next}`, { scroll: false });
      }}
      className="input w-auto py-2 text-sm"
      aria-label="Sort by"
    >
      <option value="ranking">Traveler ranking</option>
      <option value="rating">Highest rated</option>
      <option value="reviews">Most reviewed</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
    </select>
  );
}
