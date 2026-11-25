"use client";

import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ImageRef } from "@/lib/types";
import { cn, imgUrl } from "@/lib/utils";

/** Remote image with graceful fallback and optional licence credit. */
export function SmartImage({
  image,
  alt,
  width = 960,
  className = "",
  imgClassName = "",
  credit = false,
  priority = false,
  children,
}: {
  image: ImageRef | string | null | undefined;
  alt: string;
  width?: 330 | 500 | 960 | 1280;
  className?: string;
  imgClassName?: string;
  credit?: boolean;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = imgUrl(image, width);
  // An image can finish loading before hydration attaches onLoad/onError — check on mount.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete) {
      if (el.naturalWidth > 0) setLoaded(true);
      else if (el.currentSrc) setFailed(true);
    }
  }, [src]);
  const ref = typeof image === "object" && image ? image : null;
  return (
    <div className={cn("img-fallback relative overflow-hidden", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted/60">
          <Camera className="size-8" />
        </div>
      )}
      {children}
      {credit && ref && !failed && (
        <a
          href={ref.source}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-1.5 max-w-[70%] truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90 opacity-70 backdrop-blur hover:opacity-100"
          title={`Photo: ${ref.author} · ${ref.license} · Wikimedia Commons`}
          onClick={(e) => e.stopPropagation()}
        >
          📷 {ref.author} · {ref.license}
        </a>
      )}
    </div>
  );
}
