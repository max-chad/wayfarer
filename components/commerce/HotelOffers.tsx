"use client";

import { BadgeCheck, BellPlus, BellRing, ExternalLink, Info, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { cn, formatDate, formatUsd } from "@/lib/utils";

interface Offer {
  partner: string;
  partnerName: string;
  color: string;
  nightlyUsd: number;
  totalUsd: number;
  perks: string[];
  token: string;
  direct: boolean;
}

const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/** Meta-search style price comparison. Sorted by price only; commission never changes the order. */
export function HotelOffers({ placeId, placeName }: { placeId: number; placeName: string }) {
  const { isPlus, requireLogin, upgrade, toast } = useApp();
  const [checkIn, setCheckIn] = useState(() => isoIn(30));
  const [nights, setNights] = useState(2);
  const [guests, setGuests] = useState(2);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [direct, setDirect] = useState<{ token: string; host: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers?placeId=${placeId}&checkIn=${checkIn}&nights=${nights}&guests=${guests}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load prices");
      setOffers(j.offers);
      setDirect(j.direct ?? null);
      setWatching(!!j.watching);
    } catch (e) {
      setError((e as Error).message);
      setOffers(null);
    } finally {
      setLoading(false);
    }
  }, [placeId, checkIn, nights, guests]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const toggleAlert = async () => {
    if (!requireLogin("Sign in to track hotel prices")) return;
    if (!isPlus) return upgrade("price_alerts");
    if (watching) {
      await fetch(`/api/price-alerts?placeId=${placeId}`, { method: "DELETE" });
      setWatching(false);
      return toast("Price alert removed", "info");
    }
    const res = await fetch("/api/price-alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, checkIn, nights, guests }) });
    const j = await res.json().catch(() => ({}));
    if (res.status === 402) return upgrade("price_alerts", j.error);
    if (!res.ok) return toast(j.error || "Couldn't create the alert", "error");
    setWatching(true);
    toast(`We'll let you know if partner prices for ${placeName} drop below ${formatUsd(j.priceCents / 100)}`, "success", { label: "Alerts", href: "/account/billing#alerts" });
  };

  const cheapest = offers?.length ? Math.min(...offers.map((o) => o.totalUsd)) : 0;

  return (
    <div id="prices" className="scroll-mt-24">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Compare prices</div>
        <button onClick={toggleAlert} className={cn("chip text-xs", watching && "border-brand-400 text-brand-700 dark:text-brand-300")} title="Get notified when the price drops (Plus)">
          {watching ? <BellRing className="size-3.5" /> : <BellPlus className="size-3.5" />}
          {watching ? "Watching price" : "Track price"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-2 flex items-center gap-2 rounded-xl border border-line-strong px-3 focus-within:border-brand-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Check-in</span>
          <input type="date" value={checkIn} min={isoIn(0)} max={isoIn(365)} onChange={(e) => e.target.value && setCheckIn(e.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
        </label>
        <Stepper label="nights" value={nights} min={1} max={14} onChange={setNights} />
        <Stepper label="guests" value={guests} min={1} max={8} onChange={setGuests} />
      </div>
      <div className="mt-3 space-y-2" aria-live="polite">
        {loading && !offers && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Checking partners…
          </div>
        )}
        {error && <p className="rounded-lg bg-coral-50 p-3 text-sm text-coral-700 dark:bg-coral-500/10 dark:text-coral-300">{error}</p>}
        {offers?.map((o) => (
          <a
            key={o.partner}
            href={`/go/${o.token}`}
            target="_blank"
            rel="sponsored noopener"
            className={cn(
              "group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-ink-2",
              o.totalUsd === cheapest ? "border-brand-400 bg-brand-50/60 dark:bg-brand-950/40" : "border-line",
              loading && "opacity-60"
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <span className="truncate">{o.partnerName}</span>
                {o.totalUsd === cheapest && <span className="badge bg-brand-600 text-[10px] text-white">Lowest</span>}
              </div>
              <div className="truncate text-xs text-muted">{o.perks.join(" · ")}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-semibold leading-none">{formatUsd(o.totalUsd)}</div>
              <div className="text-[11px] text-muted">{formatUsd(o.nightlyUsd)}/night</div>
            </div>
            <ExternalLink className="size-4 shrink-0 text-muted group-hover:text-ink" />
          </a>
        ))}
        {offers && direct && (
          <a href={`/go/${direct.token}`} target="_blank" rel="noopener" className="group flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 hover:border-ink-2">
            <BadgeCheck className="size-4 shrink-0 text-brand-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Book direct with the hotel</div>
              <div className="truncate text-xs text-muted">Commission-free · rates on {direct.host}</div>
            </div>
            <ExternalLink className="size-4 shrink-0 text-muted group-hover:text-ink" />
          </a>
        )}
      </div>
      {offers && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          {nights} night{nights > 1 ? "s" : ""} from {formatDate(checkIn, { month: "short", day: "numeric" })} · {guests} guest{guests > 1 ? "s" : ""}, taxes estimated. Sorted by price.{" "}
          <span className="inline-flex items-center gap-0.5">
            <Info className="size-3" /> We may earn a commission when you click a deal; it never affects rankings.
          </span>{" "}
          <Link href="/how-we-make-money" className="underline">
            How we make money
          </Link>
          . Partners are fictional in this demo.
        </p>
      )}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line-strong">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="p-2 text-muted hover:text-ink disabled:opacity-40" disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-8 text-center text-sm" aria-label={`${value} ${label}`}>
        {value}
        <span className="block text-[9px] uppercase leading-none text-muted">{label}</span>
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="p-2 text-muted hover:text-ink disabled:opacity-40" disabled={value >= max} aria-label={`More ${label}`}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
