"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALES } from "@/lib/locale-core";
import { useApp } from "@/components/providers/AppProviders";

const LABEL = { en: "EN", ru: "RU" } as const;

export function LocaleSwitcher() {
  const router = useRouter();
  const { locale, t } = useApp();
  const [busy, setBusy] = useState(false);
  const next = LOCALES.find((l) => l !== locale) ?? "en";
  const switchTo = async () => {
    setBusy(true);
    try {
      await fetch("/api/locale", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: next }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={switchTo} disabled={busy} className="btn btn-ghost btn-icon" aria-label={t("header.switchLang")} title={`${t("header.switchLang")}: ${LABEL[next]}`}>
      <Languages className="size-[18px]" />
      <span className="text-[10px] font-semibold">{LABEL[next]}</span>
    </button>
  );
}
