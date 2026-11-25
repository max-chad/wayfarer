"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

export function CancelBookingButton({ bookingRef }: { bookingRef: string }) {
  const router = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!confirm("Cancel this booking? Cancellation is free up to 24 hours before.")) return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${bookingRef}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error || "Couldn't cancel", "error");
    toast("Booking cancelled", "success");
    router.refresh();
  };
  return (
    <button onClick={cancel} disabled={busy} className="btn btn-outline btn-sm text-coral-600">
      {busy && <Loader2 className="size-3.5 animate-spin" />} Cancel booking
    </button>
  );
}
