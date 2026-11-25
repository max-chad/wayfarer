"use client";

import { GitCompareArrows, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface CompareItem {
  id: number;
  name: string;
  image: string | null;
  type: string;
}

const KEY = "wf-compare-v1";
const EVENT = "wf-compare-change";

export function readCompare(): CompareItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeCompare(items: CompareItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 4)));
  window.dispatchEvent(new Event(EVENT));
}

export function useCompare() {
  const [items, setItems] = useState<CompareItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(readCompare());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return {
    items,
    has: (id: number) => items.some((i) => i.id === id),
    toggle: (item: CompareItem) => {
      const cur = readCompare();
      writeCompare(cur.some((i) => i.id === item.id) ? cur.filter((i) => i.id !== item.id) : [...cur, item].slice(-4));
    },
    remove: (id: number) => writeCompare(readCompare().filter((i) => i.id !== id)),
    clear: () => writeCompare([]),
  };
}

export function CompareTray() {
  const { items, remove, clear } = useCompare();
  const path = usePathname();
  if (!items.length || path.startsWith("/compare")) return null;
  return (
    <div className="no-print fixed bottom-24 left-1/2 z-[54] w-[min(94vw,560px)] -translate-x-1/2 sm:bottom-6">
      <div className="card flex items-center gap-3 p-2.5 pl-4 shadow-lift animate-fade-up">
        <GitCompareArrows className="size-5 shrink-0 text-brand-600" />
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-none">
          {items.map((i) => (
            <span key={i.id} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-2 text-xs">
              {i.image ? <img src={i.image} alt="" className="size-6 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="size-6 rounded-full img-fallback" />}
              <span className="max-w-28 truncate">{i.name}</span>
              <button onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`}>
                <X className="size-3 text-muted" />
              </button>
            </span>
          ))}
        </div>
        <button onClick={clear} className="text-xs text-muted hover:text-ink">
          Clear
        </button>
        <Link href={`/compare?ids=${items.map((i) => i.id).join(",")}`} className={`btn btn-primary btn-sm ${items.length < 2 ? "pointer-events-none opacity-50" : ""}`}>
          Compare ({items.length})
        </Link>
      </div>
    </div>
  );
}
