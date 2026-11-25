"use client";

import { Heart } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

export function SaveButton({ placeId, name, variant = "overlay", className = "" }: { placeId: number; name?: string; variant?: "overlay" | "button"; className?: string }) {
  const { isSaved, toggleSave } = useApp();
  const saved = isSaved(placeId);
  if (variant === "button") {
    return (
      <button onClick={() => toggleSave(placeId, name)} className={cn("btn btn-outline", className)} aria-pressed={saved}>
        <Heart className={cn("size-4", saved && "fill-coral-500 text-coral-500")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(placeId, name);
      }}
      aria-label={saved ? "Remove from saved" : "Save"}
      aria-pressed={saved}
      className={cn("grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-transform hover:scale-110 dark:bg-black/60 dark:text-white", className)}
    >
      <Heart className={cn("size-[18px]", saved && "fill-coral-500 text-coral-500")} />
    </button>
  );
}
