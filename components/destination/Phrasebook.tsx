"use client";

import { Volume2 } from "lucide-react";
import { useState } from "react";
import type { Phrase } from "@/lib/types";

const VOICE_LANG: Record<string, string> = {
  FR: "fr-FR", IT: "it-IT", ES: "es-ES", GB: "en-GB", NL: "nl-NL", PT: "pt-PT", CZ: "cs-CZ", AT: "de-AT", GR: "el-GR", TR: "tr-TR", IS: "is-IS",
  MA: "ar-MA", EG: "ar-EG", ZA: "af-ZA", AE: "ar-AE", JP: "ja-JP", ID: "id-ID", TH: "th-TH", SG: "en-SG", KR: "ko-KR", VN: "vi-VN", AU: "en-AU",
  US: "en-US", MX: "es-MX", BR: "pt-BR", AR: "es-AR", PE: "es-PE", CA: "en-CA", NZ: "en-NZ",
};

export function Phrasebook({ phrases, countryCode, language }: { phrases: Phrase[]; countryCode: string; language: string }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const speak = (text: string, i: number) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[countryCode] || "en-US";
    u.rate = 0.85;
    u.onend = () => setPlaying(null);
    setPlaying(i);
    window.speechSynthesis.speak(u);
  };
  return (
    <div className="card divide-y divide-line">
      <div className="flex items-center justify-between px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
        <span>English</span>
        <span>{language}</span>
      </div>
      {phrases.map((p, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3">
          <div className="w-1/3 text-sm text-muted">{p.english}</div>
          <div className="flex-1">
            <div className="font-semibold">{p.local}</div>
            <div className="text-xs italic text-muted">{p.pronunciation}</div>
          </div>
          <button
            onClick={() => speak(p.local, i)}
            className={`btn btn-ghost btn-icon ${playing === i ? "text-brand-600" : ""}`}
            aria-label={`Hear "${p.local}"`}
            title="Listen (uses your device's voices)"
          >
            <Volume2 className={`size-4 ${playing === i ? "animate-pulse" : ""}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
