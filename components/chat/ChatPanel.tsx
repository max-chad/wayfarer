"use client";

import { ArrowUp, CalendarDays, Loader2, MapPin, Mic, MicOff, RotateCcw, Sparkles, Square, Volume2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { Markdown } from "@/components/ui/Markdown";
import { SmartImage } from "@/components/ui/SmartImage";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import type { ChatCard } from "@/lib/ai/tools";
import { cn, formatUsd, priceSymbols } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
  suggestions?: string[];
  status?: string | null;
  provider?: "claude" | "local";
  pending?: boolean;
}

const STORAGE_KEY = "wf-chat-v1";
const STARTERS = [
  "Plan 3 romantic days in Paris",
  "Where should I go in February for sun on a budget?",
  "Best street food in Bangkok",
  "Quiet boutique hotel in Kyoto with a view",
  "What's the weather in Reykjavik this week?",
  "Lisbon vs Barcelona for a food lover?",
];

const uid = () => Math.random().toString(36).slice(2, 10);

export function ChatPanel({ compact = false, initialPrompt, promptNonce }: { compact?: boolean; initialPrompt?: string | null; promptNonce?: number }) {
  const { ai, user, upgrade } = useApp();
  const pathname = usePathname();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages((JSON.parse(raw) as Msg[]).map((m) => ({ ...m, pending: false, status: null })));
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      setInput("");
      const userMsg: Msg = { id: uid(), role: "user", content };
      const asst: Msg = { id: uid(), role: "assistant", content: "", pending: true, status: "Thinking…" };
      const history = [...messages, userMsg];
      setMessages([...history, asst]);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === asst.id ? fn(m) : m)));
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-16).map((m) => ({ role: m.role, content: m.content })), context: { path: pathname } }),
          signal: ctrl.signal,
        });
        if (res.status === 402) {
          const err = await res.json().catch(() => ({}));
          patch((m) => ({ ...m, content: `${err.error || "You've reached today's free concierge limit."}

[See Wayfarer Plus](/pricing)`, pending: false, status: null }));
          upgrade("chat", err.error);
          return;
        }
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Something went wrong" }));
          throw new Error(err.error || "Something went wrong");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "text") patch((m) => ({ ...m, content: m.content + ev.delta, status: null }));
            else if (ev.type === "status") patch((m) => ({ ...m, status: ev.text }));
            else if (ev.type === "cards") patch((m) => ({ ...m, cards: [...(m.cards || []), ...ev.cards] }));
            else if (ev.type === "suggestions") patch((m) => ({ ...m, suggestions: ev.items }));
            else if (ev.type === "done") patch((m) => ({ ...m, provider: ev.provider, pending: false, status: null }));
            else if (ev.type === "error") patch((m) => ({ ...m, content: m.content + `\n\n_${ev.message}_`, pending: false, status: null }));
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, content: m.content || `Sorry — ${(e as Error).message}. Please try again.`, pending: false, status: null }));
      } finally {
        patch((m) => ({ ...m, pending: false, status: null }));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, pathname, upgrade]
  );

  // external prompt (e.g. "Ask the concierge" buttons)
  const lastNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (initialPrompt && promptNonce !== lastNonce.current && loaded.current) {
      lastNonce.current = promptNonce;
      const t = setTimeout(() => send(initialPrompt), 50);
      return () => clearTimeout(t);
    }
  }, [initialPrompt, promptNonce, send]);

  const stop = () => abortRef.current?.abort();
  const reset = () => {
    stop();
    setMessages([]);
  };

  const toggleVoice = () => {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice input isn't supported in this browser.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#`]/g, ""));
    u.rate = 1.03;
    window.speechSynthesis.speak(u);
  };

  const last = messages[messages.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className={cn("flex-1 space-y-5 overflow-y-auto", compact ? "px-4 py-4" : "px-1 py-6")}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-2 pt-4 text-center">
            <div className="ai-gradient grid size-14 place-items-center rounded-2xl text-white shadow-lift animate-float">
              <Sparkles className="size-7" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold">Where to next{user ? `, ${user.displayName.split(" ")[0]}` : ""}?</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">I&apos;m Wayfarer&apos;s AI assistant. I can search every hotel, restaurant and sight on Wayfarer, plan itineraries, check the weather and more.</p>
            <p className="mt-1 max-w-sm text-xs text-muted">AI can make mistakes — check opening hours, prices and travel rules before you rely on them.</p>
            <div className={cn("mt-5 grid w-full gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
              {STARTERS.slice(0, compact ? 4 : 6).map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-bg">{m.content}</div>
            ) : (
              <div className="w-full max-w-full space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="ai-gradient mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {m.content ? <Markdown text={m.content} /> : null}
                    {m.status && (
                      <div className="flex items-center gap-2 py-1 text-muted">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span className="animate-pulse-soft">{m.status}</span>
                      </div>
                    )}
                    {!m.pending && m.content && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                        <span>{m.provider === "claude" ? "Claude" : "Wayfarer AI"}</span>
                        <button onClick={() => speak(m.content)} className="inline-flex items-center gap-1 hover:text-ink" aria-label="Read aloud">
                          <Volume2 className="size-3" /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {m.cards && m.cards.length > 0 && <ChatCards cards={m.cards} compact={compact} />}
                {m.id === last?.id && !m.pending && m.suggestions?.length ? (
                  <div className="flex flex-wrap gap-1.5 pl-9">
                    {m.suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)} className="chip text-xs hover:border-brand-400">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={cn("border-t border-line bg-surface", compact ? "p-3" : "rounded-2xl border p-2 shadow-soft")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={listening ? "Listening…" : "Ask about any trip…"}
            className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted"
            aria-label="Message"
          />
          <button type="button" onClick={toggleVoice} className={cn("btn btn-ghost btn-icon", listening && "text-coral-500")} aria-label="Voice input" title="Voice input">
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          {busy ? (
            <button type="button" onClick={stop} className="btn btn-dark btn-icon" aria-label="Stop">
              <Square className="size-4" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="btn btn-primary btn-icon" aria-label="Send">
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", ai.provider === "claude" ? "bg-brand-500" : "bg-sun-400")} />
            {ai.label}
          </span>
          {messages.length > 0 && (
            <button onClick={reset} className="inline-flex items-center gap-1 hover:text-ink">
              <RotateCcw className="size-3" /> New chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatCards({ cards, compact }: { cards: ChatCard[]; compact: boolean }) {
  return (
    <div className="scrollbar-none -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 pl-9">
      {cards.map((c, i) => {
        if (c.kind === "place") {
          const p = c.place;
          return (
            <Link key={i} href={`/place/${p.slug}`} className="card w-52 shrink-0 snap-start overflow-hidden hover:shadow-lift">
              <SmartImage image={p.image} alt={p.name} width={330} className="h-24" />
              <div className="p-2.5">
                <div className="line-clamp-1 text-sm font-semibold">{p.name}</div>
                <div className="line-clamp-1 text-xs text-muted">
                  {p.category} · {p.destinationName}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">★ {p.rating.toFixed(1)} <span className="font-normal text-muted">({p.reviewCount})</span></span>
                  <span className="text-muted">{p.type === "hotel" ? `${formatUsd(p.priceUsd)}/nt` : p.type === "restaurant" ? priceSymbols(p.priceLevel) : p.priceUsd ? formatUsd(p.priceUsd) : "Free"}</span>
                </div>
              </div>
            </Link>
          );
        }
        if (c.kind === "destination") {
          const d = c.destination;
          return (
            <Link key={i} href={`/destinations/${d.slug}`} className="relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl">
              <SmartImage image={d.image} alt={d.name} width={330} className="h-32">
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute bottom-2 left-2.5 text-white">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{d.country}</div>
                  <div className="font-display text-lg font-semibold leading-tight">{d.name}</div>
                </div>
              </SmartImage>
            </Link>
          );
        }
        if (c.kind === "plan") {
          return (
            <div key={i} className="ai-border w-72 shrink-0 snap-start p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
                <CalendarDays className="size-4" /> Itinerary draft
              </div>
              <div className="mt-1 font-display text-lg font-semibold">{c.title}</div>
              <ul className="mt-2 space-y-1 text-xs text-ink-2">
                {c.highlights.slice(0, 5).map((h) => (
                  <li key={h} className="line-clamp-1">
                    {h}
                  </li>
                ))}
              </ul>
              <Link href={`/plan?${c.query}`} className="btn btn-primary btn-sm mt-3 w-full">
                Open in planner
              </Link>
            </div>
          );
        }
        if (c.kind === "weather") {
          return (
            <div key={i} className={cn("card shrink-0 snap-start p-3", compact ? "w-72" : "w-[26rem] max-w-full")}>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <MapPin className="size-3.5" /> {c.destinationName} · 7-day forecast
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {c.days.map((d) => (
                  <div key={d.date} className="rounded-lg py-1">
                    <div className="text-[10px] text-muted">{new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</div>
                    <WeatherIcon icon={d.icon} className="mx-auto my-1 size-5" />
                    <div className="text-xs font-semibold">{d.tmax}°</div>
                    <div className="text-[10px] text-muted">{d.tmin}°</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
