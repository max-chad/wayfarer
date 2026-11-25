import { Bot, DollarSign, Flag, Map, MessageSquareText, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModerationQueue } from "@/components/admin/ModerationQueue";
import { aiStatus } from "@/lib/ai/claude";
import { getCurrentUser } from "@/lib/auth";
import { aiUsage, reviewsPerMonth, siteStats } from "@/lib/data/misc";
import { moderationQueue } from "@/lib/data/reviews";
import { MONTHS_SHORT } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin & moderation" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");
  const s = siteStats();
  const months = reviewsPerMonth(12);
  const usage = aiUsage();
  const queue = moderationQueue(60);
  const ai = aiStatus();
  const max = Math.max(1, ...months.map((m) => m.n));

  return (
    <div className="container-page pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Admin & moderation</h1>
          <p className="mt-1 text-muted">Community health, AI usage and the review moderation queue.</p>
        </div>
        <Link href="/admin/revenue" className="btn btn-dark">
          <DollarSign className="size-4" /> Revenue dashboard
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          [Users, s.users, "Users"],
          [MessageSquareText, s.reviews, "Published reviews"],
          [ShieldAlert, s.flagged, "AI-flagged"],
          [Flag, s.reports, "Open reports"],
          [Map, s.trips, "Trips"],
          [Bot, s.aiCalls, `AI calls (${s.claudeCalls} Claude)`],
        ].map(([Icon, n, l]) => {
          const I = Icon as typeof Users;
          return (
            <div key={l as string} className="card p-4">
              <I className="size-5 text-brand-600" />
              <div className="mt-2 font-display text-2xl font-semibold">{(n as number).toLocaleString("en-US")}</div>
              <div className="text-xs text-muted">{l as string}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="font-semibold">Reviews per month</div>
          <div className="mt-4 flex h-44 items-end gap-2">
            {months.map((m) => (
              <div key={m.ym} className="group flex flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] text-muted opacity-0 group-hover:opacity-100">{m.n}</span>
                <div className="w-full rounded-t-md bg-brand-500/80 transition-colors group-hover:bg-brand-600" style={{ height: `${(m.n / max) * 100}%` }} title={`${m.n} reviews · avg ★${m.avg}`} />
                <span className="mt-1 text-[10px] text-muted">{MONTHS_SHORT[Number(m.ym.slice(5, 7)) - 1]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">AI usage</div>
            <span className="badge bg-surface-2 text-ink-2">
              <span className={`size-1.5 rounded-full ${ai.provider === "claude" ? "bg-brand-500" : "bg-sun-400"}`} /> {ai.label}
            </span>
          </div>
          {ai.lastError && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Last Claude error: {ai.lastError}</p>}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Feature</th>
                <th className="font-medium">Engine</th>
                <th className="text-right font-medium">Calls</th>
                <th className="text-right font-medium">Avg ms</th>
                <th className="text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No AI calls yet — try the planner or concierge.
                  </td>
                </tr>
              )}
              {usage.map((u) => (
                <tr key={`${u.feature}-${u.provider}`} className="border-t border-line">
                  <td className="py-1.5">{u.feature}</td>
                  <td>{u.provider}</td>
                  <td className="text-right">
                    {u.ok}/{u.n}
                  </td>
                  <td className="text-right">{u.ms}</td>
                  <td className="text-right text-muted">{u.input + u.output ? `${((u.input + u.output) / 1000).toFixed(1)}k` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Moderation queue</h2>
      <p className="text-sm text-muted">Reviews held by the authenticity model (trust &lt; 35) or reported by travelers. Approving recalculates the place&apos;s rating.</p>
      <div className="mt-4">
        <ModerationQueue initial={queue} />
      </div>
    </div>
  );
}
