import { Sparkles } from "lucide-react";
import Link from "next/link";
import { CookieSettingsLink } from "./CookieBanner";
import { LogoMark } from "./Logo";

const COLS = [
  {
    title: "Explore",
    links: [
      ["/destinations", "All destinations"],
      ["/map", "Explore map"],
      ["/search?q=hidden+gems", "Hidden gems"],
      ["/match", "Destination matcher"],
      ["/leaderboard", "Top contributors"],
    ],
  },
  {
    title: "Plan",
    links: [
      ["/plan", "AI trip planner"],
      ["/concierge", "Travel concierge"],
      ["/trips", "My trips"],
      ["/bookings", "My bookings"],
      ["/tools", "Travel tools"],
      ["/pricing", "Wayfarer Plus"],
    ],
  },
  {
    title: "Business",
    links: [
      ["/business", "Wayfarer for Business"],
      ["/business/claim", "Claim your listing"],
      ["/business#advertise", "Sponsored listings"],
      ["/developers", "Developer API"],
    ],
  },
  {
    title: "Wayfarer",
    links: [
      ["/about", "How it works"],
      ["/how-we-make-money", "How we make money"],
      ["/trust", "Trust & transparency"],
      ["/legal/ai", "AI transparency"],
      ["/review", "Write a review"],
    ],
  },
];

const LEGAL = [
  ["/legal/terms", "Terms"],
  ["/legal/privacy", "Privacy"],
  ["/legal/cookies", "Cookies"],
  ["/legal/guidelines", "Review guidelines"],
  ["/legal/business-terms", "Business terms"],
];

export function SiteFooter({ ai }: { ai: { provider: string; label: string } }) {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.3fr_2.7fr]">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-xl font-semibold">
              wayfarer<span className="text-coral-500">.</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            An AI-native travel advisor. Honest reviews summarised in seconds, itineraries that respect geography, and a concierge that knows every
            neighbourhood.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-ink-2">
            <span className={`size-2 rounded-full ${ai.provider === "claude" ? "bg-brand-500" : "bg-sun-400"}`} />
            <Sparkles className="size-3.5 text-coral-500" />
            AI: {ai.label}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{c.title}</div>
              <ul className="space-y-2">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-ink-2 hover:text-brand-600 dark:hover:text-brand-400">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p>
              © {new Date().getFullYear()} Wayfarer demo. Hotels, restaurants, tours, partners and all reviews are fictional sample data generated for demonstration.
            </p>
            <nav className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legal">
              {LEGAL.map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-ink hover:underline">
                  {label}
                </Link>
              ))}
              <CookieSettingsLink className="hover:text-ink hover:underline" />
            </nav>
          </div>
          <p>
            Landmark info &amp; photos: Wikipedia / Wikimedia Commons (CC BY-SA and others) · Weather: Open-Meteo · Maps: © OpenStreetMap contributors
          </p>
        </div>
      </div>
    </footer>
  );
}
