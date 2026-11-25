"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";

export function ListingEditor({
  businessId,
  initial,
  paid,
}: {
  businessId: number;
  initial: { website: string | null; phone: string | null; bookingUrl: string | null; announcement: string | null };
  paid: boolean;
}) {
  const router = useRouter();
  const { toast } = useApp();
  const [v, setV] = useState({ website: initial.website || "", phone: initial.phone || "", bookingUrl: initial.bookingUrl || "", announcement: initial.announcement || "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const body: Record<string, string | null> = { website: v.website || null, phone: v.phone || null };
    if (paid) {
      body.bookingUrl = v.bookingUrl || null;
      body.announcement = v.announcement || null;
    }
    const res = await fetch(`/api/business/${businessId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error || "Couldn't save", "error");
    toast("Listing updated", "success");
    router.refresh();
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="le-web">
          Website
        </label>
        <input id="le-web" value={v.website} onChange={set("website")} placeholder="https://" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="le-phone">
          Phone
        </label>
        <input id="le-phone" value={v.phone} onChange={set("phone")} placeholder="+351 …" className="input" />
      </div>
      <div className={paid ? "" : "opacity-60"}>
        <label className="label flex items-center gap-1" htmlFor="le-book">
          Book Direct link {!paid && <Lock className="size-3" />}
        </label>
        <input id="le-book" value={v.bookingUrl} onChange={set("bookingUrl")} placeholder="https://your-booking-engine…" className="input" disabled={!paid} />
        <p className="mt-1 text-xs text-muted">Shown next to partner prices on hotel pages — commission-free.</p>
      </div>
      <div className={paid ? "" : "opacity-60"}>
        <label className="label flex items-center gap-1" htmlFor="le-ann">
          Announcement {!paid && <Lock className="size-3" />}
        </label>
        <input id="le-ann" value={v.announcement} onChange={set("announcement")} maxLength={160} placeholder="e.g. Rooftop bar now open for sunset drinks" className="input" disabled={!paid} />
        <p className="mt-1 text-xs text-muted">{v.announcement.length}/160 · pinned on your page as “From the owner”.</p>
      </div>
      <div className="sm:col-span-2">
        <button onClick={save} disabled={busy} className="btn btn-primary">
          {busy && <Loader2 className="size-4 animate-spin" />} Save changes
        </button>
      </div>
    </div>
  );
}

export function VerifyForm({ businessId, placeId, contactName, contactRole }: { businessId: number; placeId: number; contactName: string; contactRole: string }) {
  const router = useRouter();
  const { toast } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const resend = async () => {
    const res = await fetch("/api/business/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, contactName, contactRole }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast(j.error || "Couldn't send a new code", "error");
    setDemoCode(j.demoCode ?? null);
    toast("New code sent", "success");
  };
  const submit = async () => {
    setBusy(true);
    const res = await fetch(`/api/business/${businessId}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error || "Couldn't verify", "error");
    toast("Verified! You now manage this listing", "success");
    router.refresh();
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="input w-40 font-mono tracking-widest" aria-label="Verification code" />
        <button onClick={submit} disabled={busy || code.length !== 6} className="btn btn-primary btn-sm">
          {busy && <Loader2 className="size-3.5 animate-spin" />} Verify
        </button>
        <button onClick={resend} className="btn btn-ghost btn-sm">
          Send a new code
        </button>
      </div>
      {demoCode && (
        <p className="mt-2 text-xs text-muted">
          Demo: your new code is <span className="font-mono font-semibold tracking-widest text-ink">{demoCode}</span>
        </p>
      )}
    </div>
  );
}
