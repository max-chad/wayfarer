"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

export function CheckoutButton({ product, interval, placeId, label }: { product: string; interval: "month" | "year"; placeId?: number | null; label: string }) {
  const router = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product, interval, placeId: placeId ?? null }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Checkout failed");
      toast(j.resumed ? "Welcome back — your plan is active again" : "You're all set!", "success");
      router.push(j.redirect);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };
  return (
    <button onClick={pay} disabled={busy} className="btn btn-primary btn-lg w-full">
      {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
      {label}
    </button>
  );
}
