"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { UpgradeDialog, type UpgradeReason } from "@/components/billing/UpgradeDialog";

export interface ClientUser {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
  role: string;
  plan: "free" | "plus";
}

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; href: string };
}

interface AppContextValue {
  user: ClientUser | null;
  ai: { provider: "claude" | "local"; label: string };
  isSaved: (placeId: number) => boolean;
  toggleSave: (placeId: number, name?: string) => Promise<void>;
  toast: (message: string, kind?: ToastKind, action?: Toast["action"]) => void;
  chat: { open: boolean; prompt: string | null; nonce: number };
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  requireLogin: (reason?: string) => boolean;
  /** Opens the Wayfarer Plus upsell, optionally with the server's quota message. */
  upgrade: (reason?: UpgradeReason, message?: string | null) => void;
  isPlus: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProviders>");
  return ctx;
}

export function AppProviders({
  children,
  user,
  savedIds,
  ai,
}: {
  children: React.ReactNode;
  user: ClientUser | null;
  savedIds: number[];
  ai: { provider: "claude" | "local"; label: string };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => new Set(savedIds));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [chat, setChat] = useState({ open: false, prompt: null as string | null, nonce: 0 });
  const [upsell, setUpsell] = useState<{ open: boolean; reason: UpgradeReason; message: string | null }>({ open: false, reason: "generic", message: null });
  const closeUpsell = useCallback(() => setUpsell((u) => ({ ...u, open: false })), []);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success", action?: Toast["action"]) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, message, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const requireLogin = useCallback(
    (reason = "Sign in to continue") => {
      if (user) return true;
      toast(reason, "info", { label: "Sign in", href: `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}` });
      return false;
    },
    [user, toast]
  );

  const toggleSave = useCallback(
    async (placeId: number, name?: string) => {
      if (!requireLogin("Sign in to save places to your wishlist")) return;
      const was = saved.has(placeId);
      setSaved((s) => {
        const n = new Set(s);
        if (was) n.delete(placeId);
        else n.add(placeId);
        return n;
      });
      try {
        const res = await fetch("/api/saves", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId }) });
        if (!res.ok) throw new Error();
        toast(was ? `Removed${name ? ` ${name}` : ""} from saved` : `Saved${name ? ` ${name}` : ""} to your wishlist`, "success", was ? undefined : { label: "View", href: "/saved" });
        router.refresh();
      } catch {
        setSaved((s) => {
          const n = new Set(s);
          if (was) n.add(placeId);
          else n.delete(placeId);
          return n;
        });
        toast("Couldn't update your saved places", "error");
      }
    },
    [saved, requireLogin, toast, router]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ai,
      isSaved: (id) => saved.has(id),
      toggleSave,
      toast,
      chat,
      openChat: (prompt?: string) => setChat((c) => ({ open: true, prompt: prompt ?? null, nonce: c.nonce + 1 })),
      closeChat: () => setChat((c) => ({ ...c, open: false, prompt: null })),
      requireLogin,
      upgrade: (reason: UpgradeReason = "generic", message: string | null = null) => setUpsell({ open: true, reason, message }),
      isPlus: user?.plan === "plus",
    }),
    [user, ai, saved, toggleSave, toast, chat, requireLogin]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <UpgradeDialog open={upsell.open} reason={upsell.reason} message={upsell.message} signedIn={!!user} onClose={closeUpsell} />
      <div className="fixed bottom-4 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card flex items-center gap-3 px-4 py-3 text-sm animate-fade-up" role="status">
            {t.kind === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-brand-500" />
            ) : t.kind === "error" ? (
              <TriangleAlert className="size-5 shrink-0 text-coral-500" />
            ) : (
              <Info className="size-5 shrink-0 text-sky-500" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <a href={t.action.href} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                {t.action.label}
              </a>
            )}
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
