"use client";

import { MapPin, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TYPE_LABELS, imgUrl } from "@/lib/utils";
import type { PlaceType } from "@/lib/types";

interface Suggest {
  destinations: { slug: string; name: string; country: string; image: string | null }[];
  places: { slug: string; name: string; type: PlaceType; category: string; rating: number; destination: string; image: string | null }[];
}

export function HeaderSearch({ large = false, autoFocus = false, placeholder }: { large?: boolean; autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest | null>(null);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) setData(await r.json());
      } catch {}
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items: { href: string; kind: "dest" | "place" | "ai" }[] = [
    ...(data?.destinations || []).map((d) => ({ href: `/destinations/${d.slug}`, kind: "dest" as const })),
    ...(data?.places || []).map((p) => ({ href: `/place/${p.slug}`, kind: "place" as const })),
    ...(q.trim() ? [{ href: `/search?q=${encodeURIComponent(q.trim())}`, kind: "ai" as const }] : []),
  ];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) go(items[active].href);
      else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
    } else if (e.key === "Escape") setOpen(false);
  };

  let idx = -1;
  return (
    <div ref={box} className={`relative w-full ${large ? "" : "max-w-md"}`}>
      <div
        className={`flex items-center gap-2 rounded-full border border-line-strong bg-surface transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-400)_22%,transparent)] ${
          large ? "px-5 py-3.5 shadow-lift" : "px-4 py-2"
        }`}
      >
        <Search className={`${large ? "size-5" : "size-4"} shrink-0 text-muted`} />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder || "Search places, cities or ask anything…"}
          className={`w-full bg-transparent outline-none placeholder:text-muted ${large ? "text-lg" : "text-sm"}`}
          aria-label="Search"
          role="combobox"
          aria-expanded={open}
          aria-controls="header-search-list"
        />
        {large && (
          <button onClick={() => q.trim() && go(`/search?q=${encodeURIComponent(q.trim())}`)} className="btn btn-primary">
            <Sparkles className="size-4" /> Search
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div id="header-search-list" className="card absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-auto p-2 animate-fade-up" role="listbox">
          {data?.destinations.length ? <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Destinations</div> : null}
          {data?.destinations.map((d) => {
            idx++;
            const i = idx;
            return (
              <button key={d.slug} onClick={() => go(`/destinations/${d.slug}`)} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active === i ? "bg-surface-2" : ""}`}>
                {d.image ? <img src={imgUrl(d.image, 330)!} alt="" className="size-10 rounded-lg object-cover" /> : <MapPin className="size-5 text-muted" />}
                <div>
                  <div className="text-sm font-semibold">{d.name}</div>
                  <div className="text-xs text-muted">{d.country}</div>
                </div>
              </button>
            );
          })}
          {data?.places.length ? <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Places</div> : null}
          {data?.places.map((p) => {
            idx++;
            const i = idx;
            return (
              <button key={p.slug} onClick={() => go(`/place/${p.slug}`)} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active === i ? "bg-surface-2" : ""}`}>
                {p.image ? <img src={imgUrl(p.image, 330)!} alt="" className="size-10 rounded-lg object-cover" /> : <div className="img-fallback size-10 rounded-lg" />}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {TYPE_LABELS[p.type].singular} · {p.category} · {p.destination} · ★ {p.rating.toFixed(1)}
                  </div>
                </div>
              </button>
            );
          })}
          {(() => {
            idx++;
            const i = idx;
            return (
              <button onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} onMouseEnter={() => setActive(i)} className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${active === i ? "bg-surface-2" : ""}`}>
                <span className="ai-gradient grid size-10 place-items-center rounded-lg text-white">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">Smart search “{q.trim()}”</div>
                  <div className="text-xs text-muted">AI understands vibes, budgets &amp; neighbourhoods</div>
                </div>
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
