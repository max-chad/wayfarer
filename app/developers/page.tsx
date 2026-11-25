import { Braces, Check, Code2, Gauge, KeyRound, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ApiKeyManager } from "@/components/developers/ApiKeyManager";
import { getCurrentUser } from "@/lib/auth";
import { apiPlanFor, listApiKeys, monthlyApiUsage } from "@/lib/data/apikeys";
import { API_PLANS, formatCents } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Developer API",
  description: "Destinations, places and AI review insights for travel apps, tourism boards and hotel tech — with a free tier.",
};

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/v1/destinations", "All destinations. Filters: continent, q, month (best time to visit), vibe."],
  ["GET", "/api/v1/destinations/{slug}", "A destination with currency, languages, safety, neighbourhoods and climate normals."],
  ["GET", "/api/v1/places", "Places ranked by our Bayesian score. Filters: destination, type, q, min_rating, limit (≤50), offset."],
  ["GET", "/api/v1/places/{id|slug}", "A place with description, amenities, details, aspect scores and photo credits."],
  ["GET", "/api/v1/places/{id}/insights", "AI review insights: aspects, pros & cons, best-for, trust stats. Growth plan."],
];

export default async function DevelopersPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const user = await getCurrentUser();
  const { upgraded } = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("host") || "localhost:3000"}`;
  const plan = user ? apiPlanFor(user.id) : null;
  const keys = user ? listApiKeys(user.id) : [];
  const used = user ? monthlyApiUsage(user.id) : 0;
  const example = `curl ${origin}/api/v1/places?destination=lisbon&type=restaurant&limit=3 \\
  -H "Authorization: Bearer wf_live_…"`;
  const response = `{
  "data": {
    "total": 8, "limit": 3, "offset": 0,
    "items": [
      {
        "id": 412, "slug": "salmoura-lisbon", "name": "Salmoura",
        "type": "restaurant", "rating": 4.32, "review_count": 21,
        "ranking": { "position": 1, "of": 8 },
        "location": { "lat": 38.71, "lng": -9.14 },
        "url": "${origin}/place/salmoura-lisbon", …
      }
    ]
  },
  "meta": { "plan": "developer", "attribution": "Wayfarer demo data. …" }
}`;

  return (
    <div className="container-page max-w-5xl pt-12">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
        <Code2 className="size-4" /> Developers
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">The Wayfarer API</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Ranked places, destination intelligence and AI review insights, built from
        traveler reviews that pass our authenticity model. For travel apps, tourism boards, hotel tech and publishers.
      </p>

      {upgraded && <div className="mt-6 rounded-2xl bg-brand-600 p-4 text-sm text-white">API Growth is active — your quota is now 100,000 calls a month and the insights endpoint is unlocked.</div>}

      <section className="mt-10">
        {user ? (
          <ApiKeyManager initial={keys} quota={plan!.quota} used={used} />
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <KeyRound className="size-5 text-brand-600" />
              <span className="text-sm">Sign in to create a free API key — 1,000 calls a month, no card needed.</span>
            </div>
            <Link href="/login?next=/developers" className="btn btn-dark btn-sm">
              Sign in
            </Link>
          </div>
        )}
      </section>

      <section id="pricing" className="mt-14 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Gauge className="size-6 text-brand-600" /> Plans
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {API_PLANS.map((p) => {
            const current = plan?.id === p.id;
            return (
              <div key={p.id} className={cn("card flex flex-col p-5", p.id === "growth" && "ring-2 ring-brand-500")}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-xl font-semibold">{p.name}</div>
                  {current && <span className="badge bg-brand-600 text-white">Your plan</span>}
                </div>
                <div className="mt-1 font-display text-3xl font-semibold">
                  {p.monthlyCents < 0 ? "Custom" : p.monthlyCents ? formatCents(p.monthlyCents) : "Free"}
                  {p.monthlyCents > 0 && <span className="text-sm font-normal text-muted">/mo</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{p.blurb}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  {p.id === "growth" && !current ? (
                    <Link href={user ? "/checkout?product=api_growth" : "/login?next=/developers"} className="btn btn-primary w-full">
                      Upgrade to Growth
                    </Link>
                  ) : p.id === "enterprise" ? (
                    <a href="mailto:partners@example.com?subject=Wayfarer%20API%20Enterprise" className="btn btn-outline w-full">
                      Contact sales
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Braces className="size-6 text-brand-600" /> Reference
        </h2>
        <p className="mt-2 text-sm text-muted">
          Send your key as <code className="rounded bg-surface-2 px-1">Authorization: Bearer &lt;key&gt;</code> (or <code className="rounded bg-surface-2 px-1">x-api-key</code>). Every
          response is JSON with <code className="rounded bg-surface-2 px-1">data</code> and <code className="rounded bg-surface-2 px-1">meta</code>; errors return{" "}
          <code className="rounded bg-surface-2 px-1">{"{ error: { status, message } }"}</code>. <code className="rounded bg-surface-2 px-1">X-RateLimit-Remaining</code> shows calls left this
          month.
        </p>
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {ENDPOINTS.map(([m, path, desc]) => (
                <tr key={path} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="badge bg-brand-50 font-mono text-brand-700 dark:bg-brand-950 dark:text-brand-300">{m}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{path}</td>
                  <td className="px-4 py-3 text-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Request</div>
            <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-bg">{example}</pre>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Response</div>
            <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-bg">{response}</pre>
          </div>
        </div>
      </section>

      <section className="mt-14 flex gap-3 rounded-2xl bg-surface-2 p-5 text-sm">
        <ScrollText className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div>
          <strong>Attribution &amp; fair use.</strong> Show “Data from Wayfarer” with a link back when you display ratings or insights. Photos and Wikipedia text keep their own licences — use
          the <code className="rounded bg-surface px-1">author</code>/<code className="rounded bg-surface px-1">license</code> fields. Don&apos;t use the API to build a competing review
          site, re-identify reviewers or train models on review text. Full terms in the <Link href="/legal/terms#api" className="underline">terms of use</Link>.
        </div>
      </section>
    </div>
  );
}
