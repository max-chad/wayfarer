"use client";

import { Loader2, Lock, MessageCircleReply, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { Stars } from "@/components/ui/Stars";
import { cn, formatDate } from "@/lib/utils";

interface ReviewItem {
  id: number;
  rating: number;
  title: string;
  body: string;
  tripType: string;
  visitDate: string;
  ownerResponse: string | null;
  createdAt: string;
  author: string;
}

export function ReviewResponder({ businessId, reviews, canUseAi }: { businessId: number; reviews: ReviewItem[]; canUseAi: boolean }) {
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <ReviewRow key={r.id} businessId={businessId} review={r} canUseAi={canUseAi} />
      ))}
    </div>
  );
}

function ReviewRow({ businessId, review, canUseAi }: { businessId: number; review: ReviewItem; canUseAi: boolean }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.ownerResponse || "");
  const [published, setPublished] = useState(review.ownerResponse);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState<"warm" | "formal" | "brief">("warm");
  const [provider, setProvider] = useState<string | null>(null);

  const draft = async () => {
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/owner-reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessId, reviewId: review.id, tone }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setText(j.draft);
      setProvider(j.provider);
    } catch (e) {
      toast((e as Error).message || "Couldn't draft a reply", "error");
    } finally {
      setDrafting(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/business/${businessId}/reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewId: review.id, text }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPublished(text.trim() || null);
      setOpen(false);
      toast(text.trim() ? "Reply published — the reviewer has been notified" : "Reply removed", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars value={review.rating} size={14} />
        <span className="font-semibold">{review.title}</span>
        <span className="text-xs text-muted">
          · {review.author} · {review.tripType} · {formatDate(review.createdAt)}
        </span>
      </div>
      <p className="mt-2 line-clamp-4 text-sm text-ink-2">{review.body}</p>
      {published && !open && (
        <div className="mt-3 rounded-xl border-l-2 border-brand-500 bg-surface-2 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold text-muted">Your public reply</div>
          <p className="whitespace-pre-line text-ink-2">{published}</p>
        </div>
      )}
      {open ? (
        <div className="mt-3 animate-fade-up">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="input text-sm" placeholder="Write a public reply…" maxLength={2000} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canUseAi ? (
              <>
                <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className="input w-auto py-1.5 text-xs" aria-label="Tone">
                  <option value="warm">Warm</option>
                  <option value="formal">Formal</option>
                  <option value="brief">Brief</option>
                </select>
                <button onClick={draft} disabled={drafting} className="btn btn-outline btn-sm">
                  {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-coral-500" />} Draft with AI
                </button>
              </>
            ) : (
              <a href="#plan" className="btn btn-ghost btn-sm text-muted" title="AI replies are part of Business Insights">
                <Lock className="size-3.5" /> AI drafts with Insights
              </a>
            )}
            {provider && <span className="text-[11px] text-muted">Drafted by {provider === "claude" ? "Claude" : "local AI"} — edit before publishing</span>}
            <div className="flex-1" />
            <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button onClick={publish} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} {published ? "Update reply" : "Publish reply"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className={cn("btn btn-sm mt-3", published ? "btn-ghost" : "btn-dark")}>
          <MessageCircleReply className="size-3.5" /> {published ? "Edit reply" : "Reply"}
        </button>
      )}
    </div>
  );
}
