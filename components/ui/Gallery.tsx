"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ImageRef } from "@/lib/types";
import { cn, imgUrl } from "@/lib/utils";
import { SmartImage } from "./SmartImage";

export function Gallery({ images, alt, className = "", children }: { images: ImageRef[]; alt: string; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = images.length;
  const prev = useCallback(() => setOpen((i) => (i == null ? i : (i - 1 + n) % n)), [n]);
  const next = useCallback(() => setOpen((i) => (i == null ? i : (i + 1) % n)), [n]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, prev, next]);

  if (!n) {
    return <div className={cn("img-fallback rounded-3xl", className)}>{children}</div>;
  }

  const main = images[0];
  const side = images.slice(1, 5);
  return (
    <>
      <div className={cn("relative grid gap-2 overflow-hidden rounded-3xl", side.length >= 2 ? "md:grid-cols-[2fr_1fr]" : "", className)}>
        <button onClick={() => setOpen(0)} className="relative h-full min-h-64 overflow-hidden" aria-label="Open photo gallery">
          <SmartImage image={main} alt={alt} width={1280} className="absolute inset-0 h-full w-full" priority credit />
          {children}
        </button>
        {side.length >= 2 && (
          <div className="hidden grid-cols-2 grid-rows-2 gap-2 md:grid">
            {side.slice(0, 4).map((img, i) => (
              <button key={img.url} onClick={() => setOpen(i + 1)} className={cn("relative overflow-hidden", side.length === 2 && "col-span-2", side.length === 3 && i === 0 && "col-span-2")}>
                <SmartImage image={img} alt={`${alt} photo ${i + 2}`} width={500} className="absolute inset-0 h-full w-full" imgClassName="transition-transform duration-500 hover:scale-105" />
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(0)} className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow backdrop-blur dark:bg-black/70 dark:text-white">
          <Images className="size-3.5" /> {n} photo{n > 1 ? "s" : ""}
        </button>
      </div>

      {open != null && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal aria-label="Photo viewer">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm opacity-80">
              {open + 1} / {n}
            </span>
            <button onClick={() => setOpen(null)} className="btn btn-icon text-white hover:bg-white/10" aria-label="Close">
              <X className="size-6" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-4">
            <button onClick={prev} className="absolute left-2 z-10 rounded-full bg-white/10 p-3 hover:bg-white/20" aria-label="Previous photo">
              <ChevronLeft className="size-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(images[open], 1280)!} alt={`${alt} photo ${open + 1}`} className="max-h-[78vh] max-w-full rounded-lg object-contain" referrerPolicy="no-referrer" />
            <button onClick={next} className="absolute right-2 z-10 rounded-full bg-white/10 p-3 hover:bg-white/20" aria-label="Next photo">
              <ChevronRight className="size-6" />
            </button>
          </div>
          <div className="p-4 text-center text-xs opacity-75">
            Photo: {images[open].author} · {images[open].license} ·{" "}
            <a href={images[open].source} target="_blank" rel="noopener noreferrer" className="underline">
              Wikimedia Commons
            </a>
          </div>
          <div className="scrollbar-none flex justify-center gap-2 overflow-x-auto px-4 pb-4">
            {images.map((img, i) => (
              <button key={img.url} onClick={() => setOpen(i)} className={cn("size-14 shrink-0 overflow-hidden rounded-md border-2", i === open ? "border-white" : "border-transparent opacity-60")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(img, 330)!} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
