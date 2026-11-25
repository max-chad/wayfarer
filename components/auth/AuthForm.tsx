"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/layout/Logo";
import { useApp } from "@/components/providers/AppProviders";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const router = useRouter();
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ identifier: "", password: "", displayName: "", username: "", email: "", homeCity: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (body: Record<string, string>, url: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t("auth.somethingWrong"));
      router.push(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") submit({ identifier: form.identifier, password: form.password }, "/api/auth/login");
    else submit({ displayName: form.displayName, username: form.username, email: form.email, password: form.password, homeCity: form.homeCity }, "/api/auth/signup");
  };

  return (
    <div className="container-page grid min-h-[calc(100vh-4rem)] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="ai-gradient relative overflow-hidden rounded-[2rem] p-10 text-white shadow-lift">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
          <Sparkles className="size-8" />
          <h2 className="mt-6 font-display text-4xl font-semibold leading-tight">{t("auth.heroTitle")}</h2>
          <ul className="mt-6 space-y-3 text-white/90">
            <li>{t("auth.hero1")}</li>
            <li>{t("auth.hero2")}</li>
            <li>{t("auth.hero3")}</li>
            <li>{t("auth.hero4")}</li>
            <li>{t("auth.hero5")}</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <LogoMark className="size-10" />
        <h1 className="mt-5 font-display text-3xl font-semibold">{mode === "login" ? t("auth.welcome") : t("auth.create")}</h1>
        <p className="mt-1 text-muted">{mode === "login" ? t("auth.welcomeSub") : t("auth.createSub")}</p>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => submit({ identifier: "demo@wayfarer.travel", password: "wayfarer-demo" }, "/api/auth/login")}
            className="ai-border mt-6 flex w-full items-center gap-3 p-4 text-left hover:shadow-lift"
            disabled={busy}
          >
            <span className="ai-gradient grid size-10 place-items-center rounded-xl text-white">
              <Sparkles className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{t("auth.demo")}</span>
              <span className="text-xs text-muted">{t("auth.demoSub")}</span>
            </span>
          </button>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "login" ? (
            <>
              <div>
                <label className="label" htmlFor="identifier">
                  {t("auth.emailOrUser")}
                </label>
                <input id="identifier" autoComplete="username" required value={form.identifier} onChange={set("identifier")} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  {t("auth.password")}
                </label>
                <input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={set("password")} className="input" />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="displayName">
                    {t("auth.yourName")}
                  </label>
                  <input id="displayName" required value={form.displayName} onChange={set("displayName")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="username">
                    {t("auth.username")}
                  </label>
                  <input id="username" required value={form.username} onChange={set("username")} className="input" pattern="[a-zA-Z0-9_.]{3,24}" title={t("auth.usernameHint")} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">
                  {t("auth.email")}
                </label>
                <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  {t("auth.password")}
                </label>
                <input id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} className="input" />
                <p className="mt-1 text-xs text-muted">{t("auth.pwHint")}</p>
              </div>
            </>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
          <button disabled={busy} className="btn btn-dark btn-lg w-full">
            {busy && <Loader2 className="size-4 animate-spin" />} {mode === "login" ? t("auth.signIn") : t("auth.createOne")}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              {t("auth.newHere")}{" "}
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
                {t("auth.createOne")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.haveAccount")}{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
                {t("auth.signIn")}
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
