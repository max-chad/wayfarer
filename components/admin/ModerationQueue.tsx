"use client";

import { Check, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { TrustBadge } from "@/components/ui/Badges";
import { Stars } from "@/components/ui/Stars";
import type { Review } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

type Item = Review & { reports: { reason: string; created_at: string }[] };

export function ModerationQueue({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const { toast } = useApp();
  const act = async (id: number, status: "published" | "removed") => {
    const r = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast(status === "published" ? "Review approved and published" : "Review removed");
    } else toast("Action failed", "error");
  };
  if (!items.length) return <div className="card p-10 text-center text-muted">🎉 The queue is empty.</div>;
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-semibold">{r.title}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                by{" "}
                <Link href={`/profile/${r.user.username}`} className="underline">
                  {r.user.displayName}
                </Link>{" "}
                ({r.user.reviewCount} reviews, joined {timeAgo(r.user.createdAt)}) on{" "}
                {r.place && (
                  <Link href={`/place/${r.place.slug}`} className="font-semibold text-ink underline">
                    {r.place.name}
                  </Link>
                )}{" "}
                · {timeAgo(r.createdAt)}
              </div>
            </div>
            <TrustBadge score={r.trustScore} />
          </div>
          <p className="mt-3 text-sm text-ink-2">{r.body}</p>
          {r.trustFlags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.trustFlags.map((f) => (
                <span key={f} className="badge bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <ShieldAlert className="size-3" /> {f}
                </span>
              ))}
            </div>
          )}
          {r.reports.length > 0 && (
            <div className="mt-2 text-xs text-muted">
              Reported {r.reports.length}×: {r.reports.map((x) => `“${x.reason}”`).join(", ")}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={() => act(r.id, "published")} className="btn btn-outline btn-sm">
              <Check className="size-3.5" /> Approve
            </button>
            <button onClick={() => act(r.id, "removed")} className="btn btn-outline btn-sm hover:border-coral-500 hover:text-coral-600">
              <Trash2 className="size-3.5" /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
