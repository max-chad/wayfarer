"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE = "wf_consent";

function readConsent() {
  return document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.split("=")[1] ?? null;
}

/** Consent for optional analytics. Essential cookies (session, theme) don't need it; "Essential only" is equally prominent. */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!readConsent());
    const reopen = () => setShow(true);
    window.addEventListener("wf:cookie-settings", reopen);
    return () => window.removeEventListener("wf:cookie-settings", reopen);
  }, []);
  if (!show) return null;
  const choose = (value: "essential" | "all") => {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax${secure}`;
    setShow(false);
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-[75] sm:left-auto sm:right-4 sm:max-w-sm" role="dialog" aria-label="Cookie preferences">
      <div className="card p-4 text-sm shadow-xl">
        <div className="flex items-center gap-2 font-semibold">
          <Cookie className="size-4 text-coral-500" /> Your privacy choices
        </div>
        <p className="mt-1.5 text-ink-2">
          We use essential cookies to keep you signed in. With your OK we also attribute partner clicks and bookings to your account so we can show you your
          history — never sold, never used for third-party ads. <Link href="/legal/cookies" className="underline">Cookie policy</Link>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => choose("essential")} className="btn btn-outline btn-sm">
            Essential only
          </button>
          <button onClick={() => choose("all")} className="btn btn-dark btn-sm">
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("wf:cookie-settings"))}>
      Cookie settings
    </button>
  );
}
