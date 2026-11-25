import { Bot, CloudSun, Map, Route, Search, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { aiStatus } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "AI travel concierge" };

export default function ConciergePage() {
  const ai = aiStatus();
  return (
    <div className="container-page grid gap-8 pt-6 lg:grid-cols-[280px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-5">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Travel concierge</h1>
            <p className="mt-2 text-sm text-muted">A 24/7 travel advisor grounded in Wayfarer&apos;s places, reviews, weather and planner.</p>
          </div>
          <div className="card space-y-3 p-4 text-sm">
            {[
              [Search, "Finds real places", "Hotels, restaurants, sights & tours — with ratings from reviews."],
              [Route, "Plans itineraries", "Day-by-day plans you can open, edit and save."],
              [CloudSun, "Checks the weather", "Live 7-day forecasts and monthly climate."],
              [Wallet, "Knows the costs", "Daily budgets, local prices and live currency rates."],
              [Map, "Compares destinations", "Side-by-side answers when you can't decide."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Search;
              return (
                <div key={t as string} className="flex gap-3">
                  <I className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  <div>
                    <div className="font-semibold">{t as string}</div>
                    <div className="text-xs text-muted">{d as string}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-muted">
            <Bot className="size-4" /> Powered by {ai.label}
          </div>
          <p className="text-xs text-muted">Tip: press Ctrl/⌘ K anywhere on Wayfarer to open the concierge. Voice input works in Chrome & Edge.</p>
        </div>
      </aside>
      <div className="h-[calc(100vh-7.5rem)] min-h-[520px]">
        <ChatPanel />
      </div>
    </div>
  );
}
