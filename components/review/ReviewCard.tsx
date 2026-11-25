"use client";

import { Flag, Globe2, MessageSquareReply, ShieldAlert, ThumbsUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { Avatar } from "@/components/ui/Avatar";
import { TrustBadge } from "@/components/ui/Badges";
import { Stars } from "@/components/ui/Stars";
import type { Review } from "@/lib/types";
import { cn, formatMonthYear, timeAgo, TRIP_TYPE_LABELS } from "@/lib/utils";

const LANG_NAMES: Record<string, string> = { fr: "French", es: "Spanish", de: "German", it: "Italian", ja: "Japanese", pt: "Portuguese", ko: "Korean", nl: "Dutch", zh: "Chinese" };

export function ReviewCard({ review, showPlace = false, highlight, onDeleted }: { review: Review; showPlace?: boolean; highlight?: string; onDeleted?: () => void }) {
  const { user, toast, requireLogin } = useApp();
  const [helpful, setHelpful] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(!!review.votedByMe);
  const [translation, setTranslation] = useState<{ title: string; body: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const foreign = review.language !== "en";
  const long = review.body.length > 420;

  const vote = async () => {
    if (!requireLogin("Sign in to vote reviews helpful")) return;
    if (user?.id === review.userId) return toast("You can't vote on your own review", "info");
    setVoted((v) => !v);
    setHelpful((h) => h + (voted ? -1 : 1));
    const r = await fetch(`/api/reviews/${review.id}/helpful`, { method: "POST" });
    if (r.ok) {
      const j = await r.json();
      setVoted(j.voted);
      setHelpful(j.helpfulCount);
    }
  };

  const translate = async () => {
    if (translation) return setShowOriginal((s) => !s);
    setTranslating(true);
    const r = await fetch("/api/ai/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewId: review.id }) });
    setTranslating(false);
    if (r.ok) {
      setTranslation((await r.json()).translation);
      setShowOriginal(false);
    } else toast((await r.json()).error || "Translation unavailable", "error");
  };

  const report = async () => {
    const reason = prompt("Why are you reporting this review? (e.g. fake, offensive, off-topic)");
    if (!reason) return;
    const r = await fetch(`/api/reviews/${review.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    toast(r.ok ? "Thanks — our moderators will take a look." : "Couldn't send report", r.ok ? "success" : "error");
  };

  const remove = async () => {
    if (!confirm("Delete this review permanently?")) return;
    const r = await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
    if (r.ok) {
      toast("Review deleted");
      onDeleted?.();
    }
  };

  const title = !showOriginal && translation ? translation.title : review.title;
  const body = !showOriginal && translation ? translation.body : review.body;

  return (
    <article className={cn("border-b border-line py-6 last:border-0", review.status === "flagged" && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Link href={`/profile/${review.user.username}`}>
          <Avatar name={review.user.displayName} color={review.user.avatarColor} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link href={`/profile/${review.user.username}`} className="font-semibold hover:underline">
              {review.user.displayName}
            </Link>
            {review.user.homeCity && <span className="text-muted">{review.user.homeCity}</span>}
          </div>
          <div className="text-xs text-muted">
            {review.user.reviewCount} contributions · {review.user.helpfulTotal} helpful votes
          </div>
        </div>
        <TrustBadge score={review.trustScore} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Stars value={review.rating} size={15} />
        <span className="text-xs text-muted">
          {TRIP_TYPE_LABELS[review.tripType]} · Visited {formatMonthYear(review.visitDate)}
        </span>
      </div>
      {showPlace && review.place && (
        <Link href={`/place/${review.place.slug}`} className="mt-1 block text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
          {review.place.name} · {review.place.destinationName}
        </Link>
      )}
      <h4 className="mt-2 font-semibold">{mark(title, highlight)}</h4>
      <div className={cn("prose-travel mt-1 text-[15px] text-ink-2", !expanded && long && "line-clamp-5")}>
        {body.split("\n\n").map((p, i) => (
          <p key={i}>{mark(p, highlight)}</p>
        ))}
      </div>
      {long && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {review.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos.map((src) => (
            <button key={src} onClick={() => setLightbox(src)} className="overflow-hidden rounded-lg">
              <img src={src.replace("/960px-", "/330px-")} alt="Traveler photo" className="size-20 object-cover transition-transform hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}

      {review.ownerResponse && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <MessageSquareReply className="size-3.5" /> Response from the owner
          </div>
          <p className="text-ink-2">{review.ownerResponse}</p>
        </div>
      )}

      {review.trustFlags.length > 0 && review.trustScore < 70 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong>AI authenticity check:</strong> {review.trustFlags.join(" · ")}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span>Written {timeAgo(review.createdAt)}</span>
        <button onClick={vote} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors", voted ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-line hover:border-line-strong")}>
          <ThumbsUp className="size-3.5" /> Helpful{helpful > 0 && ` · ${helpful}`}
        </button>
        {foreign && (
          <button onClick={translate} className="inline-flex items-center gap-1 hover:text-ink" disabled={translating}>
            <Globe2 className="size-3.5" />
            {translating ? "Translating…" : translation && !showOriginal ? `Show original (${LANG_NAMES[review.language] || review.language})` : `Translate from ${LANG_NAMES[review.language] || review.language}`}
          </button>
        )}
        <button onClick={report} className="inline-flex items-center gap-1 hover:text-ink">
          <Flag className="size-3.5" /> Report
        </button>
        {(user?.id === review.userId || user?.role === "admin") && (
          <button onClick={remove} className="inline-flex items-center gap-1 hover:text-coral-600">
            <Trash2 className="size-3.5" /> Delete
          </button>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Traveler photo" className="max-h-[88vh] max-w-full rounded-xl object-contain" referrerPolicy="no-referrer" />
        </div>
      )}
    </article>
  );
}

function mark(text: string, q?: string): React.ReactNode {
  if (!q || q.length < 3) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-sun-300/60 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {mark(text.slice(i + q.length), q)}
    </>
  );
}
