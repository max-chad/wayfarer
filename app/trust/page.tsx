import { Bot, Eye, Flag, Gavel, MessageCircleReply, ShieldCheck, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { trustReport } from "@/lib/data/misc";

export const metadata: Metadata = {
  title: "Trust & transparency report",
  description: "How Wayfarer keeps reviews honest: authenticity scoring, moderation numbers, reports, appeals and what we do and don't verify.",
};

export default function TrustPage() {
  const r = trustReport();
  const heldPct = r.total ? (r.held / r.total) * 100 : 0;
  const maxFlag = Math.max(1, ...r.flags.map((f) => f.n));
  return (
    <div className="container-page max-w-4xl pt-12">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
        <ShieldCheck className="size-4" /> Trust & safety
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Trust & transparency report</h1>
      <p className="mt-4 text-lg text-muted">Live numbers on how reviews are checked, held and removed — and exactly what we can and can&apos;t verify.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [r.published.toLocaleString("en-US"), "reviews published"],
          [`${r.held.toLocaleString("en-US")} (${heldPct.toFixed(1)}%)`, "held by the authenticity model"],
          [r.avgTrust.toString(), "average trust score / 100"],
          [`${r.reportsResolved}/${r.reports}`, "traveler reports resolved"],
          [r.removed.toLocaleString("en-US"), "removed after moderation"],
          [r.ownerReplies.toLocaleString("en-US"), "owner replies"],
          [r.verifiedBusinesses.toLocaleString("en-US"), "verified business owners"],
          [r.foreignLang.toLocaleString("en-US"), "reviews in other languages"],
        ].map(([n, l]) => (
          <div key={l} className="card p-4">
            <div className="font-display text-2xl font-semibold">{n}</div>
            <div className="text-xs text-muted">{l}</div>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Bot className="size-6 text-brand-600" /> What the authenticity model looks for
        </h2>
        <p className="mt-2 text-muted">Each review gets a 0–100 trust score. Below 35, it&apos;s held for a moderator and excluded from ratings. Most common signals on held or low-scoring reviews:</p>
        <div className="card mt-5 space-y-2 p-5">
          {r.flags.map((f) => (
            <div key={f.flag} className="flex items-center gap-3 text-sm">
              <span className="w-64 shrink-0 truncate">{f.flag}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-coral-400" style={{ width: `${(f.n / maxFlag) * 100}%` }} />
              </div>
              <span className="w-12 text-right text-muted">{f.n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {[
          [Flag, "Report anything", "Every review has a Report button. Reports go to the moderation queue with the reason you chose; both you and the author are told the outcome."],
          [Gavel, "Statement of reasons & appeals", "When a moderator publishes or removes a held review, the author is notified with a link to the guideline that applies, and can ask for a second review. Out-of-court dispute settlement is available where the law provides it."],
          [MessageCircleReply, "Owners can reply, not delete", "Verified owners can reply publicly but can't edit, hide or remove reviews — and paying for a plan or ads never changes moderation."],
          [UserCheck, "What we verify — and what we don't", "We verify business owners before they can reply. We don't yet confirm that every reviewer used the service; bookings made through Wayfarer will be labelled as verified in a future release."],
        ].map(([Icon, title, body]) => {
          const I = Icon as typeof Flag;
          return (
            <div key={title as string} className="card p-5">
              <I className="size-5 text-brand-600" />
              <div className="mt-2 font-semibold">{title as string}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body as string}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-12 flex gap-3 rounded-2xl bg-surface-2 p-5 text-sm">
        <Eye className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <p>
          Rankings use a Bayesian average of published reviews only, so a handful of glowing reviews can&apos;t game the list. Read the full{" "}
          <Link href="/legal/guidelines" className="underline">
            review guidelines
          </Link>
          , our <Link href="/legal/ai" className="underline">AI transparency notes</Link> and <Link href="/how-we-make-money" className="underline">how we make money</Link>. All
          figures on this page are computed live from the demo&apos;s fictional data.
        </p>
      </section>
    </div>
  );
}
