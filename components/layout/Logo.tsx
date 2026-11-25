import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="wf-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fa682" />
          <stop offset="1" stopColor="#11463b" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#wf-g)" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M20 8.5 L23.2 20 L20 31.5 L16.8 20 Z" fill="#fff" />
      <path d="M20 8.5 L23.2 20 L16.8 20 Z" fill="#fe7438" />
      <circle cx="20" cy="20" r="1.8" fill="#11463b" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Wayfarer home">
      <LogoMark />
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">
        wayfarer<span className="text-coral-500">.</span>
      </span>
    </Link>
  );
}
