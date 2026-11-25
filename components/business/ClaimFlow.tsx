"use client";

import { BadgeCheck, Building2, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { SmartImage } from "@/components/ui/SmartImage";
import type { PlaceCardData } from "@/lib/types";
import { cn, TYPE_LABELS } from "@/lib/utils";

type Step = "search" | "details" | "verify" | "done";

export function ClaimFlow({ initialPlace, initialQuery }: { initialPlace: PlaceCardData | null; initialQuery: string }) {
  const { user, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialPlace ? "details" : "search");
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<PlaceCardData[] | null>(null);
  const [place, setPlace] = useState<PlaceCardData | null>(initialPlace);
  const [contactName, setContactName] = useState(user?.displayName ?? "");
  const [contactRole, setContactRole] = useState("Owner");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<{ businessId: number; demoCode: string | null } | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (step !== "search" || q.trim().length < 2) return setResults(null);
    const t = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(q.trim())}&limit=20`)
        .then((r) => r.json())
        .then((j) => setResults((j.items as PlaceCardData[]).filter((p) => p.type !== "attraction").slice(0, 8)))
        .catch(() => setResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, step]);

  const submitClaim = async () => {
    if (!place) return;
    setBusy(true);
    try {
      const res = await fetch("/api/business/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: place.id, contactName, contactRole, website: website || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (j.alreadyVerified) {
        toast("You already manage this listing", "info");
        return router.push(`/business/${j.businessId}`);
      }
      setClaim({ businessId: j.businessId, demoCode: j.demoCode });
      setStep("verify");
    } catch (e) {
      toast((e as Error).message || "Couldn't claim this listing", "error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!claim) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/business/${claim.businessId}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setStep("done");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const steps: [Step, string][] = [
    ["search", "Find your business"],
    ["details", "Your details"],
    ["verify", "Verify"],
  ];
  const idx = step === "done" ? 3 : steps.findIndex((s) => s[0] === step);

  return (
    <div className="card p-6">
      <ol className="mb-6 flex items-center gap-2 text-xs font-semibold">
        {steps.map(([k, label], i) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cn("grid size-6 place-items-center rounded-full", i < idx ? "bg-brand-600 text-white" : i === idx ? "bg-ink text-bg" : "bg-surface-3 text-muted")}>{i + 1}</span>
            <span className={cn("hidden sm:inline", i === idx ? "text-ink" : "text-muted")}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong" />}
          </li>
        ))}
      </ol>

      {step === "search" && (
        <div>
          <label className="label" htmlFor="claim-q">
            Business name
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input id="claim-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Hotel Cortiça Belém" className="input pl-9" autoFocus />
          </div>
          <div className="mt-3 space-y-1.5">
            {results?.map((p) => (
              <button key={p.id} onClick={() => (setPlace(p), setStep("details"))} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2">
                <SmartImage image={p.image} alt={p.name} width={330} className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {TYPE_LABELS[p.type].singular} · {p.neighborhood ? `${p.neighborhood}, ` : ""}
                    {p.destinationName}
                  </div>
                </div>
              </button>
            ))}
            {results && results.length === 0 && <p className="py-3 text-sm text-muted">No hotels, restaurants or experiences match. Public landmarks can&apos;t be claimed.</p>}
          </div>
        </div>
      )}

      {step === "details" && place && (
        <div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <SmartImage image={place.image} alt={place.name} width={330} className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{place.name}</div>
              <div className="text-xs text-muted">
                {place.category} · {place.destinationName}
              </div>
            </div>
            <button onClick={() => setStep("search")} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
              Change
            </button>
          </div>
          {!user ? (
            <div className="mt-5 text-center">
              <p className="text-sm text-muted">Sign in or create a free account to claim this listing.</p>
              <Link href={`/login?next=${encodeURIComponent(`/business/claim?place=${place.id}`)}`} className="btn btn-dark mt-3">
                Sign in to continue
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="cn">
                  Your name
                </label>
                <input id="cn" value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" maxLength={80} />
              </div>
              <div>
                <label className="label" htmlFor="cr">
                  Your role
                </label>
                <select id="cr" value={contactRole} onChange={(e) => setContactRole(e.target.value)} className="input">
                  {["Owner", "General Manager", "Marketing Manager", "Restaurant Manager", "Head Chef", "Front Office Manager", "Operations Lead"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ws">
                  Website (optional)
                </label>
                <input id="ws" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="input" />
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                By claiming you confirm you&apos;re authorised to represent this business and agree to the{" "}
                <Link href="/legal/business-terms" className="underline">
                  business terms
                </Link>
                . Claiming never changes your ranking or lets you remove reviews.
              </p>
              <button onClick={submitClaim} disabled={busy || contactName.trim().length < 2} className="btn btn-primary sm:col-span-2">
                {busy && <Loader2 className="size-4 animate-spin" />} Send verification code
              </button>
            </div>
          )}
        </div>
      )}

      {step === "verify" && claim && (
        <div className="max-w-sm">
          <p className="text-sm text-ink-2">
            We&apos;ve sent a 6-digit code to the phone number and email we have on file for <strong>{place?.name}</strong>.
          </p>
          {claim.demoCode && (
            <div className="mt-3 rounded-xl bg-sun-300/20 p-3 text-xs dark:bg-sun-500/10">
              <strong>Demo:</strong> no message is sent. Your code is <span className="font-mono text-sm font-bold tracking-widest">{claim.demoCode}</span>
            </div>
          )}
          <label className="label mt-4" htmlFor="code">
            Verification code
          </label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className="input font-mono text-lg tracking-[0.4em]" placeholder="••••••" />
          <button onClick={verify} disabled={busy || code.length !== 6} className="btn btn-primary mt-4 w-full">
            {busy && <Loader2 className="size-4 animate-spin" />} Verify & claim
          </button>
        </div>
      )}

      {step === "done" && claim && (
        <div className="py-4 text-center">
          <BadgeCheck className="mx-auto size-12 text-brand-600" />
          <h2 className="mt-2 font-display text-2xl font-semibold">You now manage {place?.name}</h2>
          <p className="mt-1 text-sm text-muted">Your listing shows a Verified owner badge. Start by replying to recent reviews.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/business/${claim.businessId}`} className="btn btn-primary">
              <Building2 className="size-4" /> Open business dashboard
            </Link>
            <Link href="/business#plans" className="btn btn-outline">
              See plans
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
