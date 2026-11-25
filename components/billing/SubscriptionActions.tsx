"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

export function SubscriptionActions({ id, cancelAtPeriodEnd, periodEnd }: { id: number; cancelAtPeriodEnd: boolean; periodEnd: string }) {
  const router = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const act = async (action: "cancel" | "resume") => {
    if (action === "cancel" && !confirm(`Cancel at the end of the current period (${periodEnd.slice(0, 10)})? You keep access until then.`)) return;
    setBusy(true);
    const res = await fetch(`/api/billing/subscriptions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(false);
    if (!res.ok) return toast("Couldn't update the subscription", "error");
    toast(action === "cancel" ? "Cancelled — you keep access until the period ends" : "Your subscription will renew as normal", "success");
    router.refresh();
  };
  return cancelAtPeriodEnd ? (
    <button onClick={() => act("resume")} disabled={busy} className="btn btn-dark btn-sm">
      {busy && <Loader2 className="size-3.5 animate-spin" />} Resume
    </button>
  ) : (
    <button onClick={() => act("cancel")} disabled={busy} className="btn btn-ghost btn-sm text-coral-600">
      {busy && <Loader2 className="size-3.5 animate-spin" />} Cancel
    </button>
  );
}

export function RemoveAlertButton({ placeId }: { placeId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/price-alerts?placeId=${placeId}`, { method: "DELETE" });
        router.refresh();
      }}
      disabled={busy}
      className="btn btn-ghost btn-icon"
      aria-label="Remove price alert"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
