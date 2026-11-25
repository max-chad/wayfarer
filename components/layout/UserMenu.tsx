"use client";

import { Building2, CalendarCheck, Code2, CreditCard, Crown, Heart, LayoutDashboard, LineChart, LogOut, Map, PenLine, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

export function UserMenu({ user }: { user: { username: string; displayName: string; avatarColor: string; role: string; plan: "free" | "plus"; isOwner: boolean } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  const groups = [
    [
      { href: `/profile/${user.username}`, label: "My profile", icon: User },
      { href: "/trips", label: "My trips", icon: Map },
      { href: "/bookings", label: "My bookings", icon: CalendarCheck },
      { href: "/saved", label: "Saved places", icon: Heart },
      { href: "/review", label: "Write a review", icon: PenLine },
    ],
    [
      { href: "/account/billing", label: user.plan === "plus" ? "Plus membership" : "Plan & billing", icon: CreditCard },
      { href: "/account", label: "Account settings", icon: Settings },
    ],
    [
      user.isOwner ? { href: "/business/dashboard", label: "Business dashboard", icon: LineChart } : { href: "/business", label: "Wayfarer for Business", icon: Building2 },
      { href: "/developers", label: "Developer API", icon: Code2 },
      ...(user.role === "admin" ? [{ href: "/admin", label: "Admin & revenue", icon: LayoutDashboard }] : []),
    ],
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative flex items-center rounded-full p-0.5 ring-offset-2 hover:ring-2 hover:ring-line-strong" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar name={user.displayName} color={user.avatarColor} size={34} />
        {user.plan === "plus" && (
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-sun-400 ring-2 ring-bg" title="Wayfarer Plus">
            <Crown className="size-2.5 text-ink" />
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-50 w-64 overflow-hidden p-1.5 animate-fade-up" role="menu">
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {user.displayName}
              {user.plan === "plus" && <span className="badge bg-sun-300/40 text-[10px] text-ink">PLUS</span>}
            </div>
            <div className="text-xs text-muted">@{user.username}</div>
          </div>
          {user.plan === "free" && (
            <Link href="/pricing" onClick={() => setOpen(false)} className="mx-1.5 mb-1.5 flex items-center gap-2 rounded-xl ai-gradient px-3 py-2 text-sm font-semibold text-white" role="menuitem">
              <Crown className="size-4" /> Upgrade to Plus
            </Link>
          )}
          {groups.map((g, i) => (
            <div key={i}>
              <div className="my-1 h-px bg-line" />
              {g.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-surface-2" role="menuitem">
                  <it.icon className="size-4 text-muted" />
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="my-1 h-px bg-line" />
          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-surface-2" role="menuitem">
            <LogOut className="size-4 text-muted" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
