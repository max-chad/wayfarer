"use client";

import { Maximize2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const { chat, openChat, closeChat } = useApp();
  const pathname = usePathname();
  const hidden = pathname.startsWith("/concierge");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && chat.open) closeChat();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (chat.open) closeChat();
        else openChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open, openChat, closeChat]);

  if (hidden) return null;

  return (
    <>
      {!chat.open && (
        <button
          onClick={() => openChat()}
          className="no-print group fixed bottom-5 right-5 z-[55] flex items-center gap-2 rounded-full bg-ink py-3 pl-3 pr-4 text-sm font-semibold text-bg shadow-lift transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
          aria-label="Open AI travel concierge"
        >
          <span className="ai-gradient grid size-8 place-items-center rounded-full">
            <Sparkles className="size-4 text-white" />
          </span>
          <span className="hidden sm:inline">Ask Wayfarer AI</span>
          <kbd className="ml-1 hidden rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium opacity-70 lg:inline">Ctrl K</kbd>
        </button>
      )}
      {chat.open && (
        <div className="no-print fixed inset-0 z-[65] flex items-end justify-end sm:inset-auto sm:bottom-6 sm:right-6">
          <div className="absolute inset-0 bg-black/30 sm:hidden" onClick={closeChat} />
          <div className="card relative flex h-[88vh] w-full flex-col overflow-hidden rounded-b-none animate-fade-up sm:h-[min(680px,82vh)] sm:w-[410px] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="ai-gradient grid size-8 place-items-center rounded-lg text-white">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold leading-tight">Travel concierge</div>
                  <div className="text-[11px] text-muted">Plans, picks & practical answers</div>
                </div>
              </div>
              <div className="flex items-center">
                <Link href="/concierge" onClick={closeChat} className="btn btn-ghost btn-icon" aria-label="Open full screen" title="Full screen">
                  <Maximize2 className="size-4" />
                </Link>
                <button onClick={closeChat} className="btn btn-ghost btn-icon" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel compact initialPrompt={chat.prompt} promptNonce={chat.nonce} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
