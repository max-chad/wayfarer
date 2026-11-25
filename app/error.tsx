"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-coral-100 text-coral-600 dark:bg-coral-700/20">
        <TriangleAlert className="size-8" />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold">Turbulence ahead</h1>
      <p className="mt-2 max-w-md text-muted">Something went wrong loading this page. It&apos;s probably temporary.</p>
      {error.digest && <p className="mt-1 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn btn-dark">
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link href="/" className="btn btn-outline">
          Back home
        </Link>
      </div>
    </div>
  );
}
