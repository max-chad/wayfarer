import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useT, translateList, type Locale } from "@/lib/locale-core";
import { CookieSettingsLink } from "./CookieBanner";
import { LogoMark } from "./Logo";

export function SiteFooter({ ai, locale }: { ai: { provider: string; label: string }; locale: Locale }) {
  const t = useT(locale);
  const COLS = [
    { title: t("footer.explore"), hrefs: ["/destinations", "/map", "/search?q=hidden+gems", "/match", "/leaderboard"], labels: translateList(locale, "footer.exploreLinks") },
    { title: t("footer.plan"), hrefs: ["/plan", "/concierge", "/trips", "/bookings", "/tools", "/pricing"], labels: translateList(locale, "footer.planLinks") },
    { title: t("footer.business"), hrefs: ["/business", "/business/claim", "/business#advertise", "/developers"], labels: translateList(locale, "footer.businessLinks") },
    { title: t("footer.wayfarer"), hrefs: ["/about", "/how-we-make-money", "/trust", "/legal/ai", "/review"], labels: translateList(locale, "footer.wayfarerLinks") },
  ];
  const LEGAL: [string, string][] = ["/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/guidelines", "/legal/business-terms"].map((href, i) => [href, translateList(locale, "footer.legal")[i] ?? href]);
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
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t("footer.tagline")}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-ink-2">
            <span className={`size-2 rounded-full ${ai.provider === "claude" ? "bg-brand-500" : "bg-sun-400"}`} />
            <Sparkles className="size-3.5 text-coral-500" />
            {t("footer.ai", { label: ai.label })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{c.title}</div>
              <ul className="space-y-2">
                {c.labels.map((label, j) => (
                  <li key={label}>
                    <Link href={c.hrefs[j]} className="text-sm text-ink-2 hover:text-brand-600 dark:hover:text-brand-400">
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
            <p>{t("footer.copy", { year: new Date().getFullYear() })}</p>
            <nav className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legal">
              {LEGAL.map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-ink hover:underline">
                  {label}
                </Link>
              ))}
              <CookieSettingsLink className="hover:text-ink hover:underline" />
            </nav>
          </div>
          <p>{t("footer.attributions")}</p>
        </div>
      </div>
    </footer>
  );
}
