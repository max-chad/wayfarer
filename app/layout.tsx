import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CompareTray } from "@/components/compare/CompareTray";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AppProviders } from "@/components/providers/AppProviders";
import { aiStatus } from "@/lib/ai/claude";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/data/billing";
import { isBusinessOwner } from "@/lib/data/business";
import { savedPlaceIds } from "@/lib/data/misc";
import { unreadCount } from "@/lib/data/notifications";
import { getLocale } from "@/lib/locale";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: { default: "Wayfarer — your AI travel advisor", template: "%s · Wayfarer" },
  description:
    "Plan smarter trips with AI: honest traveler reviews summarised in seconds, day-by-day itineraries, a 24/7 travel concierge, live weather and budgets for 30+ destinations.",
  applicationName: "Wayfarer",
  keywords: ["travel", "AI trip planner", "hotel reviews", "restaurants", "things to do", "itinerary"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a100e" },
  ],
};

// Applies the saved/OS theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('wf-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const saved = user ? savedPlaceIds(user.id) : [];
  const plan = user ? getPlan(user.id) : "free";
  const unread = user ? unreadCount(user.id) : 0;
  const owner = user ? isBusinessOwner(user.id) : false;
  const ai = aiStatus();
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") || undefined; // set by proxy.ts in production; Next also nonce-matches it from the CSP header
  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <AppProviders user={user ? { id: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor, role: user.role, plan } : null} savedIds={saved} ai={{ provider: ai.provider, label: ai.label }} locale={locale}>
          <SiteHeader user={user} plan={plan} unread={unread} isOwner={owner} locale={locale} />
          <main className="flex-1">{children}</main>
          <SiteFooter ai={ai} locale={locale} />
          <CompareTray />
          <ChatWidget />
          <CookieBanner />
        </AppProviders>
      </body>
    </html>
  );
}
