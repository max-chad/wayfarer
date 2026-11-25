"use client";

import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProviders";
import { translateList } from "@/lib/locale-core";

export function HeroPrompts() {
  const { openChat, locale } = useApp();
  const SEARCHES = translateList(locale, "home.heroSearches");
  const ASKS = translateList(locale, "home.heroAsks");
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {SEARCHES.map((s) => (
        <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip bg-surface/80 backdrop-blur hover:border-brand-400">
          <Search className="size-3.5 text-muted" />
          {s}
        </Link>
      ))}
      {ASKS.map((s) => (
        <button key={s} onClick={() => openChat(s)} className="chip border-brand-200 bg-brand-50/80 text-brand-800 backdrop-blur hover:border-brand-400 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
          <MessageCircle className="size-3.5" />
          {s}
        </button>
      ))}
    </div>
  );
}

export function AskButton({ prompt, children, className = "btn btn-outline" }: { prompt: string; children: React.ReactNode; className?: string }) {
  const { openChat } = useApp();
  return (
    <button onClick={() => openChat(prompt)} className={className}>
      {children}
    </button>
  );
}
