import { Bot, Database, Image as ImageIcon, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { aiStatus } from "@/lib/ai/claude";
import { siteStats } from "@/lib/data/misc";

export const metadata: Metadata = { title: "How Wayfarer works" };

const FEATURES: [string, string, string][] = [
  ["Concierge chat", "Claude with tool use (search places, weather, planner, destination facts, currency) — streamed", "Intent detection + the same tools, templated answers"],
  ["Trip planner", "Claude writes the itinerary from 70+ candidate places, grounded by our routing draft; costs recomputed server-side", "k-means neighbourhood clustering, 2-opt routes, meal slotting, weather swaps"],
  ["Review summaries", "Claude synthesises headline, pros/cons and quotes; aspect scores computed by our model", "Aspect detection + lexicon sentiment across every review sentence"],
  ["Smart search", "Claude turns free text into structured filters", "Rule-based parser for destinations, types, vibes, budgets, dietary needs"],
  ["Place Q&A", "Claude answers from listing facts + retrieved review excerpts", "Retrieval over reviews + rules on listing facts"],
  ["Review assistant", "Claude drafts/polishes in the traveler's voice, suggests titles", "Note expansion, grammar/shouting clean-up, aspect-based titles"],
  ["Compare verdict", "Claude weighs the options", "Rule-based ranking on rating, value and sub-scores"],
  ["Translation", "Claude translates foreign-language reviews", "Stored translations for seeded reviews"],
  ["Authenticity scoring", "—", "Stylometry, rating/text mismatch, account age, duplicate detection"],
  ["Packing lists & matcher", "—", "Climate normals, trip length, activities, local customs, flight time & CO₂"],
];

export default function AboutPage() {
  const s = siteStats();
  const ai = aiStatus();
  return (
    <div className="container-page max-w-4xl pt-12">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
        <Sparkles className="size-4" /> About
      </div>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">An advisor that has read everything</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Wayfarer is an AI-native take on the travel review site. Instead of making you read 400 reviews, it reads them for you, cross-checks them for
        authenticity, and turns what it learns into plans, answers and honest trade-offs. It currently covers {s.destinations} destinations in {s.countries} countries,{" "}
        {s.places.toLocaleString("en-US")} places and {s.reviews.toLocaleString("en-US")} reviews.
      </p>

      <section id="ai" className="mt-14 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Bot className="size-6 text-brand-600" /> AI transparency
        </h2>
        <p className="mt-3 text-muted">
          Every AI feature has two engines. When an Anthropic API key is configured, Wayfarer uses <strong className="text-ink">Claude</strong> with structured outputs
          and tool use; otherwise — or if a call fails — it falls back to Wayfarer&apos;s built-in local AI engine, so the whole site keeps working offline.
          Currently active: <strong className="text-ink">{ai.label}</strong>. AI-generated content is labelled with an{" "}
          <span className="badge ai-gradient text-white">AI</span> badge.
        </p>
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">With Claude</th>
                <th className="px-4 py-3">Local engine</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([f, c, l]) => (
                <tr key={f} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 font-semibold">{f}</td>
                  <td className="px-4 py-3 text-ink-2">{c}</td>
                  <td className="px-4 py-3 text-muted">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-2 p-5 text-sm">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <div>
            <strong>Turn on Claude:</strong> add <code className="rounded bg-surface px-1">ANTHROPIC_API_KEY=…</code> to <code className="rounded bg-surface px-1">.env.local</code> and restart. The
            model defaults to <code className="rounded bg-surface px-1">claude-opus-5-5</code> (override with <code className="rounded bg-surface px-1">ANTHROPIC_MODEL</code>). Requests opt into
            server-side refusal fallbacks, and failures trip a circuit-breaker back to the local engine.
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <ShieldCheck className="size-6 text-brand-600" /> Review integrity
        </h2>
        <p className="mt-3 text-muted">
          Every review receives a trust score (0–100) from signals such as generic superlatives without specifics, promotional language, ALL-CAPS shouting,
          a star rating that contradicts the text, brand-new accounts and near-duplicate wording. Reviews under 30–35 are held for moderation and excluded from
          ratings until an admin approves them. Rankings use a Bayesian average, so a handful of glowing reviews can&apos;t game the leaderboard.
        </p>
      </section>

      <section id="data" className="mt-14 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Database className="size-6 text-brand-600" /> Data, photos & credits
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-2">
          <li>
            <strong>Demo content:</strong> hotels, restaurants, tours, users and all reviews are <em>fictional sample data</em> generated for this demo. Any
            resemblance to real businesses is coincidental. Real landmarks (museums, monuments, parks) are included for realism, but their reviews are also
            synthetic.
          </li>
          <li>
            <strong>Landmark descriptions & coordinates:</strong> original writing, plus intro extracts from{" "}
            <a className="underline" href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer">
              Wikipedia
            </a>{" "}
            (CC BY-SA 4.0), linked on each page.
          </li>
          <li className="flex gap-2">
            <ImageIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Photos:</strong> freely-licensed images from{" "}
              <a className="underline" href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">
                Wikimedia Commons
              </a>
              ; author and licence are shown on each photo and in the gallery viewer. Hotel/restaurant photos are illustrative stock from Commons&apos; Quality
              Images, not the (fictional) venues.
            </span>
          </li>
          <li>
            <strong>Weather & climate:</strong>{" "}
            <a className="underline" href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
              Open-Meteo
            </a>{" "}
            forecast and 2023–2025 archive (CC BY 4.0).
          </li>
          <li>
            <strong>Maps:</strong> ©{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{" "}
            contributors, rendered with Leaflet.
          </li>
          <li>
            <strong>Exchange rates:</strong> open.er-api.com (ExchangeRate-API), with offline reference rates as a fallback.
          </li>
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link href="/plan" className="btn btn-primary">
          Try the AI planner
        </Link>
        <Link href="/destinations" className="btn btn-outline">
          Browse destinations
        </Link>
      </div>
    </div>
  );
}
