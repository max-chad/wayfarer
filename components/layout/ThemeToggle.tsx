"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("wf-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button onClick={toggle} className="btn btn-ghost btn-icon" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title="Toggle theme">
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
