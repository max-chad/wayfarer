import { Building2, Code2, Scale, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PricingPlans } from "@/components/billing/PricingPlans";
import { getCurrentUser } from "@/lib/auth";
import { consumerPlan } from "@/lib/data/billing";

export const metadata: Metadata = {
  title: "Pricing — Wayfarer Plus",
  description: "Wayfarer is free. Plus adds unlimited AI trip planning, hotel price-drop alerts, offline GPX export and no sponsored listings.",
};

const FAQ: [string, React.ReactNode][] = [
  [
    "Why is Wayfarer free?",
    <>
      When you click through to a booking partner or book a table or tour through us, the partner pays us a commission. Businesses can also buy clearly labelled
      sponsored placements and analytics tools. <Link href="/how-we-make-money" className="underline">Here&apos;s exactly how we make money.</Link>
    </>,
  ],
  ["Does paying change rankings or AI answers?", "Never. Rankings come from traveler reviews only, and the concierge never recommends a place because someone paid. Plus doesn't change what you see — it removes sponsored listings and lifts AI limits."],
  ["What counts as an AI trip plan?", "Each time you generate or regenerate an itinerary in the planner. Editing a saved trip, the concierge's quick suggestions, review summaries and smart search don't count."],
  ["Can I cancel?", "Yes, anytime from Plan & billing. You keep Plus until the end of the period you've paid for, and nothing renews after that."],
  ["Is this charging my card?", "Not in this demo — checkout activates the plan without payment details. In production, payments are handled by a PCI-compliant payment provider and card numbers never touch our servers."],
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const current = consumerPlan(user);
  return (
    <div className="container-page pt-12">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
          <Sparkles className="size-4" /> Pricing
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Free to explore. Plus for people who travel a lot.</h1>
        <p className="mt-4 text-lg text-muted">Reviews, rankings and AI summaries are free for everyone, forever. Plus lifts the AI limits and adds tools frequent travelers ask for.</p>
      </div>

      <div className="mt-10">
        <PricingPlans current={current} />
      </div>

      <div className="mx-auto mt-10 grid grid-cols-1 max-w-4xl gap-4 sm:grid-cols-2">
        <Link href="/business" className="card group flex items-start gap-4 p-5 hover:border-line-strong">
          <Building2 className="mt-1 size-6 shrink-0 text-brand-600" />
          <div>
            <div className="font-semibold group-hover:underline">Own a hotel, restaurant or tour?</div>
            <p className="text-sm text-muted">Claim your free listing, reply to reviews and see AI insights from $79/month.</p>
          </div>
        </Link>
        <Link href="/developers" className="card group flex items-start gap-4 p-5 hover:border-line-strong">
          <Code2 className="mt-1 size-6 shrink-0 text-brand-600" />
          <div>
            <div className="font-semibold group-hover:underline">Building a travel product?</div>
            <p className="text-sm text-muted">Places, destinations and AI review insights via API. Free tier included.</p>
          </div>
        </Link>
      </div>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Scale className="size-6 text-brand-600" /> Questions
        </h2>
        <div className="mt-6 divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <div className="mt-2 pl-5 text-sm leading-relaxed text-muted">{a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
