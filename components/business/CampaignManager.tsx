"use client";

import { Loader2, Pause, Play, Plus, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { formatCents } from "@/lib/plans";
import { cn, formatDate } from "@/lib/utils";

interface Campaign {
  id: number;
  name: string;
  status: "active" | "paused" | "ended";
  dailyBudgetCents: number;
  cpcCents: number;
  startsAt: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  todaySpendCents: number;
}

export function CampaignManager({ businessId, campaigns, minCpc, minBudget }: { businessId: number; campaigns: Campaign[]; minCpc: number; minBudget: number }) {
  const router = useRouter();
  const { toast } = useApp();
  const [creating, setCreating] = useState(campaigns.length === 0);
  const [name, setName] = useState("Sponsored listing");
  const [budget, setBudget] = useState(15);
  const [bid, setBid] = useState(0.6);
  const [busy, setBusy] = useState<number | "new" | null>(null);

  const create = async () => {
    setBusy("new");
    const res = await fetch(`/api/business/${businessId}/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, dailyBudgetCents: Math.round(budget * 100), cpcCents: Math.round(bid * 100) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(j.error || "Couldn't create campaign", "error");
    toast("Campaign live — you'll appear in sponsored slots in your city", "success");
    setCreating(false);
    router.refresh();
  };

  const setStatus = async (c: Campaign, status: Campaign["status"]) => {
    if (status === "ended" && !confirm("End this campaign? This can't be undone.")) return;
    setBusy(c.id);
    const res = await fetch(`/api/business/${businessId}/campaigns/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(null);
    if (!res.ok) return toast("Couldn't update campaign", "error");
    router.refresh();
  };

  const estClicks = Math.floor((budget * 100) / Math.max(1, bid * 100));

  return (
    <div className="space-y-4">
      {campaigns.map((c) => {
        const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
        return (
          <div key={c.id} className={cn("card p-4", c.status !== "active" && "opacity-75")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{c.name}</span>
              <span className={cn("badge", c.status === "active" ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-surface-3 text-muted")}>{c.status}</span>
              <span className="text-xs text-muted">since {formatDate(c.startsAt)}</span>
              <div className="flex-1" />
              {c.status !== "ended" && (
                <>
                  <button onClick={() => setStatus(c, c.status === "active" ? "paused" : "active")} disabled={busy === c.id} className="btn btn-outline btn-sm">
                    {busy === c.id ? <Loader2 className="size-3.5 animate-spin" /> : c.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    {c.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => setStatus(c, "ended")} disabled={busy === c.id} className="btn btn-ghost btn-sm" aria-label="End campaign">
                    <Square className="size-3.5" />
                  </button>
                </>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-6">
              {[
                ["Daily budget", formatCents(c.dailyBudgetCents)],
                ["Max CPC", formatCents(c.cpcCents, { decimals: true })],
                ["Impressions", c.impressions.toLocaleString("en-US")],
                ["Clicks", `${c.clicks.toLocaleString("en-US")} (${ctr.toFixed(1)}%)`],
                ["Spent", formatCents(c.spendCents)],
                ["Today", `${formatCents(c.todaySpendCents)} / ${formatCents(c.dailyBudgetCents)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      {creating ? (
        <div className="card p-5">
          <div className="font-semibold">New sponsored-listing campaign</div>
          <p className="mt-1 text-sm text-muted">Appear in a labelled “Sponsored” slot on your city&apos;s listing and search pages. You pay only for clicks, and never more than your daily budget.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="cname">
                Name
              </label>
              <input id="cname" value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={80} />
            </div>
            <div>
              <label className="label" htmlFor="cbudget">
                Daily budget ($)
              </label>
              <input id="cbudget" type="number" min={minBudget / 100} step={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="cbid">
                Max cost per click ($)
              </label>
              <input id="cbid" type="number" min={minCpc / 100} step={0.05} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="input" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Up to ~{estClicks} clicks a day. Slots are ranked by bid × rating, so a well-reviewed place can win a slot with a lower bid. Only places rated 3.5+ are shown.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={create} disabled={busy === "new" || budget * 100 < minBudget || bid * 100 < minCpc} className="btn btn-primary">
              {busy === "new" && <Loader2 className="size-4 animate-spin" />} Launch campaign
            </button>
            {campaigns.length > 0 && (
              <button onClick={() => setCreating(false)} className="btn btn-ghost">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="btn btn-outline">
          <Plus className="size-4" /> New campaign
        </button>
      )}
    </div>
  );
}
