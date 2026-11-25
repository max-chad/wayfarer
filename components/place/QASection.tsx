"use client";

import { Loader2, MessageCircleQuestion, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { Avatar } from "@/components/ui/Avatar";
import type { QA } from "@/lib/data/misc";
import { timeAgo } from "@/lib/utils";

const SUGGESTED: Record<string, string[]> = {
  hotel: ["Is breakfast included?", "Is it quiet at night?", "How far is it from the main sights?", "Is there parking?"],
  restaurant: ["Do I need a reservation?", "Are there vegetarian options?", "Is it good for a date?", "How long is the wait?"],
  attraction: ["Do I need to book tickets in advance?", "How long should I plan to spend?", "Is it wheelchair accessible?", "When is it least crowded?"],
  experience: ["What's included?", "Is it suitable for kids?", "What happens if it rains?", "How big are the groups?"],
};

export function QASection({ placeId, placeType, initial }: { placeId: number; placeType: string; initial: QA[] }) {
  const { user, requireLogin, toast } = useApp();
  const [questions, setQuestions] = useState(initial);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; text: string; provider: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const ask = async (question: string, post = false) => {
    if (question.trim().length < 5) return;
    setBusy(true);
    setAnswer(null);
    try {
      const r = await fetch("/api/ai/qa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, question, post: post && !!user }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAnswer({ q: question, text: j.answer, provider: j.provider });
      if (j.posted) {
        setQuestions(j.questions);
        setQ("");
        toast("Your question was posted to the community");
      }
    } catch (e) {
      toast((e as Error).message || "Couldn't get an answer", "error");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (qid: number) => {
    if (!requireLogin("Sign in to answer questions")) return;
    const r = await fetch(`/api/questions/${qid}/answers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: reply }) });
    if (r.ok) {
      setQuestions((await r.json()).questions);
      setReply("");
      setReplyTo(null);
      toast("Thanks for helping a fellow traveler!");
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="ai-border p-4"
      >
        <label htmlFor="qa-input" className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-coral-500" /> Ask anything — get an instant answer from the listing & reviews
        </label>
        <div className="mt-3 flex gap-2">
          <input id="qa-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Is it good for kids?" className="input" maxLength={500} />
          <button disabled={busy || q.trim().length < 5} className="btn btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="hidden sm:inline">Ask</span>
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(SUGGESTED[placeType] || []).map((s) => (
            <button type="button" key={s} onClick={() => (setQ(s), ask(s))} className="chip text-xs">
              {s}
            </button>
          ))}
        </div>
        {answer && (
          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm animate-fade-up">
            <div className="text-xs font-semibold text-muted">
              {answer.provider === "claude" ? "Claude" : "Wayfarer AI"} · answering “{answer.q}”
            </div>
            <p className="mt-1.5 leading-relaxed">{answer.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {user ? (
                <button type="button" onClick={() => ask(answer.q, true)} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
                  Post this question to the community →
                </button>
              ) : (
                <Link href="/login" className="font-semibold text-brand-700 hover:underline">
                  Sign in to post your question to the community
                </Link>
              )}
            </div>
          </div>
        )}
      </form>

      <div className="mt-6 space-y-5">
        {questions.length === 0 && <p className="text-sm text-muted">No community questions yet — be the first to ask.</p>}
        {questions.map((qq) => (
          <div key={qq.id} className="border-b border-line pb-5 last:border-0">
            <div className="flex items-start gap-3">
              <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{qq.body}</div>
                <div className="text-xs text-muted">
                  {qq.user ? `Asked by ${qq.user.displayName}` : "Asked by a traveler"} · {timeAgo(qq.createdAt)}
                </div>
                <div className="mt-3 space-y-3">
                  {qq.answers.map((a) => (
                    <div key={a.id} className="flex gap-2.5 text-sm">
                      {a.isAi ? (
                        <span className="ai-gradient grid size-7 shrink-0 place-items-center rounded-full text-white">
                          <Sparkles className="size-3.5" />
                        </span>
                      ) : (
                        <Avatar name={a.user?.displayName || "?"} color={a.user?.avatarColor || "#64748b"} size={28} />
                      )}
                      <div>
                        <div className="text-xs text-muted">
                          <span className="font-semibold text-ink">{a.isAi ? "Wayfarer AI" : a.user?.displayName}</span> · {timeAgo(a.createdAt)}
                        </div>
                        <p className="text-ink-2">{a.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {replyTo === qq.id ? (
                  <div className="mt-3 flex gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} className="input py-2 text-sm" placeholder="Share what you know…" autoFocus />
                    <button onClick={() => sendReply(qq.id)} disabled={reply.trim().length < 2} className="btn btn-primary btn-sm">
                      Answer
                    </button>
                  </div>
                ) : (
                  <button onClick={() => (requireLogin("Sign in to answer questions") ? setReplyTo(qq.id) : null)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
                    Answer this question
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
