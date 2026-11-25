"use client";

import { Bell, BellRing, Building2, CalendarCheck, CreditCard, MessageCircleReply, MessagesSquare, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn, timeAgo } from "@/lib/utils";

interface Item {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  booking: CalendarCheck,
  price_drop: TrendingDown,
  owner_response: MessageCircleReply,
  answer: MessagesSquare,
  billing: CreditCard,
  business: Building2,
};

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Price alerts are re-checked server-side when notifications load, so poll gently.
  useEffect(() => {
    const load = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          setItems(j.items);
          setUnread(j.unread);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      fetch("/api/notifications", { method: "POST" }).catch(() => {});
      setUnread(0);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="btn btn-ghost btn-icon relative" aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"} aria-haspopup="menu" aria-expanded={open}>
        {unread ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden p-0 animate-fade-up" role="menu">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <Link href="/account/billing" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
              Plan & billing
            </Link>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items === null && <div className="p-6 text-center text-sm text-muted">Loading…</div>}
            {items?.length === 0 && <div className="p-6 text-center text-sm text-muted">You&apos;re all caught up.</div>}
            {items?.map((n) => {
              const Icon = ICONS[n.kind] || Bell;
              const body = (
                <div className={cn("flex gap-3 px-4 py-3 text-sm hover:bg-surface-2", !n.read && "bg-brand-50/60 dark:bg-brand-950/40")}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</div>}
                    <div className="mt-1 text-[11px] text-muted">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              );
              return n.url ? (
                <Link key={n.id} href={n.url} onClick={() => setOpen(false)} role="menuitem" className="block border-b border-line last:border-0">
                  {body}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-line last:border-0">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
