"use client";

import { Camera, Check, ImagePlus, Loader2, ShieldCheck, Sparkles, Star, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { AiBadge } from "@/components/ui/Badges";
import type { PlaceType, TripType } from "@/lib/types";
import { cn, MONTHS } from "@/lib/utils";

interface Coach {
  words: number;
  covered: string[];
  missing: string[];
  sentiment: string;
  impliedRating: number;
  tips: string[];
  score: number;
}

const RATING_WORDS = ["", "Terrible", "Poor", "Average", "Very good", "Excellent"];
const TRIP_TYPES: [TripType, string][] = [
  ["couples", "💑 Couples"],
  ["family", "👨‍👩‍👧 Family"],
  ["friends", "🧑‍🤝‍🧑 Friends"],
  ["solo", "🎒 Solo"],
  ["business", "💼 Business"],
];

/** Downscales an image in the browser before upload (max 1600px, JPEG). */
async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Compression failed"))), "image/jpeg", 0.82));
}

export function ReviewComposer({ place, subRatings }: { place: { id: number; slug: string; name: string; type: PlaceType }; subRatings: string[] }) {
  const router = useRouter();
  const { toast } = useApp();
  const now = new Date();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [subs, setSubs] = useState<Record<string, number>>({});
  const [tripType, setTripType] = useState<TripType | "">("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // live writing coach
  useEffect(() => {
    if (!body.trim() && !title.trim()) return setCoach(null);
    const t = setTimeout(async () => {
      const r = await fetch("/api/ai/review-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "coach", placeId: place.id, rating: rating || 3, title, body }),
      });
      if (r.ok) setCoach((await r.json()).coach);
    }, 450);
    return () => clearTimeout(t);
  }, [body, title, rating, place.id]);

  const assist = async (action: "draft" | "polish" | "titles") => {
    if (!rating) return toast("Pick a star rating first so the AI gets the tone right", "info");
    setAiBusy(action);
    try {
      const r = await fetch("/api/ai/review-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, placeId: place.id, rating, notes, title, body, tripType: tripType || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setProvider(j.provider);
      if (action === "titles") setTitles(j.result);
      else {
        setTitle(j.result.title || title);
        setBody(j.result.body || body);
        toast(action === "draft" ? "Draft ready — edit it so it sounds like you" : "Polished! Review the changes before posting");
      }
    } catch (e) {
      toast((e as Error).message || "AI assistant unavailable", "error");
    } finally {
      setAiBusy(null);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 6 - photos.length)) {
        const blob = await compressImage(f);
        const fd = new FormData();
        fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        const r = await fetch("/api/uploads", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setPhotos((p) => [...p, j.url]);
      }
    } catch (e) {
      toast((e as Error).message || "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setError(null);
    if (!rating) return setError("Please choose an overall rating.");
    if (!tripType) return setError("Who did you travel with?");
    setSubmitting(true);
    const r = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeId: place.id, rating, title, body, tripType, visitDate: `${year}-${String(month).padStart(2, "0")}`, subRatings: subs, photos }),
    });
    const j = await r.json();
    setSubmitting(false);
    if (!r.ok) return setError(j.error);
    if (j.status === "flagged") {
      toast(`Thanks! Your review is held for a quick moderation check (trust score ${j.trust.score}).`, "info");
    } else {
      toast(`Review published — trust score ${j.trust.score}/100. Thanks for helping fellow travelers!`);
    }
    router.push(`/place/${place.slug}#reviews`);
    router.refresh();
  };

  const shown = hover || rating;
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section>
          <h1 className="font-display text-3xl font-semibold">How would you rate your experience?</h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="p-1">
                  <Star className={cn("size-9 transition-transform hover:scale-110", n <= shown ? "fill-sun-400 text-sun-400" : "text-line-strong")} />
                </button>
              ))}
            </div>
            <span className="text-lg font-semibold">{RATING_WORDS[shown]}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {subRatings.map((label) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <span className="text-sm">{label}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setSubs((s) => ({ ...s, [label]: n }))} aria-label={`${label} ${n}`} className="p-0.5">
                      <span className={cn("block size-3.5 rounded-full border-2", n <= (subs[label] || 0) ? "border-brand-500 bg-brand-500" : "border-line-strong")} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="label">Who did you go with?</div>
            <div className="flex flex-wrap gap-1.5">
              {TRIP_TYPES.map(([v, l]) => (
                <button key={v} onClick={() => setTripType(v)} className="chip" data-active={tripType === v}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">When did you go?</div>
            <div className="flex gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input" aria-label="Month">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1} disabled={year === now.getFullYear() && i > now.getMonth()}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input w-28" aria-label="Year">
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <label className="label" htmlFor="rv-title">
              Title your review
            </label>
            <input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Summarise your visit in a line" className="input" />
            {titles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {titles.map((t) => (
                  <button key={t} onClick={() => setTitle(t)} className="chip text-xs hover:border-brand-400">
                    <Sparkles className="size-3 text-coral-500" /> {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="rv-body">
              Write your review
            </label>
            <textarea
              id="rv-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={6000}
              placeholder="What stood out? What could be better? Tips for future visitors?"
              className="input resize-y leading-relaxed"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{body.trim().length < 80 ? `${80 - body.trim().length} more characters to go` : "Looking good"}</span>
              <span>{body.length}/6000</span>
            </div>
          </div>
          <div>
            <div className="label">Add photos (optional)</div>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p} className="relative size-24 overflow-hidden rounded-xl">
                  <img src={p} alt="Your upload" className="h-full w-full object-cover" />
                  <button onClick={() => setPhotos((ph) => ph.filter((x) => x !== p))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button onClick={() => fileRef.current?.click()} className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-line-strong text-muted hover:border-brand-400 hover:text-brand-600">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-6" />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
          </div>
        </section>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={submit} disabled={submitting} className="btn btn-primary btn-lg">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Post review
          </button>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-4" /> Every review is checked by our authenticity model before it goes live.
          </p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="ai-border space-y-3 p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Wand2 className="size-4 text-coral-500" /> AI writing assistant
            </div>
            {provider && <AiBadge provider={provider} />}
          </div>
          <p className="text-xs text-muted">Jot rough notes and the AI turns them into a readable review in your voice. It never invents experiences you didn&apos;t have.</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder={"e.g. great location, breakfast meh, staff super kind, noisy street at night"}
            className="input resize-none text-sm"
          />
          <button onClick={() => assist("draft")} disabled={!!aiBusy || !notes.trim()} className="btn btn-primary w-full">
            {aiBusy === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft my review
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => assist("polish")} disabled={!!aiBusy || !body.trim()} className="btn btn-outline btn-sm">
              {aiBusy === "polish" && <Loader2 className="size-3.5 animate-spin" />} Polish writing
            </button>
            <button onClick={() => assist("titles")} disabled={!!aiBusy || !body.trim()} className="btn btn-outline btn-sm">
              {aiBusy === "titles" && <Loader2 className="size-3.5 animate-spin" />} Suggest titles
            </button>
          </div>

          <div className="border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Review quality</span>
              <span className={cn("font-display text-lg font-semibold", (coach?.score ?? 0) >= 70 ? "text-brand-600" : (coach?.score ?? 0) >= 40 ? "text-sun-500" : "text-muted")}>{coach?.score ?? 0}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="ai-gradient h-full rounded-full transition-all" style={{ width: `${coach?.score ?? 0}%` }} />
            </div>
            {coach ? (
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex flex-wrap gap-1">
                  {coach.covered.map((c) => (
                    <span key={c} className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      ✓ {c}
                    </span>
                  ))}
                  {coach.missing.slice(0, 3).map((c) => (
                    <span key={c} className="badge bg-surface-2 text-muted">
                      + {c}
                    </span>
                  ))}
                </div>
                <div className="text-muted">
                  Tone: <strong className="text-ink">{coach.sentiment}</strong> · sounds like ~{coach.impliedRating}★ · {coach.words} words
                </div>
                <ul className="space-y-1">
                  {coach.tips.map((t) => (
                    <li key={t} className="flex gap-1.5 text-ink-2">
                      <Camera className="mt-0.5 size-3 shrink-0 text-coral-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">Start writing to get live feedback on detail, coverage and tone.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
