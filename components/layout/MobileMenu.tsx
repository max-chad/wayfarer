"use client";

import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { NAV } from "./NavLinks";

export function MobileMenu() {
  const { user, t } = useApp();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const EXTRA = [
    { href: "/match", label: t("mobile.matcher") },
    { href: "/tools", label: t("mobile.tools") },
    { href: "/saved", label: t("mobile.saved") },
    { href: "/bookings", label: t("mobile.bookings") },
    { href: "/leaderboard", label: t("mobile.leaderboard") },
    { href: "/pricing", label: t("mobile.plus") },
    { href: "/business", label: t("mobile.forBusiness") },
    { href: "/about", label: t("mobile.howItWorks") },
  ];
  return (
    <>
      <button className="btn btn-ghost btn-icon lg:hidden" aria-label={t("header.openMenu")} onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-surface p-5 shadow-2xl animate-fade-up">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl font-semibold">{t("header.menu")}</span>
              <button className="btn btn-ghost btn-icon" aria-label={t("header.closeMenu")} onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <nav className="-mx-2 flex flex-col gap-0.5 overflow-y-auto">
              {[...NAV.map((n) => ({ ...n, label: t(`nav.${n.key}`) })), ...EXTRA].map((n) => (
                <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-medium hover:bg-surface-2">
                  {(n as { ai?: boolean }).ai && <Sparkles className="size-4 text-coral-500" />}
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto pt-4">
              {!user && (
                <Link href="/login" className="btn btn-dark w-full">
                  {t("header.signIn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
