"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

export const NAV: { href: string; key: string; ai?: boolean }[] = [
  { href: "/destinations", key: "destinations" },
  { href: "/plan", key: "plan", ai: true },
  { href: "/concierge", key: "concierge", ai: true },
  { href: "/map", key: "map" },
  { href: "/trips", key: "trips" },
];

export function NavLinks() {
  const path = usePathname();
  const { t } = useApp();
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {n.ai && <Sparkles className="size-3.5 text-coral-500" />}
            {t(`nav.${n.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
